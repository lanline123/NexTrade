'use client';

/**
 * PC 收银台（源码：view/pc/pages/order/pay.vue）
 *
 * 与源码对齐的实现：
 * - 支付方式：按 paymentList 白名单（源码 PAYMENT_ICON_MAP）过滤出渠道图标卡片，
 *   stripe/antom/xendit 仅跨境站展示，applepay 仅支持 Apple Pay 的 Safari 展示；
 *   默认选中第一个可用渠道
 * - 去付款：applepay 内联 ApplePaySession；stripe/antom/xendit 创建支付会话后按
 *   payInfo.url / html 重定向；其余渠道打开 `/order/{channel}` 渠道页
 *   （wechat/alipay/paypal/yabanpay/huifu/lakala/yeepay）；无独立渠道页的
 *   yunpay* 走页内二维码兜底
 * - 线下支付：offlinePaymentList 四个说明 Tab + 付款确认弹层
 *   （转账时间/付款人/流水号/付款凭证 ≤5 张且单张 ≤2MB，上传 /user/user/uploadImg，
 *    提交 user/order/offlinePaymentClaim/submit，修改前读取 .../detail；
 *    按钮文案按 order.offlinePaymentClaimStatus：2=修改申请 / 0=认款详情 / 其它=付款完成）
 * - 轮询：每 2s、最多 50 次，带 in-flight / finished 去重，成功后只跳转一次
 * - 预售定金：type=saleMode 或 presaleInfo 判定时走 createDepositPayment
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Modal, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
import { formatPrice } from '@/lib/currency';
type PaymentMethod = string | { type?: string; name?: string; typeName?: string };

interface PayPresaleInfo {
  saleMode?: number;
  presaleStatus?: number;
}

interface PayOrder {
  orderId?: number;
  orderSn?: string;
  shopName?: string;
  unpaidAmount?: number | string;
  orderAmount?: number | string;
  payTypeId?: number;
  offlinePaymentClaimStatus?: number;
  grouponPromotionRecordId?: number;
  presaleInfo?: PayPresaleInfo;
}

interface PayInfo {
  order?: PayOrder;
  paymentList?: PaymentMethod[];
  offlinePaymentList?: Record<string, string>;
}

interface OfflineClaim {
  claimId?: number;
  orderId?: number;
  transferTime?: number;
  payerName?: string;
  bankSerialNo?: string;
  voucherUrls?: string[];
  status?: number;
  statusName?: string;
  rejectReason?: string | null;
  auditRemark?: string | null;
}

/** 源码重定向类支付：创建会话后直接跳转（stripe / antom / xendit） */
const REDIRECT_PAY_TYPES = ['stripe', 'antom', 'xendit'];

/** 本仓库为跨境版 PC（v5.8.61），源码 isOverseas() 在此恒为 true；可用环境变量覆盖调试 */
const IS_OVERSEAS = process.env.NEXT_PUBLIC_PC_OVERSEAS !== '0';

/** 源码 PAYMENT_ICON_MAP 白名单（小写） */
const KNOWN_CHANNEL_TYPES = new Set([
  'wechat',
  'alipay',
  'paypal',
  'yabanpaywechat',
  'yabanpayalipay',
  'yunpaywechat',
  'yunpayalipay',
  'yunpayyunshanfu',
  'stripe',
  'antom',
  'xendit',
  'huifuwechat',
  'huifualipay',
  'lakalawechat',
  'lakalaalipay',
  'yeepaywechat',
  'yeepayalipay',
  'applepay',
]);

const CHANNEL_LABELS: Record<string, string> = {
  wechat: '微信支付',
  alipay: '支付宝',
  paypal: 'PayPal',
  stripe: 'Stripe',
  xendit: 'Xendit',
  antom: 'Antom',
  yunpay: '云闪付',
  yeepay: '易宝支付',
  lakala: '拉卡拉',
  huifu: '汇付天下',
  yabanpay: 'YabandPay',
  applepay: 'Apple Pay',
};

/** 旧版线下支付 Tab（源 pay.vue offlinePaymentList 键与 el-tabs name） */
const OFFLINE_TABS: Array<{ key: string; label: string; name: number }> = [
  { key: 'thirdPartyPaymentTransfer', label: '第三方支付转账', name: 3 },
  { key: 'offlinePayBank', label: '银行汇款', name: 1 },
  { key: 'offlinePayCompany', label: '企业汇款', name: 2 },
  { key: 'otherPaymentRemittance', label: '其他汇款方式', name: 4 },
];

const OFFLINE_IMAGE_TYPES = /^image\/(png|jpe?g|gif|webp|tiff)$/i;
const OFFLINE_MAX_FILES = 5;
const OFFLINE_MAX_SIZE = 2 * 1024 * 1024;
const POLL_INTERVAL = 2000;
const POLL_MAX_ATTEMPTS = 50;

function canUseApplePay(): boolean {
  try {
    const AP = typeof window !== 'undefined' ? (window as any).ApplePaySession : null;
    return !!AP && typeof AP.canMakePayments === 'function' && AP.canMakePayments();
  } catch {
    return false;
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** 秒级时间戳 → 「YYYY-MM-DD HH:mm」（源码 formatTransferTime） */
function formatTransferTime(timestamp?: number | string): string {
  if (!timestamp) return '';
  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 「YYYY-MM-DD HH:mm」→ 秒级时间戳（源码 parseTransferTime） */
function parseTransferTime(value?: string): number {
  if (!value) return 0;
  const time = new Date(`${value.replace(/-/g, '/')}:00`).getTime();
  return Number.isNaN(time) ? 0 : Math.floor(time / 1000);
}

/** datetime-local 用本地时间（toISOString 是 UTC，不能用于 max） */
function localNowForInput(): string {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function channelLabel(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('wechat')) return CHANNEL_LABELS.wechat;
  if (lower.includes('alipay')) return CHANNEL_LABELS.alipay;
  if (lower.includes('yunshanfu')) return '云闪付';
  if (CHANNEL_LABELS[lower]) return CHANNEL_LABELS[lower];
  const brand = lower.replace(/(wechat|alipay)$/, '');
  return CHANNEL_LABELS[brand] || brand || type;
}

/** 渠道页链接（源码 payLink；无独立渠道页的 yunpay* 返回 null 走页内兜底） */
function buildPayLink(payType: string, orderId: number, saleMode: boolean): string | null {
  const typeParam = `&type=${saleMode ? 'saleMode' : ''}`;
  switch (payType.toLowerCase()) {
    case 'wechat':
      return `/order/wechat?id=${orderId}${typeParam}`;
    case 'alipay':
      return `/order/alipay?id=${orderId}${typeParam}`;
    case 'paypal':
      return `/order/paypal?id=${orderId}${typeParam}`;
    case 'yabanpaywechat':
      return `/order/yabanpay?type=wechat&id=${orderId}`;
    case 'yabanpayalipay':
      return `/order/yabanpay?type=alipay&id=${orderId}`;
    case 'huifuwechat':
      return `/order/huifu?payCode=${payType}&id=${orderId}${typeParam}`;
    case 'huifualipay':
      return `/order/huifu?payCode=${payType}&id=${orderId}${typeParam}`;
    case 'lakalawechat':
      return `/order/lakala?payCode=${payType}&id=${orderId}${typeParam}`;
    case 'lakalaalipay':
      return `/order/lakala?payCode=${payType}&id=${orderId}${typeParam}`;
    case 'yeepaywechat':
      return `/order/yeepay?payCode=${payType}&id=${orderId}${typeParam}`;
    case 'yeepayalipay':
      return `/order/yeepay?payCode=${payType}&id=${orderId}${typeParam}`;
    default:
      return null;
  }
}

/** paymentList → 白名单过滤后的可展示渠道（源码 paymentMethods computed） */
function normalizePaymentMethods(
  list: PaymentMethod[] | undefined,
  applePayAvailable: boolean,
): Array<{ type: string; label: string }> {
  return (list || [])
    .map((item) => {
      if (typeof item === 'string') return { type: item, label: channelLabel(item) };
      const type = String(item?.type || '');
      return {
        type,
        label: item?.name || item?.typeName || channelLabel(type),
      };
    })
    .filter((item) => {
      if (!item.type) return false;
      const lower = item.type.toLowerCase();
      if (!KNOWN_CHANNEL_TYPES.has(lower)) return false;
      if (REDIRECT_PAY_TYPES.includes(lower) && !IS_OVERSEAS) return false;
      if (lower === 'applepay') return applePayAvailable;
      return true;
    });
}

/** 渠道图标（inline SVG，替代源码 assets/images/extra/payment_method_*） */
function ChannelIcon({ type }: { type: string }) {
    const { t } = useTranslation();
  const key = type.toLowerCase();
  if (key.includes('wechat')) {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#07c160" />
        <ellipse cx="13.5" cy="14" rx="7.5" ry="6" fill="#fff" />
        <ellipse cx="20.5" cy="18.5" rx="6.5" ry="5" fill="#fff" />
        <circle cx="11" cy="13" r="1.1" fill="#07c160" />
        <circle cx="16" cy="13" r="1.1" fill="#07c160" />
        <circle cx="18.5" cy="18" r="1" fill="#07c160" />
        <circle cx="22.5" cy="18" r="1" fill="#07c160" />
      </svg>
    );
  }
  if (key.includes('alipay')) {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#1677ff" />
        <text x="16" y="23" textAnchor="middle" fontSize="18" fontWeight="700" fill="#fff">{t('支')}</text>
      </svg>
    );
  }
  if (key.includes('yunshanfu') || key.includes('yunpay')) {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#e1251b" />
        <text x="16" y="23" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">{t('云')}</text>
      </svg>
    );
  }
  if (key.includes('applepay')) {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#000" />
        <text x="16" y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">Pay</text>
      </svg>
    );
  }
  if (key.includes('paypal')) {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#003087" />
        <text x="16" y="23" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">P</text>
      </svg>
    );
  }
  if (key.includes('stripe')) {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#635bff" />
        <text x="16" y="23" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">S</text>
      </svg>
    );
  }
  const letter = (type || '?').slice(0, 1).toUpperCase();
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#8a919f" />
      <text x="16" y="23" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">{letter}</text>
    </svg>
  );
}

export default function PayClient({ orderId, defaultChannel }: { orderId: number; defaultChannel?: string }) {
    const { t } = useTranslation();
  const [info, setInfo] = useState<PayInfo | null>(null);
  const [payType, setPayType] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [applePaying, setApplePaying] = useState(false);
  const [appleSupported, setAppleSupported] = useState(false);
  const [saleMode, setSaleMode] = useState(false);
  const [qr, setQr] = useState('');
  const [qrTips, setQrTips] = useState('');
  const [offlineTab, setOfflineTab] = useState('');
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimUploading, setClaimUploading] = useState(false);
  const [claimDetail, setClaimDetail] = useState<OfflineClaim | null>(null);
  const [claimTransferTime, setClaimTransferTime] = useState('');
  const [claimPayerName, setClaimPayerName] = useState('');
  const [claimBankSerialNo, setClaimBankSerialNo] = useState('');
  const [claimVouchers, setClaimVouchers] = useState<string[]>([]);

  const pollRef = useRef<{ timer: ReturnType<typeof setInterval> | null; count: number; inFlight: boolean; finished: boolean }>({
    timer: null,
    count: 0,
    inFlight: false,
    finished: false,
  });
  const vouchersRef = useRef<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    vouchersRef.current = claimVouchers;
  }, [claimVouchers]);

  useEffect(() => {
    setAppleSupported(canUseApplePay());
    if (typeof window !== 'undefined') {
      setSaleMode(new URLSearchParams(window.location.search).get('type') === 'saleMode');
    }
  }, []);

  const stopPoll = useCallback(() => {
    const state = pollRef.current;
    if (state.timer) clearInterval(state.timer);
    pollRef.current = { timer: null, count: 0, inFlight: false, finished: false };
  }, []);

  /** 支付状态轮询：2s × 50，in-flight 与 finished 去重（源码渠道页口径） */
  const startPoll = useCallback(() => {
    stopPoll();
    pollRef.current.timer = setInterval(async () => {
      const state = pollRef.current;
      if (state.inFlight || state.finished) return;
      state.inFlight = true;
      state.count += 1;
      try {
        const status = await apiGet<number>('order/pay/checkStatus', { id: orderId });
        if (Number(status) > 0) {
          state.finished = true;
          stopPoll();
          Toast.success({ content: '支付完成' });
          window.location.href = '/member/order/list';
          return;
        }
      } catch {
        /* 单次查询失败继续下一轮 */
      } finally {
        pollRef.current.inFlight = false;
      }
      if (pollRef.current.count >= POLL_MAX_ATTEMPTS && !pollRef.current.finished) {
        pollRef.current.finished = true;
        stopPoll();
        Toast.error({ content: '支付已超时，您可以刷新页面重新支付' });
      }
    }, POLL_INTERVAL);
  }, [orderId, stopPoll]);

  useEffect(() => () => stopPoll(), [stopPoll]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('accessToken')) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    if (!orderId) {
      setLoading(false);
      Toast.error({ content: '缺少订单 ID' });
      return;
    }
    apiGet<PayInfo>('order/pay/index', { id: orderId })
      .then((result) => {
        setInfo(result);
        const order = result.order || {};
        if (order.grouponPromotionRecordId) {
          window.location.replace(`/member/group/info?id=${order.grouponPromotionRecordId}`);
          return;
        }
        // 定金预售：非尾款阶段按定金支付处理（源码 presaleInfo 判定）
        if (Number(order.presaleInfo?.saleMode) === 2 && Number(order.presaleInfo?.presaleStatus) !== 1) {
          setSaleMode(true);
        }
        const methods = normalizePaymentMethods(result.paymentList, canUseApplePay());
        const preferred = String(defaultChannel || '').toLowerCase();
        const matched = methods.find((method) => method.type.toLowerCase() === preferred);
        setPayType(matched?.type || methods[0]?.type || '');
        const offlineKeys = result.offlinePaymentList || {};
        const firstTab = OFFLINE_TABS.find((tab) => typeof offlineKeys[tab.key] === 'string' && offlineKeys[tab.key]);
        setOfflineTab(firstTab?.key || '');
      })
      .catch((error) => {
        Toast.error({ content: error instanceof Error ? error.message : '订单支付信息加载失败' });
        window.location.href = '/member/order/list/';
      })
      .finally(() => setLoading(false));
  }, [orderId, defaultChannel]);

  const createPay = useCallback(
    (type: string) =>
      (saleMode
        ? apiGet<Record<string, any>>('order/pay/createDepositPayment', { id: orderId, type })
        : apiGet<Record<string, any>>('order/pay/create', { id: orderId, type, code: 'pc' })) as Promise<Record<string, any>>,
    [orderId, saleMode],
  );

  const stopPayAndReload = () => {
    stopPoll();
    setQr('');
    setQrTips('');
  };

  /** Apple Pay 授权成功后兜底轮询（最多 5 次 × 2s） */
  const pollApplePaid = useCallback(
    (maxAttempts = 5) =>
      new Promise<boolean>((resolve) => {
        let count = 0;
        let finished = false;
        const timer = setInterval(async () => {
          if (finished) return;
          count += 1;
          try {
            const status = await apiGet<number>('order/pay/checkStatus', { id: orderId });
            if (Number(status) > 0) {
              finished = true;
              clearInterval(timer);
              resolve(true);
              return;
            }
          } catch {
            /* ignore */
          }
          if (count >= maxAttempts && !finished) {
            finished = true;
            clearInterval(timer);
            resolve(false);
          }
        }, POLL_INTERVAL);
      }),
    [orderId],
  );

  /** Apple Pay 内联支付（源码 useApplePay + startApplePay） */
  const launchApplePay = useCallback(() => {
    if (applePaying) return;
    if (!canUseApplePay()) {
      Toast.warning({ content: '当前环境不支持 Apple Pay（仅 Safari / Apple 设备可用）' });
      return;
    }
    const order = info?.order || {};
    const AP = (window as any).ApplePaySession;
    const request = {
      countryCode: 'CN',
      currencyCode: 'CNY',
      supportedNetworks: ['visa', 'masterCard', 'chinaUnionPay'],
      merchantCapabilities: ['supports3DS'],
      total: { label: order.shopName || order.orderSn || 'Apple Pay', amount: String(order.unpaidAmount ?? order.orderAmount ?? 0) },
    };
    let session: any;
    try {
      session = new AP(3, request);
    } catch {
      Toast.error({ content: 'Apple Pay 拉起失败' });
      return;
    }
    setApplePaying(true);
    session.onvalidatemerchant = async (event: any) => {
      try {
        await createPay('applepay');
        const result = await apiPost<any>('order/pay/applepay/validateMerchant', { id: orderId, validationURL: event.validationURL });
        session.completeMerchantValidation(result?.merchantSession ?? result);
      } catch (error) {
        session.abort();
        setApplePaying(false);
        Toast.error({ content: error instanceof Error ? error.message : 'Apple Pay 商户验证失败' });
      }
    };
    session.onpaymentauthorized = async (event: any) => {
      try {
        await apiPost('order/pay/applepay/confirm', { id: orderId, token: JSON.stringify(event.payment?.token ?? event.payment) });
        session.completePayment(AP.STATUS_SUCCESS);
        const paid = await pollApplePaid();
        setApplePaying(false);
        if (paid) {
          Toast.success({ content: '支付完成' });
          window.location.href = '/member/order/list';
        } else {
          Toast.warning({ content: '支付处理中，请稍后在订单中查看支付结果' });
        }
      } catch (error) {
        session.completePayment(AP.STATUS_FAILURE);
        setApplePaying(false);
        Toast.error({ content: error instanceof Error ? error.message : 'Apple Pay 支付失败' });
      }
    };
    session.oncancel = () => setApplePaying(false);
    try {
      session.begin();
    } catch {
      setApplePaying(false);
      Toast.error({ content: 'Apple Pay 拉起失败' });
    }
  }, [applePaying, createPay, info, orderId, pollApplePaid]);

  /** 重定向类支付（stripe / antom / xendit）：url 跳转，html 表单提交兜底 */
  const handleRedirectPay = useCallback(
    async (payTypeValue: string) => {
      if (paying) return;
      setPaying(true);
      try {
        const result = await createPay(payTypeValue);
        const payInfo = (result?.payInfo || {}) as Record<string, any>;
        if (typeof payInfo.url === 'string' && payInfo.url) {
          window.location.href = payInfo.url;
          return;
        }
        if (typeof payInfo.html === 'string' && payInfo.html) {
          const container = document.createElement('div');
          document.body.appendChild(container);
          container.innerHTML = payInfo.html;
          const forms = document.forms;
          if (forms && forms[0]) forms[0].submit();
          return;
        }
        Toast.error({ content: '支付信息获取失败，请重试' });
      } catch (error) {
        Toast.error({ content: error instanceof Error ? error.message : '该订单金额未满足该支付方式的最低金额要求,请选择其他支付' });
      } finally {
        setPaying(false);
      }
    },
    [createPay, paying],
  );

  /** 无独立渠道页的兜底（yunpay*）：页内二维码/跳转 */
  const handleInlinePay = useCallback(
    async (payTypeValue: string) => {
      setPaying(true);
      try {
        const result = await createPay(payTypeValue);
        const payInfo = (result?.payInfo || result || {}) as Record<string, any>;
        const codeUrl = payInfo.codeUrl || payInfo.qrCode || payInfo.qr_code;
        if (typeof codeUrl === 'string' && codeUrl) {
          const QRCode = (await import('qrcode')).default;
          setQr(await QRCode.toDataURL(codeUrl, { width: 260, margin: 1 }));
          setQrTips(payTypeValue.toLowerCase().includes('alipay') ? t('请使用支付宝扫码支付') : '请使用微信扫码支付');
          startPoll();
          return;
        }
        if (typeof payInfo.url === 'string' && payInfo.url) {
          window.open(payInfo.url, '_blank');
          startPoll();
          return;
        }
        if (typeof payInfo.html === 'string' && payInfo.html) {
          const win = window.open('', '_blank');
          if (win) {
            win.document.write(payInfo.html);
            win.document.close();
          }
          startPoll();
          return;
        }
        Toast.error({ content: '支付信息获取失败，请重试' });
      } catch (error) {
        Toast.error({ content: error instanceof Error ? error.message : '发起支付失败' });
      } finally {
        setPaying(false);
      }
    },
    [createPay, startPoll],
  );

  const pay = useCallback(() => {
    if (!payType) {
      Toast.error({ content: '请选择支付方式' });
      return;
    }
    const lower = payType.toLowerCase();
    if (lower === 'applepay') {
      launchApplePay();
      return;
    }
    const link = buildPayLink(payType, orderId, saleMode);
    if (link) {
      window.open(link, '_blank');
      return;
    }
    if (REDIRECT_PAY_TYPES.includes(lower)) {
      void handleRedirectPay(payType);
      return;
    }
    void handleInlinePay(payType);
  }, [payType, orderId, saleMode, launchApplePay, handleRedirectPay, handleInlinePay]);

  const loadOfflineClaimDetail = useCallback(async () => {
    try {
      const claim = await apiGet<OfflineClaim | null>('user/order/offlinePaymentClaim/detail', { orderId });
      if (claim && typeof claim === 'object') {
        setClaimDetail(claim);
        return claim;
      }
    } catch {
      /* 未提交认款 */
    }
    return null;
  }, [orderId]);

  useEffect(() => {
    if (!info?.order) return;
    if (Number(info.order.payTypeId || 0) >= 3 && Number(info.order.offlinePaymentClaimStatus) === 0) {
      void loadOfflineClaimDetail();
    }
  }, [info, loadOfflineClaimDetail]);

  const resetClaimForm = () => {
    setClaimTransferTime('');
    setClaimPayerName('');
    setClaimBankSerialNo('');
    setClaimVouchers([]);
    setClaimDetail(null);
  };

  const openOfflineClaim = async () => {
    const status = Number(info?.order?.offlinePaymentClaimStatus);
    if (status === 0) {
      Toast.info({ content: '您已提交汇款凭证，等待财务人员核对流水，我们尽快完成审核。' });
      return;
    }
    resetClaimForm();
    if (status === 2) {
      const claim = await loadOfflineClaimDetail();
      if (claim) {
        setClaimTransferTime(formatTransferTime(claim.transferTime));
        setClaimPayerName(claim.payerName || '');
        setClaimBankSerialNo(claim.bankSerialNo || '');
        setClaimVouchers(Array.isArray(claim.voucherUrls) ? claim.voucherUrls : []);
      }
    }
    setClaimOpen(true);
  };

  const uploadVoucher = async (file: File) => {
    if (!OFFLINE_IMAGE_TYPES.test(file.type)) {
      Toast.error({ content: '不支持上传此文件格式' });
      return;
    }
    if (file.size > OFFLINE_MAX_SIZE) {
      Toast.error({ content: '只能上传2M以内的图片' });
      return;
    }
    if (vouchersRef.current.length >= OFFLINE_MAX_FILES) {
      Toast.warning({ content: '最多上传5张' });
      return;
    }
    setClaimUploading(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/user/user/uploadImg', {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: form,
      });
      const json: any = await response.json().catch(() => ({}));
      const picUrl = json?.data?.picUrl || json?.data?.url;
      if (!response.ok || (json.code !== undefined && json.code !== 0) || !picUrl) {
        throw new Error(json?.msg || json?.message || t('图片上传失败'));
      }
      setClaimVouchers((list) => {
        const next = list.length >= OFFLINE_MAX_FILES ? list : [...list, String(picUrl)];
        vouchersRef.current = next;
        return next;
      });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '图片上传失败' });
    } finally {
      setClaimUploading(false);
    }
  };

  const submitOfflineClaim = async () => {
    const orderIdValue = Number(info?.order?.orderId || orderId);
    if (!claimVouchers.length) {
      Toast.error({ content: '付款凭证必传' });
      return;
    }
    setClaimSubmitting(true);
    try {
      await apiPost('user/order/offlinePaymentClaim/submit', {
        orderId: orderIdValue,
        transferTime: parseTransferTime(claimTransferTime),
        payerName: claimPayerName.trim(),
        bankSerialNo: claimBankSerialNo.trim(),
        voucherUrls: claimVouchers,
      });
      Toast.success({ content: '提交成功，等待财务审核' });
      setClaimOpen(false);
      window.location.href = `/member/order/info?id=${orderIdValue}`;
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setClaimSubmitting(false);
    }
  };

  if (loading) return <Card className="cart-state">{t('订单支付信息加载中...')}</Card>;

  const order = info?.order || {};
  const offlineEntries = OFFLINE_TABS.filter((tab) => typeof (info?.offlinePaymentList || {})[tab.key] === 'string');
  const payTypeId = Number(order.payTypeId || 0);
  const onlineMode = payTypeId < 3;
  const offlineMode = !onlineMode && offlineEntries.length > 0;
  const activeOffline = offlineEntries.find((tab) => tab.key === offlineTab) || offlineEntries[0];
  const methods = normalizePaymentMethods(info?.paymentList, appleSupported);
  const selectedMethod = methods.find((method) => method.type === payType);
  const claimStatus = Number(order.offlinePaymentClaimStatus);
  const claimButtonText = claimStatus === 2 ? t('修改申请') : claimStatus === 0 ? t('认款详情') : '付款完成';
  const isApplePay = payType.toLowerCase() === 'applepay';

  return (
    <div className="mp-pay">
      {/* 旧版 pages/order/pay.vue 结构：CommonPageContainer > .success_txt / .price_box / .pay_type_box / .btn_box */}
      <div className="success_txt">{t('您的订单已成功提交，请付款')}！</div>

      <div className="price_box">
        <div className="num_box">
          <div className="tit">{t('需支付')}：</div>
          <span className="price">{formatPrice(order.unpaidAmount ?? order.orderAmount)}</span>
        </div>
        <div className="order_num">
          <div className="tit">{t('订单号')}：</div>
          <div className="num hand-pointer">
            <Link href={`/member/order/info?id=${order.orderId ?? orderId}`} target="_blank">
              {order.orderSn || '-'}
            </Link>
          </div>
        </div>
      </div>

      {onlineMode && methods.length ? (
        <div className="pay_type_box payment-methods-box">
          <div className="payment-section platform-payment-box">
            <div className="tit_row">
              <h3>{t('平台支付')}</h3>
              <p>{t('支持所有银行卡或信用卡，更迅速、安全')}</p>
            </div>
            <div className="type_tab">
              {methods.map((method) => (
                <div
                  key={method.type}
                  className={`tab flex align-center${method.type === payType ? ' active' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => setPayType(method.type)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setPayType(method.type);
                  }}
                >
                  <div className="check">
                    <span />
                  </div>
                  <div className="cont">
                    <ChannelIcon type={method.type} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}

      {offlineMode ? (
        <div className="pay_type_box">
          <div className="tig-tabs">
            {offlineEntries.map((tab) => (
              <a
                key={tab.key}
                className={`tab${activeOffline && activeOffline.key === tab.key ? ' active' : ''}`}
                onClick={() => setOfflineTab(tab.key)}
              >
                {tab.label}
              </a>
            ))}
          </div>
          {activeOffline ? (
            <div
              className="offline-pay-content"
              // 源码：offlinePaymentList 为后台配置 HTML，直接 v-html 渲染
              dangerouslySetInnerHTML={{ __html: String((info?.offlinePaymentList || {})[activeOffline.key] || '') }}
            />
          ) : null}
          {claimStatus === 0 && claimDetail ? (
            <div className="pc-pay__claim-status">
              <Typography.Text type="tertiary">认款状态：{claimDetail.statusName || t('等待财务审核')}</Typography.Text>
              {claimDetail.transferTime ? <div>转账时间：{formatTransferTime(claimDetail.transferTime)}</div> : null}
              {claimDetail.payerName ? <div>付款人：{claimDetail.payerName}</div> : null}
              {claimDetail.bankSerialNo ? <div>转账流水号：{claimDetail.bankSerialNo}</div> : null}
              {claimDetail.rejectReason ? <div className="pc-pay__claim-reject">驳回原因：{claimDetail.rejectReason}</div> : null}
            </div>
          ) : null}
          <div className="offline-claim-action">
            <Button theme="solid" type="primary" size="large" onClick={openOfflineClaim}>
              {claimButtonText}
            </Button>
          </div>
        </div>
      ) : null}

      {/* 以下两块（Apple Pay 参数面板、扫码二维码）旧版 pay.vue 里没有对应结构，属于新版自有能力，未做旧版化 */}
      {isApplePay ? (
        <div className="pc-pay__applepay-panel">
          <div className="pc-pay__label">{t('Apple Pay 支付参数')}</div>
          <div className="pc-pay__applepay-grid">
            <span>countryCode</span><b>CN</b>
            <span>currencyCode</span><b>CNY</b>
            <span>supportedNetworks</span><b>visa / masterCard / chinaUnionPay</b>
            <span>merchantCapabilities</span><b>supports3DS</b>
            <span>total</span><b>{order.shopName || order.orderSn || 'Apple Pay'} · {formatPrice(order.unpaidAmount ?? order.orderAmount)}</b>
          </div>
          {appleSupported ? (
            <Button theme="solid" type="primary" loading={applePaying} onClick={launchApplePay}>
              {applePaying ? t('支付中...') : '拉起 Apple Pay'}
            </Button>
          ) : (
            <Typography.Text type="tertiary">当前环境不支持 Apple Pay，请在 Safari / Apple 设备中打开本页支付。</Typography.Text>
          )}
        </div>
      ) : null}

      {qr ? (
        <div className="pc-pay__qr">
          <Typography.Text type="tertiary">{qrTips}</Typography.Text>
          <div className="pc-pay__qr-image">
            <img src={qr} alt={t('支付二维码')} width={260} height={260} />
          </div>
          <Button size="small" theme="borderless" onClick={stopPayAndReload}>{t('取消扫码')}</Button>
        </div>
      ) : null}

      {offlineMode ? null : (
        <div className="btn_box">
          <div
            className={`btn${paying || applePaying ? ' btn-loading' : ''}${!payType || !!qr ? ' is-disabled' : ''}`}
            role="button"
            tabIndex={0}
            onClick={() => {
              if (!paying && !applePaying && payType && !qr) void pay();
            }}
          >
            <span>{paying || applePaying ? `${t('支付中')}...` : t('去付款')}</span>
            {!paying && !applePaying ? <i className="iconfont-pc icon-yuanjiaojiantouyou" /> : null}
          </div>
        </div>
      )}

      <Modal
        visible={claimOpen}
        title={null}
        header={null}
        footer={null}
        width={520}
        onCancel={() => setClaimOpen(false)}
      >
        <div className="mp-pay-dialog">
          <div className="el-dialog">
            <div className="el-dialog__header">
              <span className="el-dialog__title">{t('填写付款确认')}</span>
            </div>
            <div className="el-dialog__body">
              <form className="el-form offline-claim-form" onSubmit={(event) => event.preventDefault()}>
                <div className="el-form-item">
                  <div className="el-form-item__label">{t('付款金额')}</div>
                  <div className="el-form-item__content">
                    <span className="offline-claim-amount">{formatPrice(order.unpaidAmount ?? order.orderAmount)}</span>
                  </div>
                </div>
                <div className="el-form-item">
                  <div className="el-form-item__label">{t('转账时间')}</div>
                  <div className="el-form-item__content">
                    <div className="el-input">
                      <input
                        className="el-input__inner"
                        type="datetime-local"
                        value={claimTransferTime.replace(' ', 'T')}
                        max={localNowForInput()}
                        onChange={(event) => setClaimTransferTime(String(event.target.value || '').replace('T', ' '))}
                      />
                    </div>
                  </div>
                </div>
                <div className="el-form-item">
                  <div className="el-form-item__label">{t('付款人姓名')}</div>
                  <div className="el-form-item__content">
                    <div className="el-input">
                      <input
                        className="el-input__inner"
                        value={claimPayerName}
                        placeholder={t('请输入')}
                        onChange={(event) => setClaimPayerName(String(event.target.value || ''))}
                      />
                    </div>
                  </div>
                </div>
                <div className="el-form-item">
                  <div className="el-form-item__label">{t('转账流水号')}</div>
                  <div className="el-form-item__content">
                    <div className="el-input">
                      <input
                        className="el-input__inner"
                        value={claimBankSerialNo}
                        placeholder={t('请填写')}
                        onChange={(event) => setClaimBankSerialNo(String(event.target.value || ''))}
                      />
                    </div>
                  </div>
                </div>
                <div className="el-form-item">
                  <div className="el-form-item__label">{t('付款凭证')}</div>
                  <div className="el-form-item__content">
                    <div className="offline-claim-upload-wrap">
                      <input
                        ref={fileInputRef}
                        className="offline-native-file-input"
                        type="file"
                        accept="image/png,image/jpeg,image/gif,image/webp,image/tiff"
                        multiple
                        onChange={(event) => {
                          const files = Array.from(event.target.files || []);
                          event.target.value = '';
                          const remaining = Math.max(0, OFFLINE_MAX_FILES - vouchersRef.current.length);
                          files.slice(0, remaining).forEach((file) => void uploadVoucher(file));
                        }}
                      />
                      <div
                        className={`offline-claim-uploader${claimVouchers.length >= OFFLINE_MAX_FILES ? ' is-limit-reached' : ''}`}
                      >
                        {claimVouchers.map((url) => (
                          <div key={url} className="el-upload-list__item">
                            <img src={url} alt={t('付款凭证')} />
                            <span
                              className="el-upload-list__item-delete"
                              role="button"
                              tabIndex={0}
                              onClick={() =>
                                setClaimVouchers((list) => {
                                  const next = list.filter((item) => item !== url);
                                  vouchersRef.current = next;
                                  return next;
                                })
                              }
                            >
                              ×
                            </span>
                          </div>
                        ))}
                        {claimVouchers.length < OFFLINE_MAX_FILES ? (
                          <span
                            className="offline-claim-upload-trigger"
                            role="button"
                            tabIndex={0}
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {claimUploading ? t('上传中...') : '+'}
                          </span>
                        ) : null}
                      </div>
                      <div className="offline-claim-upload-tip">{t('最多上传5张')}</div>
                    </div>
                  </div>
                </div>
              </form>
            </div>
            <div className="el-dialog__footer">
              <button type="button" className="btn" onClick={() => setClaimOpen(false)}>
                {t('取消')}
              </button>
              <button
                type="button"
                className={`btn info${claimSubmitting ? ' btn-loading' : ''}`}
                onClick={() => void submitOfflineClaim()}
              >
                {t('确认')}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

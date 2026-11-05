'use client';

/**
 * PC 收银台（源码：view/pc/pages/order/pay.vue）
 *
 * 迁移要点：
 * - 支付方式图标/选择：paymentList → 渠道图标卡片（Icon 内联 SVG），默认选第一个可用渠道
 * - 线下支付：offlinePaymentList 四个 Tab（第三方转账/银行汇款/企业汇款/其他汇款）
 *   + 「填写付款确认」弹窗（转账时间/付款人/流水号/付款凭证 ≤5 张、单张 ≤2MB），
 *     提交 `user/order/offlinePaymentClaim/submit`，修改前读取 `.../detail`
 *   + 按钮文案按 order.offlinePaymentClaimStatus：2=修改申请 / 0=认款详情 / 其它=付款完成
 * - Apple Pay：能力检测（ApplePaySession.canMakePayments）+ 内联拉起
 *   （onvalidatemerchant → order/pay/applepay/validateMerchant，
 *     onpaymentauthorized → order/pay/applepay/confirm，成功后兜底轮询 checkStatus）；
 *   不支持时展示 Apple Pay 参数面板（countryCode/currencyCode/networks/capabilities/total）
 * - 支付状态轮询：每 2s，最多 50 次；成功提示后跳订单列表，超时提示刷新
 * - 预售定金（type=saleMode）走 `order/pay/createDepositPayment`
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Modal, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

type PaymentMethod = string | { type?: string; name?: string; typeName?: string };

interface PayOrder {
  orderId?: number;
  orderSn?: string;
  shopName?: string;
  unpaidAmount?: number | string;
  orderAmount?: number | string;
  payTypeId?: number;
  offlinePaymentClaimStatus?: number;
  grouponPromotionRecordId?: number;
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
  offline: '线下汇款',
  balance: '余额支付',
};

/** 旧版线下支付 Tab 文案与 el-tabs name（源 pay.vue） */
const OFFLINE_TABS: Array<{ key: string; label: string; name: number }> = [
  { key: 'thirdPartyPaymentTransfer', label: '第三方支付转账', name: 3 },
  { key: 'offlinePayBank', label: '银行汇款', name: 1 },
  { key: 'offlinePayCompany', label: '企业汇款', name: 2 },
  { key: 'otherPaymentRemittance', label: '其他汇款方式', name: 4 },
];

const OFFLINE_IMAGE_TYPES = /^image\/(png|jpe?g|gif|webp|tiff)$/i;
const OFFLINE_MAX_FILES = 5;
const OFFLINE_MAX_SIZE = 2 * 1024 * 1024;

const REDIRECT_PAY_TYPES = ['stripe', 'antom', 'xendit'];

function normalizePaymentMethods(list: PaymentMethod[] | undefined): Array<{ type: string; label: string }> {
  return (list || [])
    .map((item) => {
      if (typeof item === 'string') return { type: item, label: CHANNEL_LABELS[item.toLowerCase()] || item };
      const type = String(item?.type || '');
      return { type, label: item?.name || item?.typeName || CHANNEL_LABELS[type.toLowerCase()] || type };
    })
    .filter((item) => item.type);
}

/** Apple Pay 能力检测（仅 Safari + 支持 Apple Pay 的苹果设备） */
function canUseApplePay(): boolean {
  try {
    const AP = typeof window !== 'undefined' ? (window as any).ApplePaySession : null;
    return !!AP && typeof AP.canMakePayments === 'function' && AP.canMakePayments();
  } catch {
    return false;
  }
}

function formatAmount(value: number | string | undefined): string {
  const amount = Number(value ?? 0);
  return amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 秒级时间戳 → 「YYYY-MM-DD HH:mm」 */
function formatTransferTime(timestamp?: number | string): string {
  if (!timestamp) return '';
  const date = new Date(Number(timestamp) * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 「YYYY-MM-DD HH:mm」→ 秒级时间戳；无效返回 0 */
function parseTransferTime(value?: string): number {
  if (!value) return 0;
  const time = new Date(`${value.replace(/-/g, '/')}:00`).getTime();
  return Number.isNaN(time) ? 0 : Math.floor(time / 1000);
}

/** 渠道路径片段 → paymentList 中的渠道 key（如 yabanpay/type=alipay → yabanpay_alipay） */
function resolveChannelFromPath(): string {
  if (typeof window === 'undefined') return '';
  const segments = window.location.pathname.split('/').filter(Boolean);
  const route = (segments[1] || '').toLowerCase();
  const params = new URLSearchParams(window.location.search);
  const payCode = (params.get('payCode') || '').toLowerCase();
  const type = (params.get('type') || '').toLowerCase();
  if (route === 'yabanpay' && type && type !== 'saleMode') return `yabanpay_${type}`;
  if (payCode) return payCode;
  if (route === 'huifu' || route === 'lakala' || route === 'yeepay') return `${route}${type === 'alipay' ? 'Alipay' : 'Wechat'}`.toLowerCase();
  return route;
}

/** 内置渠道图标（inline SVG，代替源码 assets/images/extra/payment_method_*.{jpg,png,svg}） */
function ChannelIcon({ type }: { type: string }) {
  const key = type.toLowerCase();
  if (key.includes('wechat') || key.includes('wxpay')) {
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
        <text x="16" y="23" textAnchor="middle" fontSize="18" fontWeight="700" fill="#fff">支</text>
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
  if (key.includes('applepay')) {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#000" />
        <text x="16" y="22" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">Pay</text>
      </svg>
    );
  }
  if (key.includes('yunshanfu') || key.includes('yunpay')) {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#e1251b" />
        <text x="16" y="23" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">云</text>
      </svg>
    );
  }
  if (key.includes('xendit')) {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#4573ff" />
        <text x="16" y="23" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">X</text>
      </svg>
    );
  }
  if (key.includes('antom')) {
    return (
      <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
        <rect width="32" height="32" rx="8" fill="#ff6a00" />
        <text x="16" y="23" textAnchor="middle" fontSize="17" fontWeight="700" fill="#fff">A</text>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#8a919f" />
      <text x="16" y="23" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff">{(type || '?').slice(0, 1).toUpperCase()}</text>
    </svg>
  );
}

export default function PayClient({ orderId, defaultChannel }: { orderId: number; defaultChannel?: string }) {
  const [info, setInfo] = useState<PayInfo | null>(null);
  const [payType, setPayType] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [applePaying, setApplePaying] = useState(false);
  const [appleSupported, setAppleSupported] = useState(false);
  const [qr, setQr] = useState('');
  const [qrTips, setQrTips] = useState('');
  const [offlineTab, setOfflineTab] = useState('');
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimSubmitting, setClaimSubmitting] = useState(false);
  const [claimDetail, setClaimDetail] = useState<OfflineClaim | null>(null);
  const [claimTransferTime, setClaimTransferTime] = useState('');
  const [claimPayerName, setClaimPayerName] = useState('');
  const [claimBankSerialNo, setClaimBankSerialNo] = useState('');
  const [claimVouchers, setClaimVouchers] = useState<string[]>([]);
  const [claimUploading, setClaimUploading] = useState(false);
  const [saleMode, setSaleMode] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAppleSupported(canUseApplePay());
    if (typeof window !== 'undefined') {
      const type = new URLSearchParams(window.location.search).get('type') || '';
      setSaleMode(type === 'saleMode');
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      window.location.replace(`/login?redirect=${encodeURIComponent(`/order/pay?id=${orderId}`)}`);
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
        if (result.order?.grouponPromotionRecordId) {
          window.location.replace(`/member/group/info?id=${result.order.grouponPromotionRecordId}`);
          return;
        }
        const methods = normalizePaymentMethods(result.paymentList)
          .filter((method) => method.type.toLowerCase() !== 'applepay' || canUseApplePay());
        const preferred = String(defaultChannel || resolveChannelFromPath() || '').toLowerCase();
        const matched = methods.find((method) => method.type.toLowerCase() === preferred);
        setPayType(matched?.type || methods[0]?.type || '');
        const offlineKeys = result.offlinePaymentList || {};
        const firstTab = OFFLINE_TABS.find((tab) => typeof offlineKeys[tab.key] === 'string' && offlineKeys[tab.key]);
        setOfflineTab(firstTab?.key || '');
      })
      .catch((error) => Toast.error({ content: error instanceof Error ? error.message : '订单支付信息加载失败' }))
      .finally(() => setLoading(false));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId, defaultChannel]);

  const stopPoll = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  /** 支付状态轮询：每 2s、最多 50 次（源 wechat/huifu/lakala/yeepay 一致） */
  const startPoll = useCallback(
    (maxAttempts = 50) => {
      stopPoll();
      let count = 0;
      pollRef.current = setInterval(async () => {
        count += 1;
        try {
          const status = await apiGet<number>('order/pay/checkStatus', { id: orderId });
          if (Number(status) > 0) {
            stopPoll();
            Toast.success({ content: '订单支付成功' });
            window.location.href = '/member/order/list';
            return;
          }
        } catch {
          /* 单次轮询失败不打断 */
        }
        if (count >= maxAttempts) {
          stopPoll();
          Toast.error({ content: '支付已超时，您可以刷新页面重新支付' });
        }
      }, 2000);
    },
    [orderId, stopPoll],
  );

  /** Apple Pay 授权成功后的兜底轮询（最多 5 次、每 2s） */
  const pollPaidOnce = useCallback(
    (maxAttempts = 5) =>
      new Promise<boolean>((resolve) => {
        let count = 0;
        const timer = setInterval(async () => {
          count += 1;
          try {
            const status = await apiGet<number>('order/pay/checkStatus', { id: orderId });
            if (Number(status) > 0) {
              clearInterval(timer);
              resolve(true);
              return;
            }
          } catch {
            /* ignore */
          }
          if (count >= maxAttempts) {
            clearInterval(timer);
            resolve(false);
          }
        }, 2000);
      }),
    [orderId],
  );

  const createPay = useCallback(
    (type: string) =>
      saleMode
        ? apiGet<Record<string, any>>('order/pay/createDepositPayment', { id: orderId, type })
        : apiGet<Record<string, any>>('order/pay/create', { id: orderId, type, code: 'pc' }),
    [orderId, saleMode],
  );

  const showQr = async (url: string, tips: string) => {
    const QRCode = (await import('qrcode')).default;
    const dataUrl = await QRCode.toDataURL(url, { width: 260, margin: 1 });
    setQr(dataUrl);
    setQrTips(tips);
    startPoll();
  };

  /** 源码 useApplePay：ApplePaySession 内联拉起（不建中间页） */
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
        const paid = await pollPaidOnce();
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
  }, [applePaying, createPay, info, orderId, pollPaidOnce]);

  const openExternalPay = async (type: string) => {
    setPaying(true);
    try {
      const result = await createPay(type);
      const channel = (result?.payInfo || result || {}) as Record<string, any>;

      if (typeof channel.html === 'string' && channel.html.includes('<form')) {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(channel.html);
          win.document.close();
        } else {
          Toast.error({ content: '浏览器拦截了支付窗口，请允许弹窗后重试' });
        }
        startPoll();
        return;
      }

      const codeUrl = channel.codeUrl || channel.qrCode || channel.qr_code;
      if (typeof codeUrl === 'string' && codeUrl) {
        await showQr(codeUrl, type.toLowerCase().includes('wechat') ? '请使用微信扫码支付' : '请扫码支付');
        return;
      }

      const redirectUrl = channel.h5Url || channel.url || channel.payUrl || channel.normalUrl;
      if (typeof redirectUrl === 'string' && redirectUrl.startsWith('http')) {
        window.location.href = redirectUrl;
        return;
      }

      if (channel.appId && channel.paySign && channel.package) {
        const invoke = () => {
          const bridge = (window as any).WeixinJSBridge;
          if (!bridge) {
            Toast.error({ content: '请在微信客户端内打开后支付' });
            return;
          }
          bridge.invoke(
            'getBrandWCPayRequest',
            {
              appId: channel.appId,
              timeStamp: channel.timeStamp,
              nonceStr: channel.nonceStr,
              package: channel.package,
              signType: channel.signType || 'RSA',
              paySign: channel.paySign,
            },
            (res: any) => {
              if (res?.err_msg === 'get_brand_wcpay_request:ok') {
                Toast.success({ content: '支付成功' });
                window.location.href = '/member/order/list';
              } else {
                Toast.error({ content: '支付未完成' });
              }
            },
          );
        };
        if ((window as any).WeixinJSBridge) invoke();
        else document.addEventListener('WeixinJSBridgeReady', invoke, { once: true });
        return;
      }

      Toast.info({ content: '支付通道已受理，请按页面提示完成支付' });
      startPoll();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '发起支付失败' });
    } finally {
      setPaying(false);
    }
  };

  const pay = async () => {
    if (!payType) {
      Toast.error({ content: '请选择支付方式' });
      return;
    }
    if (payType.toLowerCase() === 'applepay') {
      launchApplePay();
      return;
    }
    await openExternalPay(payType);
  };

  const loadOfflineClaimDetail = useCallback(async () => {
    try {
      const claim = await apiGet<OfflineClaim | null>('user/order/offlinePaymentClaim/detail', { orderId });
      if (claim && typeof claim === 'object') setClaimDetail(claim);
    } catch {
      /* 未提交认款时接口返回空值 */
    }
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
      try {
        const claim = await apiGet<OfflineClaim | null>('user/order/offlinePaymentClaim/detail', { orderId });
        if (claim && typeof claim === 'object') {
          setClaimDetail(claim);
          setClaimTransferTime(formatTransferTime(claim.transferTime));
          setClaimPayerName(claim.payerName || '');
          setClaimBankSerialNo(claim.bankSerialNo || '');
          setClaimVouchers(Array.isArray(claim.voucherUrls) ? claim.voucherUrls : []);
        }
      } catch {
        /* 继续展示空表单 */
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
    if (claimVouchers.length >= OFFLINE_MAX_FILES) {
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
        throw new Error(json?.msg || json?.message || '图片上传失败');
      }
      setClaimVouchers((list) => [...list, String(picUrl)]);
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

  if (loading) return <Card className="cart-state">订单支付信息加载中...</Card>;

  const order = info?.order || {};
  const offlineEntries = OFFLINE_TABS.filter((tab) => typeof (info?.offlinePaymentList || {})[tab.key] === 'string');
  const offlineMode = Number(order.payTypeId || 0) >= 3 && offlineEntries.length > 0;
  const activeOffline = offlineEntries.find((tab) => tab.key === offlineTab) || offlineEntries[0];
  const methods = normalizePaymentMethods(info?.paymentList).filter((method) => method.type.toLowerCase() !== 'applepay' || appleSupported);
  const selectedMethod = methods.find((method) => method.type === payType);
  const claimStatus = Number(order.offlinePaymentClaimStatus);
  const claimButtonText = claimStatus === 2 ? '修改申请' : claimStatus === 0 ? '认款详情' : '付款完成';
  const isApplePay = payType.toLowerCase() === 'applepay';

  return (
    <div className="pc-pay">
      <Card className="pc-pay__card">
        <div className="pc-pay__success">您的订单已成功提交，请付款！</div>
        <div className="pc-pay__amount">
          <span>需支付</span>
          <b>¥ {formatAmount(order.unpaidAmount ?? order.orderAmount)}</b>
        </div>
        <div className="pc-pay__order">
          <span>订单号</span>
          <b>{order.orderSn || '-'}</b>
        </div>

        {offlineMode ? (
          <div className="pc-pay__offline">
            <div className="pc-pay__label">线下汇款方式</div>
            <div className="pc-pay__offline-tabs">
              {offlineEntries.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={activeOffline && activeOffline.key === tab.key ? 'is-active' : ''}
                  onClick={() => setOfflineTab(tab.key)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {activeOffline ? (
              <div
                className="pc-pay__offline-content"
                // 源码：offlinePaymentList 内容为后台配置 HTML，直接 v-html
                dangerouslySetInnerHTML={{ __html: String((info?.offlinePaymentList || {})[activeOffline.key] || '') }}
              />
            ) : null}
            {claimStatus === 0 && claimDetail ? (
              <div className="pc-pay__claim-status">
                <Typography.Text type="tertiary">认款状态：{claimDetail.statusName || '等待财务审核'}</Typography.Text>
                {claimDetail.transferTime ? <div>转账时间：{formatTransferTime(claimDetail.transferTime)}</div> : null}
                {claimDetail.payerName ? <div>付款人：{claimDetail.payerName}</div> : null}
                {claimDetail.bankSerialNo ? <div>转账流水号：{claimDetail.bankSerialNo}</div> : null}
                {claimDetail.rejectReason ? <div className="pc-pay__claim-reject">驳回原因：{claimDetail.rejectReason}</div> : null}
              </div>
            ) : null}
            <div className="pc-pay__offline-claim-action" style={{ marginTop: 16 }}>
              <Button theme="solid" type="primary" size="large" onClick={openOfflineClaim}>
                {claimButtonText}
              </Button>
            </div>
            <p className="pc-pay__offline-tips">请按上方账户信息完成汇款，并提交付款凭证，财务核对后完成认款。</p>
          </div>
        ) : null}

        {!offlineMode && methods.length ? (
          <div className="pc-pay__methods">
            <div className="pc-pay__methods-head">
              <h3>平台支付</h3>
              <p>支持所有银行卡或信用卡，更迅速、安全</p>
            </div>
            <div className="pc-pay__method-grid">
              {methods.map((method) => (
                <button
                  key={method.type}
                  type="button"
                  className={`pc-pay__method${method.type === payType ? ' is-active' : ''}`}
                  onClick={() => setPayType(method.type)}
                >
                  <ChannelIcon type={method.type} />
                  <span>{method.label}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {isApplePay ? (
          <div className="pc-pay__applepay-panel">
            <div className="pc-pay__label">Apple Pay 支付参数</div>
            <div className="pc-pay__applepay-grid">
              <span>countryCode</span><b>CN</b>
              <span>currencyCode</span><b>CNY</b>
              <span>supportedNetworks</span><b>visa / masterCard / chinaUnionPay</b>
              <span>merchantCapabilities</span><b>supports3DS</b>
              <span>total</span><b>{order.shopName || order.orderSn || 'Apple Pay'} · ¥ {formatAmount(order.unpaidAmount ?? order.orderAmount)}</b>
            </div>
            {appleSupported ? (
              <Button theme="solid" type="primary" loading={applePaying} onClick={launchApplePay}>
                {applePaying ? '支付中...' : '拉起 Apple Pay'}
              </Button>
            ) : (
              <Typography.Text type="tertiary">当前环境不支持 Apple Pay，请在 Safari / Apple 设备中打开本页支付。</Typography.Text>
            )}
          </div>
        ) : null}

        {qr ? (
          <div className="pc-pay__qr" style={{ textAlign: 'center', marginTop: 16 }}>
            <Typography.Text type="tertiary">{qrTips}</Typography.Text>
            <div style={{ marginTop: 10 }}>
              <img src={qr} alt="支付二维码" width={260} height={260} />
            </div>
            <Button
              size="small"
              theme="borderless"
              onClick={() => {
                setQr('');
                stopPoll();
              }}
            >
              取消扫码
            </Button>
          </div>
        ) : null}

        <div className="pc-pay__actions">
          {offlineMode ? null : (
            <Button theme="solid" type="primary" size="large" loading={paying || applePaying} disabled={!payType || !!qr} onClick={pay}>
              {selectedMethod ? `去付款（${selectedMethod.label}）` : '去付款'}
            </Button>
          )}
          <Link href="/member/order/list">
            <Button size="large">查看订单</Button>
          </Link>
        </div>
      </Card>

      <Modal
        visible={claimOpen}
        title="填写付款确认"
        width={520}
        onCancel={() => setClaimOpen(false)}
        footer={
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button onClick={() => setClaimOpen(false)}>取消</Button>
            <Button theme="solid" type="primary" loading={claimSubmitting} onClick={submitOfflineClaim}>
              确认
            </Button>
          </div>
        }
      >
        <div className="pc-pay__claim-form">
          <div className="pc-pay__claim-row">
            <span className="pc-pay__claim-label">付款金额</span>
            <b>¥ {formatAmount(order.unpaidAmount ?? order.orderAmount)}</b>
          </div>
          <div className="pc-pay__claim-row">
            <span className="pc-pay__claim-label">转账时间</span>
            <input
              className="semi-input pc-pay__claim-datetime"
              type="datetime-local"
              value={claimTransferTime.replace(' ', 'T')}
              max={new Date().toISOString().slice(0, 16)}
              onChange={(event) => setClaimTransferTime(String(event.target.value || '').replace('T', ' '))}
            />
          </div>
          <div className="pc-pay__claim-row">
            <span className="pc-pay__claim-label">付款人姓名</span>
            <Input value={claimPayerName} onChange={(value) => setClaimPayerName(String(value || ''))} placeholder="请输入" />
          </div>
          <div className="pc-pay__claim-row">
            <span className="pc-pay__claim-label">转账流水号</span>
            <Input value={claimBankSerialNo} onChange={(value) => setClaimBankSerialNo(String(value || ''))} placeholder="请填写" />
          </div>
          <div className="pc-pay__claim-row">
            <span className="pc-pay__claim-label">付款凭证</span>
            <div className="pc-pay__claim-upload">
              {claimVouchers.map((url) => (
                <div key={url} className="pc-pay__claim-thumb">
                  <img src={url} alt="付款凭证" />
                  <button type="button" onClick={() => setClaimVouchers((list) => list.filter((item) => item !== url))}>
                    ×
                  </button>
                </div>
              ))}
              {claimVouchers.length < OFFLINE_MAX_FILES ? (
                <button type="button" className="pc-pay__claim-add" onClick={() => fileInputRef.current?.click()}>
                  {claimUploading ? '上传中...' : '+'}
                </button>
              ) : null}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/tiff"
                multiple
                style={{ display: 'none' }}
                onChange={(event) => {
                  const files = Array.from(event.target.files || []);
                  event.target.value = '';
                  const remaining = Math.max(0, OFFLINE_MAX_FILES - claimVouchers.length);
                  files.slice(0, remaining).forEach((file) => void uploadVoucher(file));
                }}
              />
            </div>
            <div className="pc-pay__claim-tip">最多上传5张，单张不超过2M</div>
          </div>
        </div>
      </Modal>

      <style>{`
        /* 渠道图标选择 */
        .pc-pay__methods-head h3 { margin: 0; font-size: 16px; color: #1a1a1a; }
        .pc-pay__methods-head p { margin: 4px 0 12px; font-size: 12px; color: #8a919f; }
        .pc-pay__method-grid { display: flex; flex-wrap: wrap; gap: 12px; }
        .pc-pay__method {
          display: flex; align-items: center; gap: 10px; padding: 10px 14px;
          border: 1px solid #e5e7eb; border-radius: 8px; background: #fff;
          cursor: pointer; font-size: 14px; color: #1a1a1a;
        }
        .pc-pay__method.is-active { border-color: #1677ff; box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.12); }
        .pc-pay__applepay-panel { margin-top: 16px; padding: 16px; border: 1px dashed #dcdcdc; border-radius: 8px; background: #fafbfc; }
        .pc-pay__applepay-grid {
          display: grid; grid-template-columns: 160px 1fr; gap: 6px 12px;
          font-size: 13px; color: #333; margin: 10px 0 14px; word-break: break-all;
        }
        .pc-pay__applepay-grid span { color: #8a919f; }
        /* 线下认款表单 */
        .pc-pay__claim-form { display: flex; flex-direction: column; gap: 12px; }
        .pc-pay__claim-row { display: flex; align-items: flex-start; gap: 12px; }
        .pc-pay__claim-label { flex: 0 0 92px; font-size: 14px; color: #333; line-height: 32px; }
        .pc-pay__claim-datetime {
          flex: 1; height: 32px; border: 1px solid #dcdcdc; border-radius: 6px;
          padding: 0 10px; font-size: 14px; box-sizing: border-box;
        }
        .pc-pay__claim-upload { display: flex; flex-wrap: wrap; gap: 8px; flex: 1; }
        .pc-pay__claim-thumb { position: relative; width: 72px; height: 72px; border: 1px solid #e5e7eb; border-radius: 6px; overflow: hidden; }
        .pc-pay__claim-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .pc-pay__claim-thumb button {
          position: absolute; top: 2px; right: 2px; width: 18px; height: 18px; padding: 0;
          border: 0; border-radius: 50%; background: rgba(0, 0, 0, 0.55); color: #fff;
          font-size: 12px; line-height: 18px; cursor: pointer;
        }
        .pc-pay__claim-add {
          width: 72px; height: 72px; border: 1px dashed #dcdcdc; border-radius: 6px;
          background: #fafbfc; color: #8a919f; font-size: 24px; cursor: pointer;
        }
        .pc-pay__claim-tip { color: #8a919f; font-size: 12px; margin-top: 6px; }
        .pc-pay__claim-status { margin-top: 12px; padding: 12px; border-radius: 8px; background: #f5f8ff; color: #333; font-size: 13px; line-height: 22px; }
        .pc-pay__claim-reject { color: #f5222d; }
      `}</style>
    </div>
  );
}

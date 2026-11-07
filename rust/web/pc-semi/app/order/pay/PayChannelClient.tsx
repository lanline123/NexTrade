'use client';

/**
 * 支付渠道页（源码：view/pc/pages/order/{alipay,wechat,paypal,stripe,huifu,lakala,yeepay,yabanpay}.vue）
 *
 * 深链/历史书签兜底页，按渠道类型处理：
 * - alipay：创建支付宝支付，后端返回自动提交表单 HTML → 写入容器并 submit
 * - paypal：创建支付后跳 payInfo.url
 * - stripe：payInfo.url 跳转，否则 html 表单提交，失败展示返回上一步
 * - wechat / huifu / lakala / yeepay / yabanpay：二维码页（payInfo.codeUrl / payInfo.url），
 *   每 2s 轮询 `order/pay/checkStatus`，最多 50 次；超时提示刷新；yeepay 额外提供收银台按钮
 * - 预售定金：query.type=saleMode 时走 `order/pay/createDepositPayment`
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Card, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
type Brand = 'alipay' | 'wechat' | 'paypal' | 'stripe' | 'huifu' | 'lakala' | 'yeepay' | 'yabanpay' | 'yunpay';

interface PayOrder {
  orderSn?: string;
  unpaidAmount?: number | string;
  orderAmount?: number | string;
  grouponPromotionRecordId?: number;
}

const BRAND_LABELS: Record<Brand, string> = {
  alipay: '支付宝支付',
  wechat: '微信支付',
  paypal: 'PayPal 支付',
  stripe: 'Stripe 支付',
  huifu: '汇付天下',
  lakala: '拉卡拉',
  yeepay: '易宝支付',
  yabanpay: 'YabandPay',
  yunpay: '云闪付',
};

function brandPayType(brand: Brand, query: URLSearchParams): string {
  const type = (query.get('type') || '').toLowerCase();
  const payCode = (query.get('payCode') || '').trim();
  if (brand === 'alipay' || brand === 'wechat' || brand === 'paypal' || brand === 'stripe') return brand;
  if (brand === 'yabanpay') return `yabanpay_${type === 'alipay' ? 'alipay' : 'wechat'}`;
  if (brand === 'yunpay') return `yunpay_${type === 'alipay' ? 'alipay' : type === 'yunshanfu' ? 'yunshanfu' : 'wechat'}`;
  if (payCode) return payCode;
  return `${brand}${type === 'alipay' ? 'Alipay' : 'Wechat'}`;
}

function formatAmount(value: number | string | undefined): string {
  return Number(value ?? 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 源码 CommonHeader：渠道页独立标题栏（title={t('微信支付')} 等） */
function PayCommonHeader({ title }: { title: string }) {
    const { t } = useTranslation();
  return (
    <div className="common-header" style={{ background: '#fff', borderBottom: '1px solid #eee' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 20, fontWeight: 600, color: '#1a1a1a' }}>{title}</span>
        <span style={{ fontSize: 13, color: '#999' }}>{t('收银台')}</span>
      </div>
    </div>
  );
}

/** 源码 CommonLoginHeader :showLogin=false：顶栏不展示登录入口 */
function PayLoginHeader() {
    const { t } = useTranslation();
  return (
    <div className="common-login-header" style={{ background: '#fff', borderBottom: '1px solid #f0f0f0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 20px', height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: '#999' }}>
        <span>{t('欢迎来到收银台')}</span>
        <span>{t('安全支付 · 请核对订单信息')}</span>
      </div>
    </div>
  );
}

/** 源码 CommonPageFooter :type="1" bg="white"：白底页脚 */
function PayPageFooter() {
    const { t } = useTranslation();
  return (
    <footer className="common-page-footer" style={{ background: '#fff', borderTop: '1px solid #eee', marginTop: 32 }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '20px', textAlign: 'center', fontSize: 12, color: '#999', lineHeight: 2 }}>
        <div>{t('© 万物新生 · 支付中心')}</div>
        <div>{t('如遇支付问题，请联系客服或返回订单页重新支付')}</div>
      </div>
    </footer>
  );
}

/** 源码 components/format/Price.vue：货币(util) / 整数(num) / 小数(decimal) 三段式 */
function PayFormatPrice({ value }: { value: number | string | undefined }) {
    const { t } = useTranslation();
  const text = formatAmount(value);
  const dot = text.lastIndexOf('.');
  const integer = dot >= 0 ? text.slice(0, dot) : text;
  const decimal = dot >= 0 ? text.slice(dot + 1) : '';
  return (
    <span className="price align-bottom" style={{ display: 'inline-flex', alignItems: 'flex-end', color: 'var(--price, #e01222)', fontSize: 18, lineHeight: 1 }}>
      <span className="util" style={{ marginRight: 2, fontSize: 14 }}>¥</span>
      <span className="num" style={{ fontSize: 18 }}>{integer}</span>
      {decimal ? <span className="num decimal" style={{ fontSize: 18 }}>.{decimal}</span> : null}
    </span>
  );
}

export default function PayChannelClient({ brand }: { brand: Brand }) {
    const { t } = useTranslation();
  const [order, setOrder] = useState<PayOrder>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qr, setQr] = useState('');
  const [payUrl, setPayUrl] = useState('');
  const [expired, setExpired] = useState(false);
  const [isAlipay, setIsAlipay] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<{ timer: ReturnType<typeof setInterval> | null; count: number; inFlight: boolean; finished: boolean }>({
    timer: null,
    count: 0,
    inFlight: false,
    finished: false,
  });
  const brandLabel = BRAND_LABELS[brand];
  /** 源码渠道页扫码文案：微信/支付宝/云闪付 */
  /** 源码 yunpay.vue：标题随 type 变化 */
  const channelTitle = (() => {
    if (brand !== 'yunpay') return '';
    const payType = (new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('type') || 'wechat').toLowerCase();
    return payType === 'alipay' ? t('支付宝支付') : payType === 'yunshanfu' ? t('云闪付') : t('微信支付');
  })();

  const scanTip = (() => {
    if (brand === 'yunpay') {
      const payType = (new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('type') || 'wechat').toLowerCase();
      return payType === 'alipay' ? t('请使用支付宝扫一扫') : payType === 'yunshanfu' ? t('请使用云闪付扫一扫') : t('请使用微信扫一扫');
    }
    return isAlipay ? t('请使用支付宝扫一扫') : t('请使用微信扫一扫');
  })();

  /** 源码 wechat.vue / yunpay.vue：二维码右侧 right-image 渠道示意图，按 brand 文案占位 */
  const rightImageLabel = (() => {
    const payType = (new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('type') || '').toLowerCase();
    if (brand === 'yunpay') {
      if (payType === 'alipay') return t('支付宝');
      if (payType === 'yunshanfu') return t('云闪付');
      return t('微信支付');
    }
    if (isAlipay || brand === 'alipay') return t('支付宝');
    return t('微信支付');
  })();

  const stopPoll = useCallback(() => {
    const state = pollRef.current;
    if (state.timer) clearInterval(state.timer);
    pollRef.current = { timer: null, count: 0, inFlight: false, finished: false };
  }, []);

  /** 支付状态轮询：2s × 50，带 in-flight / finished 去重（源码渠道页口径） */
  const startPoll = useCallback(() => {
    stopPoll();
    const id = new URLSearchParams(window.location.search).get('id');
    pollRef.current.timer = setInterval(async () => {
      const state = pollRef.current;
      if (state.inFlight || state.finished) return;
      state.inFlight = true;
      state.count += 1;
      try {
        const status = await apiGet<number>('order/pay/checkStatus', { id });
        if (Number(status) > 0) {
          state.finished = true;
          stopPoll();
          Toast.success({ content: '支付完成' });
          window.location.href = '/member/order/list';
          return;
        }
      } catch {
        /* 忽略单次异常 */
      } finally {
        pollRef.current.inFlight = false;
      }
      if (pollRef.current.count >= 50 && !pollRef.current.finished) {
        pollRef.current.finished = true;
        stopPoll();
        setExpired(true);
        Toast.error({ content: '支付已超时，您可以刷新页面重新支付' });
      }
    }, 2000);
  }, [stopPoll]);

  const backToPay = useCallback(() => {
    stopPoll();
    const id = new URLSearchParams(window.location.search).get('id') || '';
    if (window.opener) {
      window.close();
      return;
    }
    window.location.href = `/order/pay?id=${id}`;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const query = new URLSearchParams(window.location.search);
    const id = Number(query.get('id') || 0);
    if (!id) {
      setLoading(false);
      setError('缺少订单 ID');
      return;
    }
    if (!localStorage.getItem('accessToken')) {
      const redirect = `${window.location.pathname}${window.location.search}`;
      window.location.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
      return;
    }
    const saleMode = query.get('type') === 'saleMode';
    const payType = brandPayType(brand, query);
    setIsAlipay(payType.toLowerCase().includes('alipay'));

    const createPay = () =>
      (saleMode
        ? apiGet<Record<string, any>>('order/pay/createDepositPayment', { id, type: payType })
        : apiGet<Record<string, any>>('order/pay/create', { id, type: payType, code: 'pc' })) as Promise<Record<string, any>>;

    (async () => {
      try {
        const orderInfo = await apiGet<{ order?: PayOrder }>('order/pay/index', { id }).catch(() => null);
        if (orderInfo?.order) {
          setOrder(orderInfo.order);
          if (orderInfo.order.grouponPromotionRecordId) {
            window.location.replace(`/member/group/info?id=${orderInfo.order.grouponPromotionRecordId}`);
            return;
          }
        }

        const result = await createPay();
        const channel = (result?.payInfo || result || {}) as Record<string, any>;

        if (brand === 'alipay') {
          if (typeof channel.html === 'string' && channel.html) {
            const container = formRef.current;
            if (container) {
              container.innerHTML = channel.html;
              const forms = document.forms;
              forms && forms[0]?.submit();
            }
          } else if (typeof channel.url === 'string' && channel.url) {
            window.location.href = channel.url;
          } else {
            setError('支付信息获取失败，请重试');
          }
          return;
        }

        if (brand === 'paypal') {
          if (typeof channel.url === 'string' && channel.url) {
            window.location.href = channel.url;
            return;
          }
          setError('支付信息获取失败，请重试');
          return;
        }

        if (brand === 'stripe') {
          if (typeof channel.url === 'string' && channel.url) {
            window.location.href = channel.url;
            return;
          }
          if (typeof channel.html === 'string' && channel.html) {
            const container = formRef.current;
            if (container) {
              container.innerHTML = channel.html;
              const forms = document.forms;
              forms && forms[0]?.submit();
            }
            return;
          }
          setError('支付信息获取失败，请重试');
          return;
        }

        // 二维码类渠道
        const cashierUrl = typeof channel.url === 'string' ? channel.url : '';
        const codeUrl = typeof channel.codeUrl === 'string' && channel.codeUrl ? channel.codeUrl : cashierUrl;
        if (brand === 'yeepay') {
          if (cashierUrl) setPayUrl(cashierUrl);
          if (codeUrl) {
            const QRCode = (await import('qrcode')).default;
            setQr(await QRCode.toDataURL(codeUrl, { width: 220, margin: 1 }));
          } else {
            setError('获取支付二维码失败，请刷新重试');
            return;
          }
        } else if (codeUrl) {
          const QRCode = (await import('qrcode')).default;
          setQr(await QRCode.toDataURL(codeUrl, { width: 220, margin: 1 }));
        } else {
          setError('获取支付二维码失败，请刷新重试');
          return;
        }
        startPoll();
      } catch (err) {
        setError(err instanceof Error ? err.message : `${brandLabel}创建失败`);
      } finally {
        setLoading(false);
      }
    })();

    return () => stopPoll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brand]);

  if (brand === 'alipay' || brand === 'paypal' || brand === 'stripe') {
    return (
      <>
        <PayCommonHeader title={brandLabel} />
        <PayLoginHeader />
        <main className="pc-channel-page">
        <Card className="pc-channel-card">
          <h1 className="pc-channel-title">{brandLabel}</h1>
          {loading ? <p className="pc-channel-tip">{t('正在跳转到支付页面...')}</p> : null}
          {error ? (
            <>
              <p className="pc-channel-error">{error}</p>
              <button type="button" className="pc-channel-back" onClick={backToPay}>{t('返回上一步')}</button>
            </>
          ) : null}
          <div ref={formRef} />
        </Card>
        <style>{`.pc-channel-page{max-width:1200px;margin:32px auto;padding:0 20px}.pc-channel-card{text-align:center;padding:40px 24px}.pc-channel-title{font-size:22px;margin:0 0 16px;color:#1a1a1a}.pc-channel-tip{color:#8a919f;font-size:14px}.pc-channel-error{color:#f5222d;font-size:14px;margin:12px 0}.pc-channel-back{margin-top:8px;border:1px solid #dcdcdc;border-radius:6px;background:#fff;padding:8px 18px;cursor:pointer}`}</style>
      </main>
        <PayPageFooter />
      </>
    );
  }

  return (
    <>
      <PayCommonHeader title={brand === 'yunpay' ? channelTitle : brandLabel} />
      <PayLoginHeader />
      <main className="pc-channel-page">
      <div className="pc-channel-shell">
        <div className="pc-channel-message">
          订单提交成功，请尽快付款！订单号：{order.orderSn || '-'}
        </div>
        <div className="pc-channel-message">{t('应付金额：')}<PayFormatPrice value={order.unpaidAmount ?? order.orderAmount} />
        </div>
        <Card className="pc-channel-card">
          <h1 className="pc-channel-title">{brand === 'yunpay' ? channelTitle : brandLabel}</h1>
          <div className="pc-channel-main">
            <div className="pc-channel-left">
              <div className="pc-channel-refresh">{t('如果二维码已过期，点击')}<button type="button" className="pc-channel-link" onClick={() => window.location.reload()}>{t('刷新')}</button>{t('重新获取二维码。')}</div>
              {qr && !expired ? (
                <img className="pc-channel-qr" src={qr} alt={brandLabel} width={220} height={220} />
              ) : expired ? (
                <div className="pc-channel-expired">{t('已超时，')}<button type="button" className="pc-channel-link" onClick={() => window.location.reload()}>{t('点击刷新')}</button>
                </div>
              ) : (
                <Typography.Text type="tertiary">{loading ? t('正在获取二维码...') : error || t('正在获取二维码...')}</Typography.Text>
              )}
              {brand === 'yeepay' && payUrl ? (
                <button type="button" className="pc-channel-cashier" onClick={() => window.open(payUrl, '_blank')}>{t('前往易宝收银台')}</button>
              ) : null}
              <div className="pc-channel-scan">
                <div>{scanTip}</div>
                <div>{t('扫描二维码支付')}</div>
                <div className="pc-channel-other-ways">
                  <button type="button" className="pc-channel-link" onClick={backToPay}>{t('选择其他支付方式')}</button>
                </div>
              </div>
            </div>
            {/* 源码 wechat.vue / yunpay.vue：二维码右侧 right-image 渠道示意图（按 brand 文案占位） */}
            <div className="right-image" style={{ flex: 1, display: 'flex', justifyContent: 'flex-start', alignItems: 'center' }}>
              <div className="image" style={{ width: 270, height: 270, border: '1px dashed #d9d9d9', borderRadius: 12, background: '#fafafa', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#8a919f' }}>
                <span style={{ fontSize: 48 }}>▣</span>
                <span style={{ fontSize: 16, fontWeight: 600, color: '#555' }}>{rightImageLabel}</span>
                <span style={{ fontSize: 12 }}>{t('扫码支付示意图')}</span>
              </div>
            </div>
          </div>
          <button type="button" className="pc-channel-other" onClick={backToPay}>
            &lt; 选择其他支付方式
          </button>
        </Card>
      </div>
      <style>{`.pc-channel-page{background:#f7f8fa;min-height:100vh;padding:24px 0}.pc-channel-shell{max-width:1000px;margin:0 auto;padding:0 20px}.pc-channel-message{color:#1a1a1a;font-size:14px;margin-bottom:10px}.pc-channel-price{color:var(--price);font-size:18px}.pc-channel-card{margin-top:16px;padding:28px}.pc-channel-title{font-size:20px;font-weight:600;margin:0 0 16px;color:#1a1a1a}.pc-channel-main{display:flex}.pc-channel-left{flex:1}.pc-channel-refresh{color:#333;font-size:14px;margin-bottom:14px}.pc-channel-link{border:0;background:transparent;color:var(--pc-primary);cursor:pointer;font-size:14px;padding:0 2px}.pc-channel-qr{display:block;width:220px;height:220px;object-fit:contain;margin:8px 0 16px}.pc-channel-expired{color:#8a919f;font-size:14px;margin:24px 0}.pc-channel-cashier{margin:8px 0 12px;border:0;border-radius:4px;background:var(--pc-primary);color:#fff;padding:9px 18px;font-size:14px;cursor:pointer}.pc-channel-scan{color:#666;font-size:14px;line-height:22px}.pc-channel-other{margin-top:18px;border:0;background:transparent;color:var(--pc-primary);font-size:14px;cursor:pointer;padding:0}`}</style>
      </main>
      <PayPageFooter />
    </>
  );
}

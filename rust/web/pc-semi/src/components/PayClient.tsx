'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Radio, RadioGroup, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

type PaymentMethod = string | { type?: string; name?: string; typeName?: string };

interface PayInfo {
  order?: {
    orderId?: number;
    orderSn?: string;
    unpaidAmount?: number | string;
    payTypeId?: number;
  };
  paymentList?: PaymentMethod[];
  offlinePaymentList?: Record<string, unknown>;
}

const CHANNEL_LABELS: Record<string, string> = {
  alipay: '支付宝',
  wechat: '微信支付',
  wxpay: '微信支付',
  paypal: 'PayPal',
  stripe: 'Stripe',
  xendit: 'Xendit',
  antom: 'Antom',
};

function normalizePaymentMethods(list: PaymentMethod[] | undefined): Array<{ type: string; label: string }> {
  return (list || [])
    .map((item) => {
      if (typeof item === 'string') {
        return { type: item, label: CHANNEL_LABELS[item.toLowerCase()] || item };
      }
      const type = String(item?.type || '');
      return { type, label: item?.name || item?.typeName || CHANNEL_LABELS[type.toLowerCase()] || type };
    })
    .filter((item) => item.type);
}

interface ChannelResult {
  payInfo?: Record<string, any>;
  orderId?: number;
  orderSn?: string;
  orderAmount?: number | string;
  [key: string]: any;
}

export default function PayClient({ orderId }: { orderId: number }) {
  const [info, setInfo] = useState<PayInfo | null>(null);
  const [payType, setPayType] = useState('');
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);
  const [qr, setQr] = useState('');
  const [qrTips, setQrTips] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
        setPayType(normalizePaymentMethods(result.paymentList)[0]?.type || '');
      })
      .catch((error) => Toast.error({ content: error instanceof Error ? error.message : '订单支付信息加载失败' }))
      .finally(() => setLoading(false));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [orderId]);

  const stopPoll = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  };

  const startPoll = () => {
    stopPoll();
    pollRef.current = setInterval(async () => {
      try {
        const status = await apiGet<number>('order/pay/checkStatus', { id: orderId });
        if (Number(status) > 0) {
          stopPoll();
          Toast.success({ content: '支付成功' });
          window.location.href = `/member/order/detail?id=${orderId}`;
        }
      } catch {
        /* 轮询失败不打断 */
      }
    }, 3000);
  };

  const showQr = async (url: string, tips: string) => {
    const QRCode = (await import('qrcode')).default;
    const dataUrl = await QRCode.toDataURL(url, { width: 260, margin: 1 });
    setQr(dataUrl);
    setQrTips(tips);
    startPoll();
  };

  const pay = async () => {
    setPaying(true);
    try {
      const result = await apiGet<ChannelResult>('order/pay/create', { id: orderId, type: payType, code: 'pc' });
      const channel = (result?.payInfo || result || {}) as Record<string, any>;

      // 支付宝 PC/WAP：后端返回自动提交表单 HTML
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

      // 微信 Native / 通用二维码
      const codeUrl = channel.codeUrl || channel.qrCode || channel.qr_code;
      if (typeof codeUrl === 'string' && codeUrl) {
        await showQr(codeUrl, channel.payType === 'wechat' ? '请使用微信扫码支付' : '请扫码支付');
        return;
      }

      // 微信 H5 / Stripe / PayPal / Xendit / Antom 跳转
      const redirectUrl = channel.h5Url || channel.url || channel.payUrl || channel.normalUrl;
      if (typeof redirectUrl === 'string' && redirectUrl.startsWith('http')) {
        window.location.href = redirectUrl;
        return;
      }

      // 微信 JSAPI / 小程序：在微信内置浏览器调起
      if (channel.appId && channel.paySign && channel.package) {
        const invoke = () => {
          const bridge = (window as any).WeixinJSBridge;
          if (!bridge) {
            Toast.error({ content: '请在微信客户端内打开后支付' });
            return;
          }
          bridge.invoke('getBrandWCPayRequest', {
            appId: channel.appId,
            timeStamp: channel.timeStamp,
            nonceStr: channel.nonceStr,
            package: channel.package,
            signType: channel.signType || 'RSA',
            paySign: channel.paySign,
          }, (res: any) => {
            if (res?.err_msg === 'get_brand_wcpay_request:ok') {
              Toast.success({ content: '支付成功' });
              window.location.href = `/member/order/detail?id=${orderId}`;
            } else {
              Toast.error({ content: '支付未完成' });
            }
          });
        };
        if ((window as any).WeixinJSBridge) invoke();
        else document.addEventListener('WeixinJSBridgeReady', invoke, { once: true });
        return;
      }

      // Apple Pay 面板参数
      if (channel.applePay) {
        Toast.info({ content: 'Apple Pay 支付参数已生成，请在支持 Apple Pay 的浏览器完成支付' });
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

  if (loading) return <Card className="cart-state">订单支付信息加载中...</Card>;

  const order = info?.order || {};
  return (
    <div className="pc-pay">
      <Card className="pc-pay__card">
        <div className="pc-pay__success">订单已成功提交，请完成付款</div>
        <div className="pc-pay__amount">
          <span>需支付</span>
          <b>¥ {Number(order.unpaidAmount || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2 })}</b>
        </div>
        <div className="pc-pay__order">
          <span>订单号</span>
          <b>{order.orderSn || '-'}</b>
        </div>

        {info?.paymentList?.length ? (
          <div className="pc-pay__methods">
            <div className="pc-pay__label">支付方式</div>
            <RadioGroup value={payType} onChange={(value) => setPayType(String(value))}>
              {normalizePaymentMethods(info.paymentList).map((method) => (
                <Radio key={method.type} value={method.type}>
                  {method.label}
                </Radio>
              ))}
            </RadioGroup>
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
          <Button theme="solid" type="primary" size="large" loading={paying} disabled={!payType || !!qr} onClick={pay}>
            立即支付
          </Button>
          <Link href="/member/order/list">
            <Button size="large">查看订单</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

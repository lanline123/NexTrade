'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface DepositSetting { rechargeId: number; money?: number | string; discountMoney?: number | string; }
const PAY_LABELS: Record<string, string> = {
  wechat: '微信支付',
  alipay: '支付宝',
  paypal: 'PayPal',
  yabanpayWechat: '微信支付（亚伴）',
  yabanpayAlipay: '支付宝（亚伴）',
  yunpayWechat: '微信支付（云付）',
  yunpayAlipay: '支付宝（云付）',
  lakalaWechat: '微信支付（拉卡拉）',
  lakalaAlipay: '支付宝（拉卡拉）',
};

export default function DepositClient() {
  const [settings, setSettings] = useState<DepositSetting[]>([]);
  const [payList, setPayList] = useState<string[]>([]);
  const [selected, setSelected] = useState(-1);
  const [amount, setAmount] = useState('');
  const [payType, setPayType] = useState('wechat');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [qr, setQr] = useState('');
  const [orderId, setOrderId] = useState(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Promise.all([
      apiGet<DepositSetting[]>('user/rechargeOrder/setting').catch(() => []),
      apiGet<string[]>('user/rechargeOrder/paymentList').catch(() => []),
    ]).then(([list, payments]) => {
      setSettings(Array.isArray(list) ? list : []);
      setPayList((Array.isArray(payments) ? payments : []).filter((item) => item !== 'applepay'));
      setPayType((Array.isArray(payments) ? payments : []).filter((item) => item !== 'applepay')[0] || 'wechat');
    }).finally(() => setLoading(false));
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const chosenAmount = (() => {
    if (selected < 0) return Number(amount);
    const item = settings[selected];
    if (!item) return 0;
    return Number(item.money || amount);
  })();

  const submit = async () => {
    if (!agreed) return Toast.error({ content: '请先阅读并勾选服务协议' });
    if (!chosenAmount || chosenAmount <= 0) return Toast.error({ content: '请输入正确的充值金额' });
    if (!payType) return Toast.error({ content: '请选择支付方式' });
    setSubmitting(true);
    try {
      const item = selected >= 0 ? settings[selected] : null;
      const created: any = await apiPost('user/rechargeOrder/update', {
        id: item?.rechargeId || 0,
        amount: chosenAmount,
        money: chosenAmount,
        payType,
      });
      const id = Number(created?.orderId || created?.id || 0);
      if (!id) throw new Error('创建充值订单失败');
      setOrderId(id);
      const payResult: any = await apiPost('user/rechargeOrder/create', { id, type: payType });
      const info = payResult?.payInfo || payResult || {};

      if (payType === 'alipay' || payType.endsWith('Alipay')) {
        if (typeof info.html === 'string' && info.html.includes('<form')) {
          const div = document.createElement('div');
          div.innerHTML = info.html;
          document.body.appendChild(div);
          (div.querySelector('form') as HTMLFormElement | null)?.submit();
          return;
        }
      }
      const codeUrl = info.codeUrl || info.qrCode || info.qr_code || '';
      if (codeUrl) {
        const QRCode = (await import('qrcode')).default;
        setQr(await QRCode.toDataURL(codeUrl, { width: 260, margin: 1 }));
        startPoll(id);
        return;
      }
      const redirect = info.h5Url || info.url || info.payUrl || '';
      if (typeof redirect === 'string' && redirect.startsWith('http')) {
        window.location.href = redirect;
        return;
      }
      Toast.info({ content: '支付通道已受理' });
      startPoll(id);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '充值失败' });
    } finally {
      setSubmitting(false);
    }
  };

  const startPoll = (id: number) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const result: any = await apiGet('user/rechargeOrder/checkStatus', { id });
        if (Number(result?.payStatus) === 1) {
          if (pollRef.current) clearInterval(pollRef.current);
          Toast.success({ content: '充值成功' });
          window.location.href = '/member/account/log';
        }
      } catch { /* ignore */ }
    }, 2500);
  };

  return (
    <Card className="member-card deposit-card" loading={loading}>
      <h2>选择充值金额</h2>
      <div className="deposit-grid">
        {settings.map((item, index) => (
          <button key={item.rechargeId} type="button" className={selected === index ? 'is-active' : ''} onClick={() => { setSelected(index); setAmount(String(item.money || '')); }}>
            <b>¥ {Number(item.money || 0).toFixed(2)}</b>
            {Number(item.discountMoney || 0) > 0 ? <span>赠 ¥ {Number(item.discountMoney).toFixed(2)}</span> : null}
          </button>
        ))}
        <button type="button" className={selected === -1 ? 'is-active' : ''} onClick={() => setSelected(-1)}>
          <input value={amount} onChange={(event) => { setSelected(-1); setAmount(event.target.value); }} placeholder="自定义金额" inputMode="decimal" />
          <span>自定义金额</span>
        </button>
      </div>

      <h2>选择支付方式</h2>
      <div className="deposit-pay-list">
        {payList.map((type) => (
          <label key={type} className={payType === type ? 'is-active' : ''}>
            <input type="radio" name="payType" checked={payType === type} onChange={() => setPayType(type)} />
            {PAY_LABELS[type] || type}
          </label>
        ))}
      </div>

      <label className="deposit-agreement">
        <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
        本人此操作将视为同意并接受《余额服务协议》
      </label>

      <div className="deposit-actions">
        <span>充值金额：<b>¥ {Number(chosenAmount || 0).toFixed(2)}</b></span>
        <Button theme="solid" type="primary" size="large" loading={submitting} onClick={() => void submit()}>提交申请</Button>
      </div>

      {qr ? (
        <div className="deposit-qr">
          <p>订单号：{orderId}，请扫码支付</p>
          <img src={qr} alt="支付二维码" width={260} height={260} />
          <Button onClick={() => { setQr(''); if (pollRef.current) clearInterval(pollRef.current); }}>取消</Button>
        </div>
      ) : null}
    </Card>
  );
}

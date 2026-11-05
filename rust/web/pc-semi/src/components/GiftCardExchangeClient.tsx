'use client';

import { useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '@/lib/client-api';

export default function GiftCardExchangeClient() {
  const [cardNumber, setCardNumber] = useState('');
  const [cardPassword, setCardPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Record<string, any> | null>(null);

  const submit = async () => {
    if (!cardNumber.trim() || !cardPassword.trim()) return Toast.error({ content: '请输入卡号和卡密' });
    setLoading(true);
    setResult(null);
    try {
      const data = await apiPost<Record<string, any>>('promotion/giftCardGroups/exchange', {
        cardNumber: cardNumber.trim(),
        cardPassword: cardPassword.trim(),
      });
      setResult(data || {});
      Toast.success({ content: '兑换成功' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '兑换失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="member-card giftcard-exchange" loading={loading}>
      <h2>礼品卡兑换</h2>
      <p className="giftcard-exchange__hint">请输入礼品卡卡号与卡密，兑换成功后可在订单或账户中查看。</p>
      <div className="security-form">
        <label>卡号</label>
        <input value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} placeholder="请输入礼品卡卡号" />
        <label>卡密</label>
        <input value={cardPassword} onChange={(event) => setCardPassword(event.target.value)} placeholder="请输入礼品卡卡密" type="password" />
        <Button theme="solid" type="primary" loading={loading} onClick={() => void submit()}>立即兑换</Button>
      </div>
      {result ? (
        <div className="giftcard-exchange__result">
          <h3>兑换成功</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      ) : null}
    </Card>
  );
}

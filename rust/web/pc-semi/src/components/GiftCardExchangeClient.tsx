'use client';

/**
 * 礼品卡兑换（对照旧版 `member/giftCard/exchange.vue`）。
 *
 * - 输入卡号、卡密兑换；储值卡兑换后自动充值到余额，兑换卡返回 flowType 后进入订单结算；
 * - 兑换成功后：有 `exchangeProductToCart.flowType` → `/order/check?flowType=...`，
 *   否则 → `/member/account/detail`（与旧版一致）。
 */
import { useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '@/lib/client-api';

export default function GiftCardExchangeClient() {
  const [cardNumber, setCardNumber] = useState('');
  const [cardPassword, setCardPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!cardNumber.trim() || !cardPassword.trim()) {
      Toast.error({ content: '请输入卡号和卡密' });
      return;
    }
    setLoading(true);
    try {
      const data = await apiPost<Record<string, any>>('promotion/giftCardGroups/exchange', {
        cardNumber: cardNumber.trim(),
        cardPassword: cardPassword.trim(),
      });
      Toast.success({ content: '兑换成功' });
      const flowType = data?.exchangeProductToCart?.flowType;
      if (flowType) {
        window.location.href = `/order/check?flowType=${flowType}`;
      } else {
        window.location.href = '/member/account/detail';
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '兑换失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="member-card giftcard-exchange" loading={loading}>
      <h2>礼品卡兑换</h2>
      <div className="security-form">
        <label>卡号</label>
        <input value={cardNumber} onChange={(event) => setCardNumber(event.target.value)} placeholder="请输入卡号" />
        <label>卡密</label>
        <input value={cardPassword} onChange={(event) => setCardPassword(event.target.value)} placeholder="请输入卡密" type="password" />
        <Button theme="solid" type="primary" loading={loading} onClick={() => void submit()}>立即兑换</Button>
      </div>
      <div className="giftcard-exchange__rules" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid #f2f4f7', color: '#667085', fontSize: 13, lineHeight: 2 }}>
        <div style={{ fontWeight: 600, color: '#344054', marginBottom: 6 }}>兑换规则</div>
        <p style={{ margin: 0 }}>1. 储值卡输入卡密进行兑换将自动充值到余额。</p>
        <p style={{ margin: 0 }}>2. 兑换卡输入卡密进行兑换后将跳转至该商品详情页进行兑换。</p>
      </div>
    </Card>
  );
}

'use client';

import { useState } from 'react';
import { Button, Toast } from '@douyinfe/semi-ui';
import { apiPost } from '@/lib/client-api';

export default function GiftCardClaimClient({ giftCardSn, isExchange, status }: { giftCardSn: string; isExchange?: string; status?: number }) {
  const [loading, setLoading] = useState(false);
  const claimed = String(isExchange) === '1' || Number(status) === 1;

  const claim = async () => {
    setLoading(true);
    try {
      await apiPost('promotion/giftCardGroups/claim', { giftCardSn });
      Toast.success({ content: '领取成功' });
      window.location.reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '领取失败' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="giftcard-claim">
      <Button theme="solid" type="primary" size="large" disabled={claimed} loading={loading} onClick={() => void claim()}>
        {claimed ? '已领取' : '立即领取'}
      </Button>
      <span>领取后可在礼品卡兑换中使用</span>
    </div>
  );
}

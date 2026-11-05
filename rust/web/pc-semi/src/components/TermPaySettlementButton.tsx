'use client';

/**
 * 账期支付 - 结算账号按钮
 * 源码对照：member/termPay/list.vue「结算账号」按钮 + src/SettlementDialog.vue
 */
import { useState } from 'react';
import { Button } from '@douyinfe/semi-ui';
import SettlementDialog from '@/components/SettlementDialog';

export default function TermPaySettlementButton() {
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Button theme="solid" type="primary" onClick={() => setVisible(true)}>结算账号</Button>
      <SettlementDialog visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

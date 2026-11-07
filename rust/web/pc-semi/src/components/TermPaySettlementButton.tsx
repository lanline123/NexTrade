'use client';

/**
 * 账期支付 - 结算账号按钮
 * 源码对照：member/termpay/list.vue「结算账号」按钮 + src/SettlementDialog.vue
 */
import { useState } from 'react';
import { Button } from '@douyinfe/semi-ui';
import SettlementDialog from '@/components/SettlementDialog';

import { useTranslation } from 'react-i18next';
export default function TermPaySettlementButton() {
    const { t } = useTranslation();
  const [visible, setVisible] = useState(false);
  return (
    <>
      <Button theme="solid" type="primary" onClick={() => setVisible(true)}>{t('结算账号')}</Button>
      <SettlementDialog visible={visible} onClose={() => setVisible(false)} />
    </>
  );
}

'use client';

/**
 * 结算账号弹窗
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/termpay/src/SettlementDialog.vue
 * - 读取 order/pay/index 的 offlinePaymentList，按后台开启的汇款方式分 Tab
 * - 展示对应汇款账户说明（HTML 富文本）
 */
import { useEffect, useState } from 'react';
import { Button, Modal } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
type OfflineKey = 'thirdPartyPaymentTransfer' | 'offlinePayBank' | 'offlinePayCompany' | 'otherPaymentRemittance';

const TAB_LABEL: Record<OfflineKey, string> = {
  thirdPartyPaymentTransfer: '第三方支付转账',
  offlinePayBank: '银行汇款',
  offlinePayCompany: '企业汇款',
  otherPaymentRemittance: '其他汇款方式',
};

const TAB_ORDER: OfflineKey[] = ['thirdPartyPaymentTransfer', 'offlinePayBank', 'offlinePayCompany', 'otherPaymentRemittance'];

export default function SettlementDialog({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const [list, setList] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<OfflineKey | ''>('');

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    apiGet<{ offlinePaymentList?: Record<string, string> }>('order/pay/index')
      .then((result) => {
        const raw = (result?.offlinePaymentList || {}) as Record<string, string>;
        setList(raw);
        const first = TAB_ORDER.find((key) => key in raw) || '';
        setActive(first);
      })
      .catch(() => setList({}))
      .finally(() => setLoading(false));
  }, [visible]);

  const available = TAB_ORDER.filter((key) => key in list);

  return (
    <Modal
      title={t('结算账号')}
      visible={visible}
      onCancel={onClose}
      footer={<Button onClick={onClose}>{t('关闭')}</Button>}
      width={680}
    >
      {loading ? <div style={{ color: '#8c8c8c' }}>{t('加载中...')}</div> : null}
      {!loading && !available.length ? (
        <div style={{ color: '#8c8c8c' }}>{t('暂无可用汇款账户，请联系客服。')}</div>
      ) : null}
      {available.length ? (
        <>
          <div className="settlement-tabs">
            {available.map((key) => (
              <button
                key={key}
                type="button"
                className={active === key ? 'is-active' : ''}
                onClick={() => setActive(key)}
              >
                {TAB_LABEL[key]}
              </button>
            ))}
          </div>
          <div className="settlement-content">
            {active ? (
              <div dangerouslySetInnerHTML={{ __html: String(list[active] || '') }} />
            ) : null}
          </div>
        </>
      ) : null}
    </Modal>
  );
}

import { useEffect, useState } from 'react';
import { Button, Modal, Typography } from '@douyinfe/semi-ui';
import { IconInfoCircle } from '@douyinfe/semi-icons';
import { apiGet } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface LicensedInfo {
  isLicensed?: number;
  license?: string;
  licensedTypeName?: string;
  authorizedDomain?: string;
  expirationTime?: string;
  version?: string;
}

export default function LicensedBadge() {
  const { t } = useI18n();
  const [info, setInfo] = useState<LicensedInfo | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    apiGet<LicensedInfo>('/setting/licensed/index')
      .then((result) => setInfo(result || null))
      .catch(() => undefined);
  }, []);

  if (!info || Number(info.isLicensed) !== 1 || !info.license) return null;

  return (
    <>
      <Button
        icon={<IconInfoCircle />}
        theme="borderless"
        className="icon-btn"
        title={t('授权信息')}
        onClick={() => setVisible(true)}
      />
      <Modal title={t('授权信息')} visible={visible} onCancel={() => setVisible(false)} footer={null} width={480}>
        <div className="licensed-info">
          <div><Text type="tertiary">{t('授权类型')}</Text><span>{info.licensedTypeName || '-'}</span></div>
          <div><Text type="tertiary">{t('授权域名')}</Text><span>{info.authorizedDomain || '-'}</span></div>
          <div><Text type="tertiary">{t('到期时间')}</Text><span>{info.expirationTime || '-'}</span></div>
          <div><Text type="tertiary">{t('系统版本')}</Text><span>{info.version || '-'}</span></div>
          <div><Text type="tertiary">{t('授权码')}</Text><span className="licensed-code">{info.license}</span></div>
        </div>
      </Modal>
    </>
  );
}

/**
 * 授权信息页（LicensedPage）：对应原版 views/setting/licensed/Index.vue + Info.vue（授权码弹窗）。
 *
 * - GET /setting/licensed/index  读取授权信息（license / licensedType / isEnterprise / deCopyright / authorizedDomain）
 * - POST /setting/licensed/saveLicensed 保存授权码
 * - POST /setting/licensed/update 保存版权相关字段
 *
 * Rust 后端为“无授权”桩实现（index 固定返回未授权对象、写接口 no-op），
 * 页面按原版契约编写，运行时表现与后端实现形态一致。
 */

import { useEffect, useState } from 'react';
import { Button, Card, Input, Modal, Spin, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

interface LicensedInfo {
  license?: string;
  isLicensed?: number;
  isEnterprise?: number;
  deCopyright?: number;
  licensedType?: string;
  licensedTypeName?: string;
  authorizedDomain?: string;
  releaseTime?: string;
  expirationTime?: string;
  version?: string;
  poweredBy?: number;
  poweredByStatus?: number;
  versionInfoHidden?: number;
  shopCompany?: string;
}

const ENTERPRISE_TEXT: Record<number, string> = {
  1: '企业版',
  0: '标准版',
  [-1]: '未授权',
};

export default function LicensedPage() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [info, setInfo] = useState<LicensedInfo>({});
  const [licenseInput, setLicenseInput] = useState('');
  const [licenseVisible, setLicenseVisible] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<LicensedInfo>('/setting/licensed/index')
      .then((data) => setInfo(data || {}))
      .catch((error) => Toast.error({ content: error?.message || t('加载授权信息失败') }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const isAuthorized = Boolean(info.license);

  const submitLicense = async () => {
    if (!licenseInput.trim()) {
      Toast.warning({ content: t('请输入授权码!') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/setting/licensed/saveLicensed', { license: licenseInput.trim() });
      Toast.success({ content: t('操作成功') });
      setLicenseVisible(false);
      setLicenseInput('');
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <Spin spinning={loading}>
        <Card title={t('授权信息')} style={{ maxWidth: 760 }}>
          <div className="licensed-form">
            <div className="licensed-row">
              <label>{t('授权码：')}</label>
              <div className="licensed-license-box">
                <div className="licensed-license-text">{info.license || '--'}</div>
                <Button
                  theme="solid"
                  type="primary"
                  onClick={() => setLicenseVisible(true)}
                >
                  {isAuthorized ? t('重新输入授权码') : t('输入授权码')}
                </Button>
              </div>
            </div>
            <div className="licensed-row">
              <label>{t('授权类型：')}</label>
              <span>{info.licensedTypeName || info.licensedType || '--'}</span>
            </div>
            <div className="licensed-row">
              <label>{t('授权版本：')}</label>
              <span>{ENTERPRISE_TEXT[Number(info.isEnterprise)] ?? '--'}</span>
            </div>
            <div className="licensed-row">
              <label>{t('是否去版权：')}</label>
              <span style={Number(info.deCopyright) === 1 ? { color: 'var(--semi-color-success)' } : undefined}>
                {Number(info.deCopyright) === 1 ? t('已去版权') : t('否')}
              </span>
            </div>
            <div className="licensed-row">
              <label>{t('授权域名：')}</label>
              <span style={info.authorizedDomain ? { color: 'var(--semi-color-success)' } : undefined}>
                {info.authorizedDomain || t('无')}
              </span>
            </div>
            {info.expirationTime ? (
              <div className="licensed-row">
                <label>{t('到期时间：')}</label>
                <span>{info.expirationTime}</span>
              </div>
            ) : null}
            {info.version ? (
              <div className="licensed-row">
                <label>{t('系统版本：')}</label>
                <span>{info.version}</span>
              </div>
            ) : null}
          </div>
        </Card>
      </Spin>

      <Modal
        title={t('授权码')}
        visible={licenseVisible}
        onCancel={() => setLicenseVisible(false)}
        onOk={submitLicense}
        okButtonProps={{ loading: saving }}
        closeOnEsc
        maskClosable={false}
        width={560}
      >
        <div style={{ margin: '12px 0' }}>
          <div style={{ marginBottom: 8 }}>{t('授权码：')}</div>
          <Input
            mode="password"
            placeholder={t('请输入授权码!')}
            value={licenseInput}
            onChange={(next) => setLicenseInput(next)}
          />
        </div>
      </Modal>
    </div>
  );
}

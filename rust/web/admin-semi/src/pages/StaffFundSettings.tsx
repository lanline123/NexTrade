import { useEffect, useState } from 'react';
import { Button, TextArea, Toast } from '@douyinfe/semi-ui';
import { IconSetting } from '@douyinfe/semi-icons';
import SettingsCard from '../components/SettingsCard';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const TITLES: Record<string, string> = {
  deliveryFundManagement: '配送设置',
  serverFundManagement: '服务设置',
};

interface StaffFundSettingsProps {
  apiPath: 'deliveryFundManagement' | 'serverFundManagement';
}

/** 配送员/服务员资金设置：后端为自由 schema 配置，旧版即原始 JSON 编辑器。 */
export default function StaffFundSettings({ apiPath }: StaffFundSettingsProps) {
  const { t } = useI18n();
  const title = t(TITLES[apiPath] || apiPath);
  const [json, setJson] = useState('{}');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<Record<string, unknown>>(`/finance/${apiPath}/settings/detail`)
      .then((data) => setJson(JSON.stringify(data ?? {}, null, 2)))
      .catch((error) => Toast.error({ content: error instanceof Error ? error.message : t('加载失败') }))
      .finally(() => setLoading(false));
  };

  useEffect(load, [apiPath]);

  const save = async () => {
    let data: Record<string, unknown>;
    try {
      data = JSON.parse(json || '{}');
    } catch {
      Toast.error({ content: t('JSON 格式错误') });
      return;
    }
    setSaving(true);
    try {
      await apiPost(`/finance/${apiPath}/settings/save`, data);
      Toast.success({ content: t('保存成功') });
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="config-page">
      <SettingsCard
        icon={<IconSetting />}
        title={title}
        description={t('配送员/服务员资金接口配置。')}
        count={t('{count} 项', { count: 1 })}
      >
        <div className="config-field">
          <label>{t('配置 JSON')}</label>
          <div>
            <TextArea
              value={json}
              rows={18}
              spellCheck={false}
              onChange={(next) => setJson(next)}
            />
            <p className="config-field__help">
              {t('保存前请确认 JSON 格式合法。接口：')}/finance/{apiPath}/settings/detail
            </p>
          </div>
        </div>
      </SettingsCard>

      <div className="config-actions">
        <Button theme="solid" type="primary" loading={saving} onClick={save}>
          {t('保存')}
        </Button>
      </div>
    </div>
  );
}

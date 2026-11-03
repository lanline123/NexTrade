import { useEffect, useState } from 'react';
import { Button, Card, Radio, RadioGroup, Switch, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

/** 客服接入规则：对应旧版 im/accessSetting/Index.vue，接口 /im/shopKefuConfig/accessConfig/*。 */
const { Text } = Typography;
export default function KefuAccessSettings() {
  const { t } = useI18n();
  const [formState, setFormState] = useState<Record<string, number>>({
    autoAccessMode: 0,
    returnCustomerAccess: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGet<Record<string, number>>('/im/shopKefuConfig/accessConfig/detail')
      .then((result) => setFormState((current) => ({ ...current, ...(result || {}) })))
      .catch((error) => Toast.error({ content: error.message }))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiPost('/im/shopKefuConfig/accessConfig/save', formState);
      Toast.success({ content: t('操作成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card shadows="hover" loading={loading}>
      <div className="kefu-access-form">
        <Text strong>{t('接入规则')}</Text>
        <div className="kefu-access-field">
          <label>{t('选择接入方式')}</label>
          <RadioGroup
            value={formState.autoAccessMode}
            onChange={(event) => setFormState((c) => ({ ...c, autoAccessMode: Number(event.target.value) }))}
          >
            <Radio value={0}>{t('全部自动接入')}</Radio>
            <Radio value={1}>{t('全部手动接入')}</Radio>
          </RadioGroup>
          <p className="kefu-access-extra">
            {Number(formState.autoAccessMode) === 0
              ? t('客户发起会话时，自动分配给在线客服中接待数最少的客服')
              : t('客户发起会话进入待接入列表，由客服在工作台手动接入')}
          </p>
        </div>
        <div className="kefu-access-field">
          <label>{t('回头客接入')}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Switch
              checked={Number(formState.returnCustomerAccess) === 1}
              onChange={(next) => setFormState((c) => ({ ...c, returnCustomerAccess: next ? 1 : 0 }))}
            />
            <span className="kefu-access-extra">
              {Number(formState.returnCustomerAccess) === 1
                ? t('已开启，上次接待客服在线时优先接入给上次接待客服')
                : t('已关闭')}
            </span>
          </div>
        </div>
        <Button theme="solid" type="primary" loading={saving} onClick={save}>
          {t('提 交')}
        </Button>
      </div>
    </Card>
  );
}

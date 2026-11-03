import { useEffect, useState } from 'react';
import { Button, Card, Input, Radio, RadioGroup, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

/** 认证设置：对应旧版 setting/config/base/src/AuthenticationSettings.vue，接口 /setting/config/authSettings + saveAuth。
 * 旧版已注释下线的字段（state 仍透传）：isEnquiry 是否开启询价功能、bulkPurchase 商品规格显示批量采购。 */
const { Text } = Typography;
export default function UserAuthenticationSettings() {
  const { t } = useI18n();
  const [formState, setFormState] = useState<Record<string, any>>({
    closeAuth: 0,
    type: 0,
    isIdentity: 0,
    smsNote: 0,
    tips: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiGet<Record<string, any>>('/setting/config/authSettings')
      .then((result) => setFormState((current) => ({ ...current, ...(result || {}) })))
      .catch((error) => Toast.error({ content: error.message }))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await apiPost('/setting/config/saveAuth', formState);
      Toast.success({ content: t('修改成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const authClosed = Number(formState.closeAuth) === 0;

  return (
    <Card shadows="hover" loading={loading}>
      <div className="auth-settings-form">
        <Text strong>{t('会员认证设置')}</Text>
        <div className="auth-settings-field">
          <label>{t('会员认证')}</label>
          <RadioGroup
            value={formState.closeAuth}
            onChange={(event) => setFormState((c) => ({ ...c, closeAuth: Number(event.target.value) }))}
          >
            <Radio value={0}>{t('关闭')}</Radio>
            <Radio value={1}>{t('开启')}</Radio>
          </RadioGroup>
        </div>
        <div className="auth-settings-field">
          <label>{t('认证类型')}</label>
          <RadioGroup
            value={formState.type}
            disabled={authClosed}
            onChange={(event) => setFormState((c) => ({ ...c, type: Number(event.target.value) }))}
          >
            <Radio value={1}>{t('企业认证')}</Radio>
            <Radio value={0}>{t('个人认证 + 企业认证')}</Radio>
          </RadioGroup>
        </div>
        <div className="auth-settings-field">
          <label>{t('是否实名后才能查看价格')}</label>
          <RadioGroup
            value={formState.isIdentity}
            disabled={authClosed}
            onChange={(event) => setFormState((c) => ({ ...c, isIdentity: Number(event.target.value) }))}
          >
            <Radio value={1}>{t('开启')}</Radio>
            <Radio value={0}>{t('关闭')}</Radio>
          </RadioGroup>
          <p className="auth-settings-extra">
            {t('开启后，前台商城的商品价格需要用户实名认证之后才能查看。')}
          </p>
        </div>
        <div className="auth-settings-field">
          <label>{t('是否短信通知')}</label>
          <RadioGroup
            value={formState.smsNote}
            onChange={(event) => setFormState((c) => ({ ...c, smsNote: Number(event.target.value) }))}
          >
            <Radio value={1}>{t('开启')}</Radio>
            <Radio value={0}>{t('关闭')}</Radio>
          </RadioGroup>
        </div>
        <div className="auth-settings-field">
          <label>{t('审核周期')}</label>
          <Input
            style={{ width: 260 }}
            value={formState.tips ?? ''}
            onChange={(next) => setFormState((c) => ({ ...c, tips: next }))}
          />
        </div>
        <Button theme="solid" type="primary" loading={saving} onClick={save}>
          {t('提 交')}
        </Button>
      </div>
    </Card>
  );
}

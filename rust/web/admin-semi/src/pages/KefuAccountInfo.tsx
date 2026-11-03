import { useEffect, useState } from 'react';
import { Button, Card, Input, Tabs, Toast, Typography } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import ImageUploader from '../components/ImageUploader';

const { Text } = Typography;

/** 客服账户信息：对应旧版 authority/accountEditing/Index.vue（个人信息 + API Token），接口 /authority/adminUser/*。 */
export default function KefuAccountInfo() {
  const { t } = useI18n();
  const [formState, setFormState] = useState<Record<string, string>>({
    username: '',
    mobile: '',
    email: '',
    avatar: '',
    id: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadInfo = () => {
    setLoading(true);
    apiGet<any>('/authority/adminUser/mineDetail')
      .then((result) => {
        setFormState({
          id: String(result?.id ?? ''),
          username: String(result?.username ?? result?.adminUser?.username ?? ''),
          mobile: String(result?.mobile ?? result?.adminUser?.mobile ?? ''),
          email: String(result?.email ?? ''),
          avatar: String(result?.avatar ?? result?.adminUser?.avatar ?? ''),
        });
      })
      .catch((error) => Toast.error({ content: error.message }))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveInfo = async () => {
    if (!String(formState.username || '').trim()) {
      Toast.error({ content: t('管理员名称不能为空') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/authority/adminUser/modifyManageAccounts', { ...formState });
      Toast.success({ content: t('修改成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card shadows="hover" loading={loading}>
      <Tabs type="line">
        <Tabs.TabPane tab={t('个人信息')} itemKey="info">
          <div className="kefu-account-form">
            <label>{t('管理员名称')}</label>
            <Input
              style={{ width: 320 }}
              value={formState.username}
              onChange={(next) => setFormState((c) => ({ ...c, username: next }))}
            />
            <label>{t('手机号')}</label>
            <Input
              style={{ width: 320 }}
              value={formState.mobile}
              onChange={(next) => setFormState((c) => ({ ...c, mobile: next }))}
            />
            <label>{t('用户头像')}</label>
            <ImageUploader
              single
              value={formState.avatar ? [formState.avatar] : []}
              onChange={(urls) => setFormState((c) => ({ ...c, avatar: urls[0] || '' }))}
              max={1}
            />
            <label>{t('邮箱')}</label>
            <Input
              style={{ width: 320 }}
              value={formState.email}
              onChange={(next) => setFormState((c) => ({ ...c, email: next }))}
            />
            <div>
              <Button theme="solid" type="primary" loading={saving} onClick={saveInfo}>
                {t('保存')}
              </Button>
            </div>
          </div>
        </Tabs.TabPane>
        <Tabs.TabPane tab="API Token" itemKey="apiToken">
          <Text type="tertiary">
            {t('API Token 的生成/吊销能力位于管理员列表（/authority/adminUser/apiToken/*），请前往 权限 → 管理员 → 管理员列表 操作。')}
          </Text>
        </Tabs.TabPane>
      </Tabs>
    </Card>
  );
}

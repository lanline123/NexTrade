import { useEffect, useState } from 'react';
import { IconMapPin, IconSetting, IconUser } from '@douyinfe/semi-icons';
import SettingsCard from '../components/SettingsCard';
import {
  Button,
  Radio,
  RadioGroup,
  Space,
  Spin,
  Switch,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const { Text, Title } = Typography;

interface StoreEntryRuleData {
  entryMode?: number; // 1: 模式一(显示当前门店,可切换), 2: 模式二(不可切换), 3: 模式三(显示当前定位/收货地址,可切换), 4: 模式四(不可切换)
  firstEntry?: number; // 1: 按规则进店, 2: 按指定门店访问, 3: 不参与进店
  closestStoreEnabled?: number; // 进入同城配送范围内距离最近的门店
  specifiedStoreId?: number;
}

export function StoreEntryRuleSetting() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<StoreEntryRuleData>({
    entryMode: 1,
    firstEntry: 1,
    closestStoreEnabled: 1,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet<StoreEntryRuleData>('/setting/config/storeEntryRuleSettings');
      if (res && typeof res === 'object') {
        setFormState((prev) => ({ ...prev, ...res }));
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载配置失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await apiPost('/setting/config/saveStoreEntryRule', formState);
      Toast.success({ content: t('修改成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div className="config-page">
      <SettingsCard icon={<IconMapPin />} title={t('进店模式')} description={t('配置买家进入门店的方式。')} count={t('{count} 项', { count: 4 })}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RadioGroup
            value={formState.entryMode}
            onChange={(e) => setFormState({ ...formState, entryMode: Number(e.target.value) })}
            direction="vertical"
          >
            <Radio value={1} style={{ marginBottom: 12 }}>
              <Space vertical align="start">
                <Text strong>{t('模式一：显示当前门店（可切换门店）')}</Text>
                <Text type="tertiary" size="small">
                  {t('页面顶部显示当前门店名称，支持点击切换到其他门店下单。')}
                </Text>
              </Space>
            </Radio>
            <Radio value={2} style={{ marginBottom: 12 }}>
              <Space vertical align="start">
                <Text strong>{t('模式二：显示当前门店（不可切换门店）')}</Text>
                <Text type="tertiary" size="small">
                  {t('页面顶部仅显示当前门店名称，不支持切换到其他门店。')}
                </Text>
              </Space>
            </Radio>
            <Radio value={3} style={{ marginBottom: 12 }}>
              <Space vertical align="start">
                <Text strong>{t('模式三：显示当前定位/收货地址（可切换门店）')}</Text>
                <Text type="tertiary" size="small">
                  {t('页面顶部显示当前定位或收货地址，支持点击切换门店。')}
                </Text>
              </Space>
            </Radio>
            <Radio value={4}>
              <Space vertical align="start">
                <Text strong>{t('模式四：显示当前定位/收货地址（不可切换门店）')}</Text>
                <Text type="tertiary" size="small">
                  {t('页面顶部仅显示当前定位或收货地址，不支持切换到其他门店。')}
                </Text>
              </Space>
            </Radio>
          </RadioGroup>
        </div>
      </SettingsCard>

      <SettingsCard icon={<IconUser />} title={t('首次进店')} description={t('首次进入时的门店匹配规则。')} count={t('{count} 项', { count: 3 })}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RadioGroup
            value={formState.firstEntry}
            onChange={(e) => setFormState({ ...formState, firstEntry: Number(e.target.value) })}
            direction="vertical"
          >
            <Radio value={1} style={{ marginBottom: 12 }}>
              <Space vertical align="start">
                <Text strong>{t('按规则进店')}</Text>
                <Text type="tertiary" size="small">
                  {t('系统按规则自动为用户匹配一家门店，消费者只交易门店商品。')}
                </Text>
              </Space>
            </Radio>
            <Radio value={2} style={{ marginBottom: 12 }}>
              <Space vertical align="start">
                <Text strong>{t('按指定门店访问')}</Text>
                <Text type="tertiary" size="small">
                  {t('用户将直接进入唯一指定门店，是否支持切换其他门店可通过上方进店模式配置。')}
                </Text>
              </Space>
            </Radio>
            <Radio value={3}>
              <Space vertical align="start">
                <Text strong>{t('不参与进店')}</Text>
                <Text type="tertiary" size="small">
                  {t('用户先进入品牌主页，在主页选择业务（自提、外卖、堂食、快递）后再进入合适的门店。')}
                </Text>
              </Space>
            </Radio>
          </RadioGroup>
        </div>
      </SettingsCard>

      <SettingsCard icon={<IconSetting />} title={t('规则')} description={t('总部进店的门店推荐规则。')} count={t('{count} 项', { count: 1 })}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <Text strong>{t('买家从总部进店：进入同城配送范围内距离最近的门店')}</Text>
              <div style={{ marginTop: 4 }}>
                <Text type="tertiary" size="small">
                  {t('启用后，买家通过扫码、点击链接、搜索小程序，系统将自动推荐总部所管理的可配送范围内距离买家最近的一家门店。禁用后，则跳过本层级直接从下一级推荐进店。')}
                </Text>
              </div>
            </div>
            <Switch
              checked={formState.closestStoreEnabled === 1}
              onChange={(checked) =>
                setFormState({ ...formState, closestStoreEnabled: checked ? 1 : 0 })
              }
            />
          </div>
        </div>
      </SettingsCard>

      <div className="config-actions">
        <Button theme="solid" type="primary" loading={saving} onClick={handleSubmit}>
          {t('提交')}
        </Button>
      </div>
    </div>
  );
}

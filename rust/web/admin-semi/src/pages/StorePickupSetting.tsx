import { useEffect, useState } from 'react';
import { IconClock, IconMapPin } from '@douyinfe/semi-icons';
import SettingsCard from '../components/SettingsCard';
import {
  Button,
  Form,
  Input,
  InputNumber,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Switch,
  TimePicker,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface PickupSettingData {
  pickupEnabled?: number;
  stockingStatus?: number;
  pickupTimeStatus?: number;
  pickupEndStatus?: number;
  pickupValidHours?: number;
  pickupTimeSlotStart?: string;
  pickupTimeSlotEnd?: string;
}

export function StorePickupSetting() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formState, setFormState] = useState<PickupSettingData>({
    pickupEnabled: 1,
    stockingStatus: 0,
    pickupTimeStatus: 1,
    pickupEndStatus: 0,
    pickupValidHours: 24,
    pickupTimeSlotStart: '09:00',
    pickupTimeSlotEnd: '21:00',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet<PickupSettingData>('/o2o/shopPickupConfig/getShopPickupTpl');
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
      await apiPost('/o2o/shopPickupConfig/saveShopPickupTpl', formState);
      Toast.success({ content: t('保存成功') });
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
      <SettingsCard icon={<IconMapPin />} title={t('基础设置')} description={t('到店自提与自动备货规则。')} count={t('{count} 项', { count: 2 })}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Text strong style={{ width: 140 }}>{t('到店自提')}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Switch
                checked={formState.pickupEnabled === 1}
                onChange={(checked) =>
                  setFormState({ ...formState, pickupEnabled: checked ? 1 : 0 })
                }
              />
              <Text>{formState.pickupEnabled === 1 ? t('已启用') : t('已关闭')}</Text>
            </div>
          </div>
          <div style={{ marginLeft: 156 }}>
            <Text type="tertiary" size="small">
              {t('启用后，买家下单可选择到店自提，可选择自提点进行提货。')}
            </Text>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
            <Text strong style={{ width: 140 }}>{t('完成备货')}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Switch
                checked={formState.stockingStatus === 1}
                onChange={(checked) =>
                  setFormState({ ...formState, stockingStatus: checked ? 1 : 0 })
                }
              />
              <Text>{t('开启系统自动完成备货')}</Text>
            </div>
          </div>
          <div style={{ marginLeft: 156 }}>
            <Text type="tertiary" size="small">
              {t('针对预售自提订单，实际完成自动备货的时间为预售开始发货时间和自动备货时间中较晚的时间。')}
            </Text>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard icon={<IconClock />} title={t('自提时间')} description={t('买家自提时间段与提货有效期。')} count={t('{count} 项', { count: 3 })}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Text strong style={{ width: 140 }}>{t('自提时间')}</Text>
              <RadioGroup
                value={formState.pickupTimeStatus}
                onChange={(e) =>
                  setFormState({ ...formState, pickupTimeStatus: Number(e.target.value) })
                }
              >
                <Radio value={0}>{t('不开启')}</Radio>
                <Radio value={1}>{t('需要买家选择自提时间')}</Radio>
                <Radio value={2}>{t('不展示提货时间')}</Radio>
              </RadioGroup>
            </div>
            <div style={{ marginLeft: 156, marginTop: 6 }}>
              <Text type="tertiary" size="small">
                {t('买家下单选择到店自提，必须要选择自提时间，卖家需要按约定时间备货。')}
              </Text>
            </div>
          </div>

          {formState.pickupTimeStatus === 1 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <Text strong style={{ width: 140 }}>{t('自提时间段')}</Text>
                <Space align="center">
                  <Text>{t('每天')}</Text>
                  <Input
                    style={{ width: 120 }}
                    placeholder={t('开始时间')}
                    value={formState.pickupTimeSlotStart}
                    onChange={(val) => setFormState({ ...formState, pickupTimeSlotStart: val })}
                  />
                  <Text>{t('至')}</Text>
                  <Input
                    style={{ width: 120 }}
                    placeholder={t('结束时间')}
                    value={formState.pickupTimeSlotEnd}
                    onChange={(val) => setFormState({ ...formState, pickupTimeSlotEnd: val })}
                  />
                </Space>
              </div>
            </div>
          )}

          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <Text strong style={{ width: 140 }}>{t('提货有效期')}</Text>
              <Space align="center">
                <InputNumber
                  style={{ width: 140 }}
                  min={1}
                  placeholder={t('请输入提货有效期')}
                  value={formState.pickupValidHours}
                  onChange={(val) =>
                    setFormState({ ...formState, pickupValidHours: Number(val) || 24 })
                  }
                />
                <Text>{t('小时')}</Text>
              </Space>
            </div>
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

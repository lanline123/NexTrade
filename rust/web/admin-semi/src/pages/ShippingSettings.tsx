import { useEffect, useState } from 'react';
import { Button, Input, Radio, RadioGroup, Toast, Typography } from '@douyinfe/semi-ui';
import { IconMapPin, IconSend, IconServer } from '@douyinfe/semi-icons';
import SettingsCard from '../components/SettingsCard';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';

const { Text } = Typography;

interface ShippingSettings {
  defaultLogisticsName?: string;
  logisticsProvider?: number;
  kdniaoApiKey?: string;
  kdniaoBusinessId?: string;
  kuaidi100Key?: string;
  kuaidi100Secret?: string;
  kuaidi100Customer?: string;
  sender?: string;
  mobile?: string;
  provinceName?: string;
  cityName?: string;
  areaName?: string;
  address?: string;
  receiveSender?: string;
  receiveMobile?: string;
  receiveProvinceName?: string;
  receiveCityName?: string;
  receiveAreaName?: string;
  receiveAddress?: string;
}

const initial: ShippingSettings = {
  defaultLogisticsName: '商家配送',
  logisticsProvider: 1,
};

export default function ShippingSettingsPage() {
  const { t } = useI18n();
  const [form, setForm] = useState<ShippingSettings>(initial);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    apiGet<ShippingSettings>('/setting/config/shippingSettings')
      .then((result) => setForm({ ...initial, ...(result || {}) }))
      .catch((error) => Toast.error({ content: error instanceof Error ? error.message : t('加载失败') }))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof ShippingSettings, value: string | number) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    if (!form.defaultLogisticsName?.trim()) {
      Toast.warning({ content: t('自定义名称不能为空') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/setting/config/saveShipping', form);
      Toast.success({ content: t('保存成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const isKdniao = Number(form.logisticsProvider) !== 2;

  const field = (label: string, key: keyof ShippingSettings, placeholder = '') => (
    <div className="config-field">
      <label>{label}</label>
      <Input
        value={(form[key] as string) || ''}
        placeholder={placeholder}
        onChange={(value) => update(key, value)}
      />
    </div>
  );

  return (
    <div className="config-page">
      <SettingsCard
        icon={<IconSend />}
        title={t('快递发货设置')}
        description={t('设置默认配送方式名称。')}
        count={t('{count} 项', { count: 1 })}
      >
        <div className="config-field">
          <label>{t('自定义名称')}</label>
          <div>
            <Input
              value={form.defaultLogisticsName || ''}
              maxLength={10}
              onChange={(value) => update('defaultLogisticsName', value)}
            />
            <Text type="tertiary" size="small">
              {t('该名称会显示在买家可选择的配送方式中，默认名称“商家配送”')}
            </Text>
          </div>
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<IconServer />}
        title={t('快递接口设置')}
        description={t('配置快递鸟或快递100查询接口。')}
        count={t('{count} 项', { count: isKdniao ? 3 : 4 })}
      >
        <div className="config-field">
          <label>{t('快递接口')}</label>
          <RadioGroup
            value={form.logisticsProvider || 1}
            onChange={(event) => update('logisticsProvider', Number(event.target.value))}
          >
            <Radio value={1}>{t('快递鸟')}</Radio>
            <Radio value={2}>{t('快递100')}</Radio>
          </RadioGroup>
        </div>
        {isKdniao ? (
          <>
            {field(t('快递鸟 API Key'), 'kdniaoApiKey')}
            {field(t('快递鸟服务 ID'), 'kdniaoBusinessId')}
          </>
        ) : (
          <>
            {field('Key', 'kuaidi100Key')}
            {field('Secret', 'kuaidi100Secret')}
            {field('Customer', 'kuaidi100Customer')}
          </>
        )}
      </SettingsCard>

      <SettingsCard
        icon={<IconMapPin />}
        title={t('发货信息设置')}
        description={t('发货人信息与默认发货地址。')}
        count={t('{count} 项', { count: 6 })}
      >
        <div className="config-grid">
          {field(t('发货人'), 'sender')}
          {field(t('发货人联系方式'), 'mobile')}
          {field(t('发货地省份'), 'provinceName')}
          {field(t('发货城市'), 'cityName')}
          {field(t('发货地区'), 'areaName')}
          {field(t('发货详细地址'), 'address')}
        </div>
      </SettingsCard>

      <SettingsCard
        icon={<IconMapPin />}
        title={t('退货信息设置')}
        description={t('退货收件人信息与默认退货地址。')}
        count={t('{count} 项', { count: 6 })}
      >
        <div className="config-grid">
          {field(t('退货人'), 'receiveSender')}
          {field(t('退货人联系方式'), 'receiveMobile')}
          {field(t('退货省份'), 'receiveProvinceName')}
          {field(t('退货城市'), 'receiveCityName')}
          {field(t('退货地区'), 'receiveAreaName')}
          {field(t('退货详细地址'), 'receiveAddress')}
        </div>
      </SettingsCard>

      <div className="config-actions">
        <Button theme="solid" type="primary" loading={saving || loading} onClick={save}>
          {t('保存')}
        </Button>
      </div>
    </div>
  );
}

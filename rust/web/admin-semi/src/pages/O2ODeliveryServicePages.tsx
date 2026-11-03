import { useEffect, useState } from 'react';
import {
  Banner,
  Button,
  Card,
  InputNumber,
  Radio,
  RadioGroup,
  Switch,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { useI18n } from '../i18n';
import './premium-o2o-settings.css';

const { Text } = Typography;

/* ==================================================================
   同城配送 / 上门服务 ×2（intraCityDeliveryManage / homeServiceManage）

   无 5.8.57 旧 Vue 源码；契约来源（双交叉验证）：
   1. 旧版前端 API/类型（java/view/admin/src/api/setting/intraCityDelivery.ts、
      homeService.ts 与 types/setting/intraCityDelivery.d.ts、homeService.d.ts）；
   2. 5.8.60 o2o_admin 打包产物（D:/tigshop/前端页面/5.8.60/o2o_admin/admin/assets）：
      - intraCityDeliveryManage → Index-DxS6HNBh.js + DeliverySettingsTab-CpxMLPEz.js
        + intraCityDelivery-CfD3lDKf.js（API chunk）
      - homeServiceManage → Index-BP1Dj6g3.js + serviceStaffConfig-Dd4b5rVi.js（API chunk）

   Rust 端点核对：
   - /o2o/intraCityDelivery/platformConfig/getConfig（GET，lowfreq_extra.rs h_12，
     cfg_get! o2oIntraCityDeliveryConfig）与
     /o2o/intraCityDelivery/platformConfig/saveConfig（POST h_13，cfg_set!）；
     另有门店级 /o2o/localDelivery/getConfig（o2o/local_delivery.rs，仅 GET）。
   - /o2o/homeService/getConfig（GET，o2o/home_service.rs，读 shop_home_service_config 表）
     与 /o2o/homeService/saveConfig（POST，lowfreq_extra.rs h_10，cfg_set!
     o2oHomeServiceConfig 写 config 表）——读写存储不一致，见 spec backendReady。
================================================================== */

/* ==================================================================
   1. 同城配送（IntraCityDelivery / intraCityDeliveryManage）
   平台同城配送总控：IntraCityPlatformConfig
   intraCityDeliveryEnabled / intraCitySelfDeliveryEnabled /
   intraCityThirdPartyDeliveryEnabled（0/1）
================================================================== */
interface IntraCityPlatformConfig {
  intraCityDeliveryEnabled?: number;
  intraCitySelfDeliveryEnabled?: number;
  intraCityThirdPartyDeliveryEnabled?: number;
}

const DEFAULT_INTRA_CITY: IntraCityPlatformConfig = {
  intraCityDeliveryEnabled: 1,
  intraCitySelfDeliveryEnabled: 1,
  intraCityThirdPartyDeliveryEnabled: 0,
};

export function IntraCityDelivery() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<IntraCityPlatformConfig>(DEFAULT_INTRA_CITY);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<IntraCityPlatformConfig>('/o2o/intraCityDelivery/platformConfig/getConfig')
      .then((res) => {
        if (alive && res) setConfig({ ...DEFAULT_INTRA_CITY, ...res });
      })
      .catch((error) =>
        alive && Toast.error({ content: error instanceof Error ? error.message : t('加载配置失败') }),
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const handleSave = async () => {
    // 5.8.60 校验：商家自配送、第三方配送至少启用一项
    if (Number(config.intraCitySelfDeliveryEnabled) !== 1 && Number(config.intraCityThirdPartyDeliveryEnabled) !== 1) {
      Toast.error({ content: t('商家自配送、第三方配送至少启用一项') });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/o2o/intraCityDelivery/platformConfig/saveConfig', {
        intraCityDeliveryEnabled: Number(config.intraCityDeliveryEnabled) === 1 ? 1 : 0,
        intraCitySelfDeliveryEnabled: Number(config.intraCitySelfDeliveryEnabled) === 1 ? 1 : 0,
        intraCityThirdPartyDeliveryEnabled: Number(config.intraCityThirdPartyDeliveryEnabled) === 1 ? 1 : 0,
      });
      Toast.success({ content: t('修改成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pmo-page">
      <Card shadows="hover" className="table-card" loading={loading} title={t('同城配送')}>
        <div className="pmo-form">
          <div className="pmo-section">
            <div className="pmo-section-title">{t('同城配送功能')}</div>
            <div className="pmo-switch-row">
              <Switch
                aria-label={t('同城配送功能')}
                checked={Number(config.intraCityDeliveryEnabled) === 1}
                onChange={(checked) => setConfig({ ...config, intraCityDeliveryEnabled: checked ? 1 : 0 })}
              />
              <Tag color={Number(config.intraCityDeliveryEnabled) === 1 ? 'green' : 'grey'}>
                {Number(config.intraCityDeliveryEnabled) === 1 ? t('已开启') : t('已关闭')}
              </Tag>
            </div>
            <div className="pmo-help">{t('买家下单支持同城配送，商家可自行配送')}</div>
          </div>

          <div className="pmo-section">
            <div className="pmo-section-title">{t('配送设置')}</div>
            <div className="pmo-option-block">
              <div className="pmo-switch-row">
                <Switch
                  aria-label={t('启用商家自配送')}
                  checked={Number(config.intraCitySelfDeliveryEnabled) === 1}
                  onChange={(checked) => setConfig({ ...config, intraCitySelfDeliveryEnabled: checked ? 1 : 0 })}
                />
                <span className="pmo-option-name">{t('商家自配送')}</span>
              </div>
              <div className="pmo-help">
                {t('启用商家自配送：平台启用后，商家同城配送订单，可选用平台已配置的任意配送渠道完成发货。')}
              </div>
            </div>
            <div className="pmo-option-block">
              <div className="pmo-switch-row">
                <Switch
                  aria-label={t('启用第三方配送')}
                  checked={Number(config.intraCityThirdPartyDeliveryEnabled) === 1}
                  onChange={(checked) => setConfig({ ...config, intraCityThirdPartyDeliveryEnabled: checked ? 1 : 0 })}
                />
                <span className="pmo-option-name">{t('第三方配送')}</span>
              </div>
              <div className="pmo-help">
                {t('启用第三方配送：开启后，将由第三方物流进行配送，配送产生的费用，将在门店余额中进行扣除。')}
              </div>
              <div className="pmo-help">
                {t('第三方配送管理：请先在第三方配送管理中开启至少一个物流商；第三方配送管理中暂无已开启的物流商，已取消启用第三方配送。')}
              </div>
            </div>
          </div>

          <div className="pmo-section">
            <div className="pmo-section-title">{t('自营门店配送')}</div>
            <div className="pmo-help">
              {t('平台自营门店信息与配送配置由「门店设置」（setting/config/storeSelfOperatedSettings）维护，门店级同城配送参数（配送半径/起送价/基础运费/距离溢价）在 /o2o/localDelivery/getConfig 按门店配置。')}
            </div>
          </div>

          <div>
            <Button theme="solid" type="primary" loading={saving} onClick={handleSave}>
              {t('提交')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ==================================================================
   2. 上门服务（HomeService / homeServiceManage）
   ShopHomeServiceConfigDetailVO / SaveParam：
   enabled / serviceRadius / homeFee / distancePricingEnabled / orderDispatchMode
   (1-抢单模式, 2-手动派单) / beforeServicePhotoEnabled / afterServicePhotoEnabled /
   distancePricingList[{ distanceThreshold, distanceUnit, additionalFee, sortOrder }]
================================================================== */
interface DistancePricingRule {
  distanceThreshold: number | string;
  distanceUnit: number | string;
  additionalFee: number | string;
  sortOrder?: number;
}

interface HomeServiceConfig {
  enabled?: number;
  serviceRadius?: number | string;
  homeFee?: number | string;
  distancePricingEnabled?: number;
  orderDispatchMode?: number;
  beforeServicePhotoEnabled?: number;
  afterServicePhotoEnabled?: number;
  distancePricingList?: DistancePricingRule[];
}

const DEFAULT_HOME_SERVICE: HomeServiceConfig = {
  enabled: 0,
  serviceRadius: 5,
  homeFee: 0,
  distancePricingEnabled: 0,
  orderDispatchMode: 1,
  beforeServicePhotoEnabled: 0,
  afterServicePhotoEnabled: 0,
  distancePricingList: [],
};

const toRuleNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isNaN(num) ? fallback : num;
};

export function HomeService() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<HomeServiceConfig>(DEFAULT_HOME_SERVICE);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<HomeServiceConfig>('/o2o/homeService/getConfig')
      .then((res) => {
        if (alive && res) {
          setConfig({
            ...DEFAULT_HOME_SERVICE,
            ...res,
            distancePricingList: Array.isArray(res.distancePricingList) ? res.distancePricingList : [],
          });
        }
      })
      .catch((error) =>
        alive && Toast.error({ content: error instanceof Error ? error.message : t('加载配置失败') }),
      )
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const updateRule = (index: number, patch: Partial<DistancePricingRule>) => {
    setConfig((prev) => {
      const list = (prev.distancePricingList || []).slice();
      list[index] = { ...list[index], ...patch };
      return { ...prev, distancePricingList: list };
    });
  };

  const addRule = () => {
    setConfig((prev) => {
      const list = prev.distancePricingList || [];
      if (list.length >= 10) {
        Toast.error({ content: t('最多只能添加10条收费规则') });
        return prev;
      }
      return {
        ...prev,
        distancePricingList: [...list, { distanceThreshold: '', distanceUnit: '', additionalFee: '' }],
      };
    });
  };

  const removeRule = (index: number) => {
    setConfig((prev) => ({
      ...prev,
      distancePricingList: (prev.distancePricingList || []).filter((_, i) => i !== index),
    }));
  };

  /** 校验对齐 5.8.60 Index-BP1Dj6g3.js 的提示文案 */
  const validate = (): string | null => {
    const list = config.distancePricingList || [];
    if (Number(config.distancePricingEnabled) === 1) {
      if (list.length < 1) return t('开启叠加溢价时，至少需要添加一条溢价规则');
      let previous = -Infinity;
      for (let index = 0; index < list.length; index += 1) {
        const rule = list[index];
        const threshold = toRuleNumber(rule.distanceThreshold, Number.NaN);
        const unit = toRuleNumber(rule.distanceUnit, Number.NaN);
        const fee = toRuleNumber(rule.additionalFee, Number.NaN);
        if (rule.distanceThreshold === '' || Number.isNaN(threshold) || threshold === 0) return t('请输入距离，距离不能为空或为0');
        if (index > 0 && threshold <= previous) return t('距离值必须大于前一条规则的值');
        const nextRaw = index < list.length - 1 ? list[index + 1].distanceThreshold : '';
        if (nextRaw !== '' && nextRaw !== undefined && nextRaw !== null && threshold >= toRuleNumber(nextRaw, Infinity)) {
          return t('距离值必须小于后一条规则的值');
        }
        previous = threshold;
        if (rule.distanceUnit === '' || Number.isNaN(unit) || unit === 0) return t('请输入距离单位，距离单位不能为空或为0');
        if (rule.additionalFee === '' || Number.isNaN(fee) || fee === 0) return t('请输入附加费用，附加费用不能为空或为0');
      }
    }
    return null;
  };

  const handleSave = async () => {
    const error = validate();
    if (error) {
      Toast.error({ content: error });
      return;
    }
    setSaving(true);
    try {
      await apiPost('/o2o/homeService/saveConfig', {
        enabled: Number(config.enabled) === 1 ? 1 : 0,
        serviceRadius: toRuleNumber(config.serviceRadius),
        homeFee: toRuleNumber(config.homeFee),
        distancePricingEnabled: Number(config.distancePricingEnabled) === 1 ? 1 : 0,
        orderDispatchMode: Number(config.orderDispatchMode) === 2 ? 2 : 1,
        beforeServicePhotoEnabled: Number(config.beforeServicePhotoEnabled) === 1 ? 1 : 0,
        afterServicePhotoEnabled: Number(config.afterServicePhotoEnabled) === 1 ? 1 : 0,
        distancePricingList: (config.distancePricingList || []).map((rule, index) => ({
          distanceThreshold: toRuleNumber(rule.distanceThreshold),
          distanceUnit: toRuleNumber(rule.distanceUnit),
          additionalFee: toRuleNumber(rule.additionalFee),
          sortOrder: index + 1,
        })),
      });
      Toast.success({ content: t('修改成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const pricingColumns = [
    {
      title: t('超过（公里）'),
      width: 160,
      render: (_: unknown, rule: DistancePricingRule, index: number) => (
        <InputNumber
          style={{ width: 120 }}
          min={0}
          placeholder={t('请输入距离')}
          value={rule.distanceThreshold === '' ? undefined : toRuleNumber(rule.distanceThreshold)}
          onChange={(next) => updateRule(index, { distanceThreshold: next === null || next === undefined ? '' : Number(next) })}
        />
      ),
    },
    {
      title: t('每增加（公里）'),
      width: 160,
      render: (_: unknown, rule: DistancePricingRule, index: number) => (
        <InputNumber
          style={{ width: 120 }}
          min={0}
          placeholder={t('请输入距离单位')}
          value={rule.distanceUnit === '' ? undefined : toRuleNumber(rule.distanceUnit)}
          onChange={(next) => updateRule(index, { distanceUnit: next === null || next === undefined ? '' : Number(next) })}
        />
      ),
    },
    {
      title: t('服务费增加（元）'),
      width: 170,
      render: (_: unknown, rule: DistancePricingRule, index: number) => (
        <InputNumber
          style={{ width: 120 }}
          min={0}
          placeholder={t('请输入附加费用')}
          value={rule.additionalFee === '' ? undefined : toRuleNumber(rule.additionalFee)}
          onChange={(next) => updateRule(index, { additionalFee: next === null || next === undefined ? '' : Number(next) })}
        />
      ),
    },
    {
      title: t('操作'),
      width: 90,
      render: (_: unknown, __: DistancePricingRule, index: number) => (
        <Button theme="borderless" type="danger" size="small" onClick={() => removeRule(index)}>
          {t('删除')}
        </Button>
      ),
    },
  ] as any;

  return (
    <div className="pmo-page">
      <Banner
        fullMode={false}
        type="warning"
        bordered
        icon={null}
        closeIcon={null}
        title={t('读写存储说明（backendReady）')}
        description={t('GET /o2o/homeService/getConfig 读取门店配置表（shop_home_service_config），POST /o2o/homeService/saveConfig 暂写平台配置记录（o2oHomeServiceConfig），后端读写目标尚未统一；保存后再次拉取可能不回显，待后端补齐写表逻辑。')}
      />
      <Card shadows="hover" className="table-card" loading={loading} title={t('上门服务')}>
        <div className="pmo-form">
          <div className="pmo-section">
            <div className="pmo-section-title">{t('上门服务功能')}</div>
            <div className="pmo-switch-row">
              <Switch
                aria-label={t('上门服务功能')}
                checked={Number(config.enabled) === 1}
                onChange={(checked) => setConfig({ ...config, enabled: checked ? 1 : 0 })}
              />
              <Tag color={Number(config.enabled) === 1 ? 'green' : 'grey'}>
                {Number(config.enabled) === 1 ? t('已开启') : t('已关闭')}
              </Tag>
            </div>
            <div className="pmo-help">{t('买家下单支持上门服务，门店服务人员可上门服务')}</div>
          </div>

          <div className="pmo-section">
            <div className="pmo-section-title">{t('发单模式设置')}</div>
            <div className="pmo-form-row">
              <span className="pmo-form-label">{t('发单模式：')}</span>
              <RadioGroup
                value={Number(config.orderDispatchMode) === 2 ? 2 : 1}
                onChange={(e) => setConfig({ ...config, orderDispatchMode: Number(e.target.value) })}
              >
                <Radio value={1}>{t('抢单模式')}</Radio>
                <Radio value={2}>{t('手动派单')}</Radio>
              </RadioGroup>
            </div>
            <div className="pmo-help">{t('抢单模式：客户预约的订单，将在抢单大厅保留，由服务人员手动抢单进行服务')}</div>
          </div>

          <div className="pmo-section">
            <div className="pmo-section-title">{t('服务信息设置')}</div>
            <div className="pmo-form-row">
              <span className="pmo-form-label">{t('服务方：')}</span>
              <span>{t('门店服务人员（门店地址以门店信息为准）')}</span>
            </div>
            <div className="pmo-form-row">
              <span className="pmo-form-label">{t('服务半径：')}</span>
              <InputNumber
                style={{ width: 140 }}
                min={1}
                max={100}
                value={toRuleNumber(config.serviceRadius)}
                onChange={(next) => setConfig({ ...config, serviceRadius: Number(next ?? 0) })}
              />
              <span className="pmo-unit">{t('公里')}</span>
            </div>
            <div className="pmo-help">
              {t('服务区域以门店为中心设置服务半径，若要修改地址，请前往门店设置--门店信息进行编辑修改；收货地址在服务范围之外的买家将不可下单。')}
            </div>
          </div>

          <div className="pmo-section">
            <div className="pmo-section-title">{t('上门价格')}</div>
            <div className="pmo-form-row">
              <span className="pmo-form-label">{t('上门服务费：')}</span>
              <InputNumber
                style={{ width: 140 }}
                min={0}
                placeholder={t('请输入上门费')}
                value={toRuleNumber(config.homeFee)}
                onChange={(next) => setConfig({ ...config, homeFee: Number(next ?? 0) })}
              />
              <span className="pmo-unit">{t('元')}</span>
            </div>
            <div className="pmo-help">{t('商家未设置叠加溢价规则时，则所有订单统一上门服务费标准')}</div>
            <div className="pmo-switch-row" style={{ marginTop: 12 }}>
              <Switch
                aria-label={t('开启叠加溢价')}
                checked={Number(config.distancePricingEnabled) === 1}
                onChange={(checked) => setConfig({ ...config, distancePricingEnabled: checked ? 1 : 0 })}
              />
              <span className="pmo-option-name">{t('开启叠加溢价')}</span>
            </div>
            <div className="pmo-help">{t('商家可按服务半径设置叠加溢价规则，最终费用 = 上门费 + 溢价规则附加费')}</div>
            {Number(config.distancePricingEnabled) === 1 ? (
              <div className="pmo-pricing-block">
                <div className="pmo-section-title">{t('溢价规则')}</div>
                <Table
                  dataSource={config.distancePricingList || []}
                  rowKey={(row?: DistancePricingRule) =>
                    `${row?.distanceThreshold ?? 'x'}-${row?.distanceUnit ?? 'x'}`}
                  columns={pricingColumns}
                  pagination={false}
                  empty={t('暂无数据')}
                />
                <div style={{ marginTop: 8 }}>
                  <Button icon={<IconPlus />} onClick={addRule}>
                    {t('添加收费规则')}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="pmo-section">
            <div className="pmo-section-title">{t('拍照要求')}</div>
            <div className="pmo-option-block">
              <div className="pmo-switch-row">
                <Switch
                  aria-label={t('服务开始拍照')}
                  checked={Number(config.beforeServicePhotoEnabled) === 1}
                  onChange={(checked) => setConfig({ ...config, beforeServicePhotoEnabled: checked ? 1 : 0 })}
                />
                <span className="pmo-option-name">{t('服务开始拍照')}</span>
              </div>
              <div className="pmo-help">{t('开启后服务人员开始服务时需要拍照上传服务前照片')}</div>
            </div>
            <div className="pmo-option-block">
              <div className="pmo-switch-row">
                <Switch
                  aria-label={t('服务完成拍照')}
                  checked={Number(config.afterServicePhotoEnabled) === 1}
                  onChange={(checked) => setConfig({ ...config, afterServicePhotoEnabled: checked ? 1 : 0 })}
                />
                <span className="pmo-option-name">{t('服务完成拍照')}</span>
              </div>
              <div className="pmo-help">{t('开启后服务人员完成订单需拍照上传服务完成后照片')}</div>
            </div>
          </div>

          <div>
            <Button theme="solid" type="primary" loading={saving} onClick={handleSave}>
              {t('提交')}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

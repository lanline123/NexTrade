import type { ReactNode } from 'react';
import { Checkbox } from '@douyinfe/semi-ui';
import { useI18n } from '../i18n';
import AutoConfigPage, {
  type ConfigControlType,
  type ConfigFieldRule,
  type ConfigRendererContext,
} from './AutoConfigPage';

type Translate = (key: string) => string;

type ConfigOption = { label: string; value: string | number; color?: string };

// 勾选"商品默认审核通过"时 shopProductNeedCheck=0（免审核），不勾选=1（需审核）。
function InvertedCheckbox({
  field,
  label,
  value,
  update,
}: ConfigRendererContext & { field: string; label: string }) {
  const { t } = useI18n();
  return (
    <Checkbox checked={Number(value) === 0} onChange={(next) => update(field, next ? 0 : 1)}>
      {t(label)}
    </Checkbox>
  );
}

const invertedCheckRenderer = (field: string, label: string) =>
  (context: ConfigRendererContext) => <InvertedCheckbox {...context} field={field} label={label} />;

/**
 * 满足 store/adminPages/storeSetting/settingStore.vue 契约：
 * props: maxRecommendProductCount, maxSubAdministrator, storePostAllocationStatus,
 * storeIndependentGoods, shopProductNeedCheck, storeAssignProductName, storeAssignProductImage,
 * storeAssignProductPrice, storeUseSoloProductStock, storeUseTotalProductStock,
 * storeAssignDeliveryServiceFee, storeAssignServerServiceFee, storeCustomSubmitShippingType,
 * storeShowOtherCityStore
 *
 * labels:
 * 推荐商品数量, 最大管理员数, 商品分配后状态, 上架, 下架, 门店独立商品, 允许门店自建商品,
 * 门店商品审核, 商品默认审核通过, 分配商品名称, 门店可修改商品名称, 分配商品主图、详情页,
 * 门店可修改商品主图、详情页, 分配商品价格, 使用总部/区域统一售价, 使用门店独立售价,
 * 库存模式, 使用门店独立库存, 使用平台库存, 分配商品配送费规则, 使用总部统一配置,
 * 使用门店独立配置, 分配商品服务费规则, 客户下单配送方式, 自提优先, 配送优先, 同城优先,
 * 显示地区其他门店, 显示, 不显示
 */

const def: {
  title: string;
  getApi: string;
  saveApi: string;
  sections: Array<{ title: string; fields: string[] }>;
  labels: Record<string, string>;
  controls: Record<string, ConfigControlType>;
  options: Record<string, Array<{ label: string; value: string | number; color?: string }>>;
  rules: Record<string, ConfigFieldRule>;
  fieldHelp: Record<string, string>;
  hiddenFields: string[];
  defaults: Record<string, unknown>;
  renderers: Record<string, (context: ConfigRendererContext) => ReactNode>;
} = {
  title: '门店设置',
  getApi: '/setting/config/storeSettings',
  saveApi: '/setting/config/saveStore',
  sections: [
    {
      title: '基础配置',
      fields: [
        'maxRecommendProductCount',
        'maxSubAdministrator',
        'storePostAllocationStatus',
        'storeIndependentGoods',
        'shopProductNeedCheck',
        'storeAssignProductName',
        'storeAssignProductImage',
        'storeAssignProductPrice',
        'storeUseSoloProductStock',
        'storeUseTotalProductStock',
        'storeAssignDeliveryServiceFee',
        'storeAssignServerServiceFee',
        'storeCustomSubmitShippingType',
        'storeShowOtherCityStore',
      ],
    },
  ],
  labels: {
    maxRecommendProductCount: '推荐商品数量',
    maxSubAdministrator: '最大管理员数',
    storePostAllocationStatus: '商品分配后状态',
    storeIndependentGoods: '门店独立商品',
    shopProductNeedCheck: '门店商品审核',
    storeAssignProductName: '分配商品名称',
    storeAssignProductImage: '分配商品主图、详情页',
    storeAssignProductPrice: '分配商品价格',
    storeUseSoloProductStock: '使用门店独立库存',
    storeUseTotalProductStock: '库存模式',
    storeAssignDeliveryServiceFee: '分配商品配送费规则',
    storeAssignServerServiceFee: '分配商品服务费规则',
    storeCustomSubmitShippingType: '客户下单配送方式',
    storeShowOtherCityStore: '显示地区其他门店',
  },
  controls: {
    storePostAllocationStatus: 'radio',
    storeIndependentGoods: 'switch',
    shopProductNeedCheck: 'switch',
    storeAssignProductName: 'switch',
    storeAssignProductImage: 'switch',
    storeAssignProductPrice: 'radio',
    storeUseSoloProductStock: 'switch',
    storeUseTotalProductStock: 'switch',
    storeAssignDeliveryServiceFee: 'radio',
    storeAssignServerServiceFee: 'radio',
    storeCustomSubmitShippingType: 'radio',
    storeShowOtherCityStore: 'radio',
  },
  options: {
    storePostAllocationStatus: [
      { label: '上架', value: 1 },
      { label: '下架', value: 0 },
    ],
    storeAssignProductPrice: [
      { label: '使用总部/区域统一售价', value: 0 },
      { label: '使用门店独立售价', value: 1 },
    ],
    storeAssignDeliveryServiceFee: [
      { label: '使用总部统一配置', value: 0 },
      { label: '使用门店独立配置', value: 1 },
    ],
    storeAssignServerServiceFee: [
      { label: '使用总部统一配置', value: 0 },
      { label: '使用门店独立配置', value: 1 },
    ],
    storeCustomSubmitShippingType: [
      { label: '自提优先', value: 0 },
      { label: '配送优先', value: 1 },
      { label: '同城优先', value: 2 },
    ],
    storeShowOtherCityStore: [
      { label: '显示', value: 1 },
      { label: '不显示', value: 0 },
    ],
  },
  rules: {
    shopProductNeedCheck: { visibleWhen: { field: 'storeIndependentGoods', equals: 1 } },
  },
  fieldHelp: {
    maxRecommendProductCount: '商城中新品、推荐列表显示的商品数量',
    maxSubAdministrator: '当前店铺可配置的最大子管理员数',
    storePostAllocationStatus: '在将商品分配到组织时，可预设分配成功后商品在组织的上下架状态。',
    storeIndependentGoods: '允许门店自建商品，关闭后门店不可自行创建商品。',
    shopProductNeedCheck: '门店发布商品的时候是否需要审核才能显示商品。开启为商品默认审核通过。',
    storeAssignProductName: '门店可修改商品名称。勾选后，门店可修改总部/区域分配商品的名称。',
    storeAssignProductImage: '门店可修改商品主图、详情页。勾选后可独立修改。',
    storeAssignProductPrice: '用统一售价时，门店商品销售价将取总部/区域统一售价。',
    storeUseTotalProductStock: '使用平台库存或使用门店独立库存。',
    storeAssignDeliveryServiceFee: '用统一配置时，门店配送费将取总部统一配置。',
    storeAssignServerServiceFee: '用统一配置时，门店服务费将取总部统一配置。',
    storeCustomSubmitShippingType: '商品存在多种配送方式时客户下单默认配送方式。',
    storeShowOtherCityStore: '是否在列表中显示地区其他门店。',
  },
  hiddenFields: [],
  defaults: {
    maxRecommendProductCount: 10,
    maxSubAdministrator: 5,
    storePostAllocationStatus: 1,
    storeIndependentGoods: 1,
    shopProductNeedCheck: 0,
    storeAssignProductName: 0,
    storeAssignProductImage: 0,
    storeAssignProductPrice: 0,
    storeUseSoloProductStock: 1,
    storeUseTotalProductStock: 0,
    storeAssignDeliveryServiceFee: 0,
    storeAssignServerServiceFee: 0,
    storeCustomSubmitShippingType: 0,
    storeShowOtherCityStore: 1,
  },
  renderers: {
    shopProductNeedCheck: invertedCheckRenderer('shopProductNeedCheck', '商品默认审核通过'),
  },
};

function translateDef(source: typeof def, t: Translate): typeof def {
  return {
    ...source,
    title: t(source.title),
    sections: source.sections.map((section) => ({ ...section, title: t(section.title) })),
    labels: Object.fromEntries(
      Object.entries(source.labels).map(([key, value]): [string, string] => [key, t(value)]),
    ),
    options: Object.fromEntries(
      Object.entries(source.options).map(
        ([key, list]): [string, ConfigOption[]] => [
          key,
          list.map((item) => ({ ...item, label: t(item.label) })),
        ],
      ),
    ),
    fieldHelp: Object.fromEntries(
      Object.entries(source.fieldHelp).map(([key, value]): [string, string] => [key, t(value)]),
    ),
  };
}

export default function StoreSettings() {
  const { t } = useI18n();
  const localized = translateDef(def, t);
  return (
    <>
      <AutoConfigPage {...localized} />
    </>
  );
}

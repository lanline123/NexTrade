import AutoConfigPage, {
  type ConfigControlType,
  type ConfigFieldRule,
  type ConfigRendererContext,
} from './AutoConfigPage';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n';

// 旧版模板 prop="collectionMethod"/"collectionAccountType" 为只读展示项（非可编辑字段），
// 此处以静态文本渲染；店铺/门店/供应商费率仅在商家角色显示，平台后台沿用旧版行为不渲染。
function StaticText({ text }: { text: string }) {
  const { t } = useI18n();
  return <span className="profitsharing-static">{t(text)}</span>;
}

const staticTextRenderer = (text: string) =>
  () => <StaticText text={text} />;

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
  title: '分账设置',
  getApi: '/setting/config/profitSharingSettings',
  saveApi: '/setting/config/saveProfitSharing',
  sections: [
    {
      title: '分账基础设置',
      fields: [
        'profitSharingEnabled',
        'billingNode',
        'collectionNode',
        'collectionTimeSetting',
        'collectionMethod',
        'collectionAccountType',
        'splitPaymentMethod',
        'profitSharingCoolingDays',
      ],
    },
  ],
  labels: {
    profitSharingEnabled: '分账功能',
    profitSharingCoolingDays: '分账冷却天数',
    billingNode: '出账节点',
    collectionNode: '入账节点',
    collectionTimeSetting: '入账时间',
    collectionMethod: '入账方式',
    collectionAccountType: '入账账户类型',
    splitPaymentMethod: '分账方式',
    storeGeneralServiceFeeRate: '通用平台服务费率',
    storeWithdrawalFeeRate: '店铺提现手续费率',
    storefrontGeneralServiceFeeRate: '通用平台服务费率',
    storefrontWithdrawalFeeRate: '门店提现手续费率',
    supplierGeneralServiceFeeRate: '通用平台服务费率',
    supplierWithdrawalFeeRate: '供应商提现手续费率',
  },
  controls: {
    profitSharingEnabled: 'switch',
    billingNode: 'options',
    collectionNode: 'options',
    splitPaymentMethod: 'options',
  },
  options: {
    billingNode: [{ label: '下单成功/售后申请', value: 1 }],
    collectionNode: [{ label: '订单完成/确认收货', value: 1 }],
    splitPaymentMethod: [{ label: '线下分账', value: 1 }],
  },
  rules: {},
  fieldHelp: {
    profitSharingEnabled: '关闭后全部分账停用；开启后按下方设置的分账方式与渠道生效',
    billingNode: '订单支付成功或售后单退款完成，分账方能查看可获得的分账金额',
    collectionNode: '分账方获得金额的节点',
    collectionTimeSetting:
      '限制 0-15 天，默认0天。入账时间满足，对应分账账单触发入账结算；入账节点是订单完成（确认收货），入账时间设置10天，则代表结算时间是订单完成10天后结算',
    collectionMethod: '入账时间设置周期结束，资金会自动入账结算',
    collectionAccountType: '资金会通过店铺/门店/供应商账户余额结算',
    splitPaymentMethod:
      '商家通过对账单线下对账结算。线下分账：商家通过对账单线下对账结算；线上分账：通过线上支付分账能力，订单资金由渠道直接分账到子商户账户',
  },
  hiddenFields: [
    'storeGeneralServiceFeeRate',
    'storeWithdrawalFeeRate',
    'storefrontGeneralServiceFeeRate',
    'storefrontWithdrawalFeeRate',
    'supplierGeneralServiceFeeRate',
    'supplierWithdrawalFeeRate',
    'profitSharingOnlineChannel',
    'autoProfitSharingEnabled',
    'autoProfitSharingDays',
  ],
  defaults: {
    profitSharingEnabled: 1,
    billingNode: 1,
    collectionNode: 1,
    collectionTimeSetting: 0,
    collectionMethod: 1,
    collectionAccountType: 1,
    splitPaymentMethod: 1,
  },
  renderers: {
    collectionMethod: staticTextRenderer('自动入账'),
    collectionAccountType: staticTextRenderer('余额'),
  },
};

type Translate = (key: string) => string;

type PaymentOption = { label: string; value: string | number; color?: string };

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
        ([key, list]): [string, PaymentOption[]] => [
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

export default function ProfitSharingSettings() {
  const { t } = useI18n();
  const localized = translateDef(def, t);
  return (
    <AutoConfigPage
      title={localized.title}
      getApi={localized.getApi}
      saveApi={localized.saveApi}
      sections={localized.sections}
      labels={localized.labels}
      controls={localized.controls}
      options={localized.options}
      rules={localized.rules}
      fieldHelp={localized.fieldHelp}
      hiddenFields={localized.hiddenFields}
      defaults={localized.defaults}
      renderers={localized.renderers}
    />
  );
}

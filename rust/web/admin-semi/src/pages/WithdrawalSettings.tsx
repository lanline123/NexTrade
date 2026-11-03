import type { ReactNode } from 'react';
import { InputNumber, Select } from '@douyinfe/semi-ui';
import { useI18n } from '../i18n';
import AutoConfigPage, {
  type ConfigControlType,
  type ConfigFieldRule,
  type ConfigRendererContext,
} from './AutoConfigPage';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface WithdrawalTabDef {
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
  notice?: string;
}

const frequencyOptions = (t: Translate) => [
  { label: t('每日'), value: 1 },
  { label: t('每月'), value: 2 },
  { label: t('每年'), value: 3 },
];

// 旧版模板遗留 prop 名映射：prop="withdrawalLimit" 实际绑定 withdrawalFrequencyUnit/Count，
// prop="collectionMethod" 实际绑定 withdrawalReviewMethod，二者并非真实后端字段。


/** 提现限额：min ~ max 两个数字输入共用一行。 */
const rangeRenderer = (t: Translate, minKey: string, maxKey: string) =>
  ({ values, update }: ConfigRendererContext) => (
    <div className="withdrawal-range">
      <InputNumber
        style={{ width: 130 }}
        min={0}
        value={Number(values[minKey] ?? 0) || undefined}
        onChange={(next) => update(minKey, Number(next ?? 0))}
      />
      <span className="withdrawal-range-sep">~</span>
      <InputNumber
        style={{ width: 130 }}
        min={0}
        value={Number(values[maxKey] ?? 0) || undefined}
        onChange={(next) => update(maxKey, Number(next ?? 0))}
      />
      <span className="withdrawal-unit">{t('元')}</span>
    </div>
  );

/** 提现频次：单位选择 + 可申请提现 N 次。 */
const frequencyRenderer = (t: Translate, unitKey: string, countKey: string) =>
  ({ value, values, update }: ConfigRendererContext) => (
    <div className="withdrawal-frequency">
      <Select
        style={{ width: 120 }}
        value={Number(value ?? 1)}
        optionList={frequencyOptions(t)}
        onChange={(next) => update(unitKey, Number(next))}
      />
      <span className="withdrawal-frequency-text">{t('可申请提现')}</span>
      <InputNumber
        style={{ width: 120 }}
        min={0}
        value={Number(values[countKey] ?? 0) || undefined}
        onChange={(next) => update(countKey, Number(next ?? 0))}
      />
      <span className="withdrawal-unit">{t('次')}</span>
    </div>
  );

const offlineDef = (t: Translate): WithdrawalTabDef => ({
  title: '提现设置',
  getApi: '/setting/config/withdrawalSettings',
  saveApi: '/setting/config/saveWithdrawal',
  sections: [
    {
      title: '线下提现',
      fields: [
        'withdrawalReceiptMethod',
        'withdrawalEnabled',
        'minAmount',
        'withdrawalFrequencyUnit',
        'withdrawalReviewMethod',
        'withdrawalDescription',
      ],
    },
  ],
  labels: {
    withdrawalReceiptMethod: '线下收款方式',
    withdrawalEnabled: '提现配置',
    minAmount: '提现限额',
    maxAmount: '提现限额',
    withdrawalFrequencyUnit: '提现频次',
    withdrawalFrequencyCount: '提现频次',
    withdrawalReviewMethod: '提现审核',
    withdrawalDescription: '提现说明',
  },
  controls: {
    withdrawalReceiptMethod: 'multi',
    withdrawalEnabled: 'options',
    withdrawalDescription: 'textarea',
  },
  options: {
    withdrawalReceiptMethod: [
      { label: t('银行卡'), value: 1 },
      { label: t('支付宝'), value: 2 },
      { label: t('微信'), value: 3 },
    ],
    withdrawalEnabled: [
      { label: t('不开通提现'), value: 0 },
      { label: t('开通提现'), value: 1 },
    ],
    withdrawalReviewMethod: [{ label: t('人工审核（平台在提现管理页人工确认审核）'), value: 1 }],
    withdrawalFrequencyUnit: frequencyOptions(t),
  },
  rules: {
    minAmount: { visibleWhen: { field: 'withdrawalEnabled', equals: 1 } },
    withdrawalFrequencyUnit: { visibleWhen: { field: 'withdrawalEnabled', equals: 1 } },
    withdrawalReviewMethod: { visibleWhen: { field: 'withdrawalEnabled', equals: 1 } },
  },
  fieldHelp: {
    withdrawalEnabled: t('不开通提现适用于由平台完全线下结算的场景'),
    withdrawalReviewMethod: t('入账时间设置周期结束，资金会自动入账结算'),
    withdrawalDescription: t('注释：展示在商户添加账户的详情页，建议填写结算周期，打款方式等'),
  },
  hiddenFields: ['maxAmount', 'withdrawalFrequencyCount'],
  defaults: {
    withdrawalReceiptMethod: [],
    withdrawalEnabled: 0,
    minAmount: 0,
    maxAmount: 0,
    withdrawalFrequencyUnit: 1,
    withdrawalFrequencyCount: 1,
    withdrawalReviewMethod: 1,
  },
  renderers: {
    minAmount: rangeRenderer(t, 'minAmount', 'maxAmount'),
    withdrawalFrequencyUnit: frequencyRenderer(t, 'withdrawalFrequencyUnit', 'withdrawalFrequencyCount'),
  },
});

const onlineDef = (t: Translate): WithdrawalTabDef => ({
  title: '线上提现设置',
  getApi: '/setting/config/withdrawalSettings',
  saveApi: '/setting/config/saveWithdrawal',
  sections: [
    {
      title: '线上提现设置',
      fields: [
        'onlineWithdrawChannels',
        'onlineWithdrawEnabled',
        'onlineMinAmount',
        'onlineWithdrawalFrequencyUnit',
        'onlineWithdrawalReviewMethod',
        'onlineWithdrawalDescription',
      ],
    },
  ],
  labels: {
    onlineWithdrawChannels: '线上收款方式',
    onlineWithdrawEnabled: '提现配置',
    onlineMinAmount: '提现限额',
    onlineMaxAmount: '提现限额',
    onlineWithdrawalFrequencyUnit: '提现频次',
    onlineWithdrawalFrequencyCount: '提现频次',
    onlineWithdrawalReviewMethod: '提现审核',
    onlineWithdrawalDescription: '提现说明',
  },
  controls: {
    onlineWithdrawChannels: 'multi',
    onlineWithdrawEnabled: 'options',
    onlineWithdrawalDescription: 'textarea',
  },
  options: {
    onlineWithdrawChannels: [
      { label: t('微信'), value: 'WECHAT' },
      { label: t('汇付'), value: 'HUIFU' },
      { label: t('支付宝'), value: 'ALIPAY' },
    ],
    onlineWithdrawEnabled: [
      { label: t('不开通提现'), value: 0 },
      { label: t('开通提现'), value: 1 },
    ],
    onlineWithdrawalReviewMethod: [{ label: t('人工审核（平台在提现管理页人工确认审核）'), value: 1 }],
    onlineWithdrawalFrequencyUnit: frequencyOptions(t),
  },
  rules: {
    onlineMinAmount: { visibleWhen: { field: 'onlineWithdrawEnabled', equals: 1 } },
    onlineWithdrawalFrequencyUnit: { visibleWhen: { field: 'onlineWithdrawEnabled', equals: 1 } },
    onlineWithdrawalReviewMethod: { visibleWhen: { field: 'onlineWithdrawEnabled', equals: 1 } },
  },
  fieldHelp: {
    onlineWithdrawChannels: t(
      '线上提现允许商户将线上分账到账的资金提现到银行账户。需先开启线上分账并完成子商户绑定。勾选后对应渠道的线上提现才对商户开放，可多选；提现限额/频次/审核等参数三渠道共用下方配置',
    ),
    onlineWithdrawEnabled: t('开启后，商户端提现页面将显示微信余额，商户可选择线上提现'),
    onlineWithdrawalReviewMethod: t('入账时间设置周期结束，资金会自动入账结算'),
    onlineWithdrawalDescription: t('注释：展示在商户添加账户的详情页，建议填写结算周期，打款方式等'),
  },
  hiddenFields: ['onlineMaxAmount', 'onlineWithdrawalFrequencyCount'],
  defaults: {
    onlineWithdrawChannels: ['WECHAT'],
    onlineWithdrawEnabled: 0,
    onlineMinAmount: 0,
    onlineMaxAmount: 0,
    onlineWithdrawalFrequencyUnit: 1,
    onlineWithdrawalFrequencyCount: 1,
    onlineWithdrawalReviewMethod: 1,
  },
  renderers: {
    onlineMinAmount: rangeRenderer(t, 'onlineMinAmount', 'onlineMaxAmount'),
    onlineWithdrawalFrequencyUnit: frequencyRenderer(
      t,
      'onlineWithdrawalFrequencyUnit',
      'onlineWithdrawalFrequencyCount',
    ),
  },
});

export default function WithdrawalSettings() {
  const { t } = useI18n();
  const offline = offlineDef(t);
  const online = onlineDef(t);
  return (
    <div className="withdrawal-settings">
      <AutoConfigPage
        title={offline.title}
        getApi={offline.getApi}
        saveApi={offline.saveApi}
        sections={[...offline.sections, ...online.sections]}
        labels={{ ...offline.labels, ...online.labels }}
        controls={{ ...offline.controls, ...online.controls }}
        options={{ ...offline.options, ...online.options }}
        rules={{ ...offline.rules, ...online.rules }}
        fieldHelp={{ ...offline.fieldHelp, ...online.fieldHelp }}
        hiddenFields={[...offline.hiddenFields, ...online.hiddenFields]}
        defaults={{ ...offline.defaults, ...online.defaults }}
        renderers={{ ...offline.renderers, ...online.renderers }}
      />
    </div>
  );
}

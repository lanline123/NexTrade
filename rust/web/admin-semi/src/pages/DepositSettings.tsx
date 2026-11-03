import type { ReactNode } from 'react';
import { InputNumber, Select } from '@douyinfe/semi-ui';
import { useI18n } from '../i18n';
import AutoConfigPage, {
  type ConfigControlType,
  type ConfigFieldRule,
  type ConfigRendererContext,
} from './AutoConfigPage';

type ConfigOption = { label: string; value: string | number; color?: string };

const bufferActionOptions = [
  { label: '限制上架新品', value: 1 },
  { label: '全店商品下架', value: 2 },
];

/** 缓冲复合行：引导语 + 天数输入 + 固定文案 + 处理方式下拉（action 字段由该行代管）。 */
function DepositBufferLine({
  daysKey,
  actionKey,
  lead,
  values,
  update,
}: ConfigRendererContext & { daysKey: string; actionKey: string; lead: string }) {
  const { t } = useI18n();
  return (
    <div className="deposit-buffer-line">
      <span className="deposit-buffer-text">{t(lead)}</span>
      <InputNumber
        style={{ width: 110 }}
        min={0}
        precision={0}
        value={Number(values[daysKey] ?? 0) || 0}
        onChange={(next) => update(daysKey, Number(next ?? 0))}
      />
      <span className="deposit-buffer-text">{t('天内，未足额缴纳保证金，店铺/供应商')}</span>
      <Select
        style={{ width: 180 }}
        value={Number(values[actionKey] ?? 1)}
        optionList={bufferActionOptions.map((item) => ({ ...item, label: t(item.label) }))}
        onChange={(next) => update(actionKey, Number(next))}
      />
    </div>
  );
}

const bufferRenderer = (daysKey: string, actionKey: string, lead: string) =>
  (context: ConfigRendererContext) => (
    <DepositBufferLine {...context} daysKey={daysKey} actionKey={actionKey} lead={lead} />
  );

const def: {
  title: string;
  getApi: string;
  saveApi: string;
  sections: Array<{ title: string; fields: string[] }>;
  labels: Record<string, string>;
  controls: Record<string, ConfigControlType>;
  options: Record<string, ConfigOption[]>;
  rules: Record<string, ConfigFieldRule>;
  fieldHelp: Record<string, string>;
  hiddenFields: string[];
  defaults: Record<string, unknown>;
  renderers: Record<string, (context: ConfigRendererContext) => ReactNode>;
} = {
  title: '保证金设置',
  getApi: '/deposit/setting/detail',
  saveApi: '/deposit/setting/save',
  sections: [
    {
      title: '保证金设置',
      fields: [
        'depositEnable',
        'depositCollectRule',
        'depositCollectNode',
        'depositCollectBufferDays',
        'depositSupplementBufferDays',
      ],
    },
    { title: '保证金协议', fields: ['depositProtocolEnable', 'depositProtocolContent'] },
  ],
  labels: {
    depositEnable: '保证金功能',
    depositCollectRule: '收取规则',
    depositCollectNode: '收取节点',
    depositCollectBufferDays: '缴存缓冲',
    depositCollectBufferAction: '缴存缓冲处理方式',
    depositSupplementBufferDays: '补缴缓冲',
    depositSupplementBufferAction: '补缴缓冲处理方式',
    depositProtocolEnable: '保证金协议',
    depositProtocolContent: '内容',
  },
  controls: {
    depositEnable: 'switch',
    depositProtocolEnable: 'switch',
    depositProtocolContent: 'richtext',
  },
  options: {
    depositCollectRule: [{ label: '按店铺/供应商类目保证金最高收取', value: 1 }],
    depositCollectNode: [
      { label: '店铺/供应商上架商品时收取保证金', value: 1 },
      { label: '店铺/供应商售卖第一单收取保证金', value: 2 },
    ],
  },
  rules: {},
  fieldHelp: {
    depositEnable:
      '开启后平台启用店铺/供应商保证金管理能力，店铺/供应商需按配置规则缴纳保证金，用于履约保障、售后赔付及违规扣款；关闭则全部店铺/供应商免缴保证金。开启前请配置相关保证金账户（去设置> 保证金账户）',
    depositCollectBufferDays: '店铺/供应商入驻成功，初次缴纳保证金的缓冲机制',
    depositSupplementBufferDays: '店铺/供应商已交保证金，因规则调整，保证金扣除等情况的缓冲机制',
    depositProtocolEnable:
      '本协议功能用于在商家店铺/供应商【保证金】菜单内，展示保证金相关协议文本，供商家查看、知晓保证金的缴纳、使用、退还等相关规则，同时为功能开发提供明确的展示标准和内容边界。',
  },
  hiddenFields: ['depositCollectBufferAction', 'depositSupplementBufferAction'],
  defaults: {
    depositEnable: 0,
    depositCollectRule: 1,
    depositCollectNode: 1,
    depositCollectBufferDays: 0,
    depositCollectBufferAction: 1,
    depositSupplementBufferDays: 0,
    depositSupplementBufferAction: 1,
    depositProtocolEnable: 0,
    depositProtocolContent: '',
  },
  renderers: {
    depositCollectBufferDays: bufferRenderer(
      'depositCollectBufferDays',
      'depositCollectBufferAction',
      '触发收取节点',
    ),
    depositSupplementBufferDays: bufferRenderer(
      'depositSupplementBufferDays',
      'depositSupplementBufferAction',
      '店铺/供应商类目调整或平台手动调整保证金',
    ),
  },
};

/** AutoConfigPage 只对 labels/sections 做 t()，options/fieldHelp 需在页面侧翻译。 */
const translateOptions = (
  source: Record<string, ConfigOption[]>,
  t: (key: string, params?: Record<string, string | number>) => string,
) =>
  Object.fromEntries(
    Object.entries(source).map(([key, list]): [string, ConfigOption[]] => [
      key,
      list.map((item) => ({ ...item, label: t(item.label) })),
    ]),
  );

const translateMap = (
  source: Record<string, string>,
  t: (key: string, params?: Record<string, string | number>) => string,
) =>
  Object.fromEntries(Object.entries(source).map(([key, value]): [string, string] => [key, t(value)]));

export default function DepositSettings() {
  const { t } = useI18n();
  return (
    <AutoConfigPage
      title={def.title}
      getApi={def.getApi}
      saveApi={def.saveApi}
      sections={def.sections}
      labels={def.labels}
      controls={def.controls}
      options={translateOptions(def.options, t)}
      rules={def.rules}
      fieldHelp={translateMap(def.fieldHelp, t)}
      hiddenFields={def.hiddenFields}
      defaults={def.defaults}
      renderers={def.renderers}
    />
  );
}

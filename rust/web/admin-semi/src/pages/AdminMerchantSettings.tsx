import AutoConfigPage, {
  type ConfigControlType,
  type ConfigFieldRule,
  type ConfigRendererContext,
} from './AutoConfigPage';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n';

type ConfigOption = { label: string; value: string | number; color?: string };

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
  title: '商户设置',
  getApi: '/setting/config/merchantSettings',
  saveApi: '/setting/config/saveMerchant',
  sections: [
    {
      title: '基本设置',
      fields: ['personApplyEnabled', 'merchantApplyNeedCheck', 'maxShopCount'],
    },
    { title: '入驻协议内容', fields: ['shopAgreement'] },
  ],
  labels: {
    personApplyEnabled: '是否允许个人入驻',
    merchantApplyNeedCheck: '商户入驻是否需要审核',
    maxShopCount: '单个商户最大店铺数量',
    shopAgreement: '入驻协议内容',
  },
  controls: {
    personApplyEnabled: 'options',
    merchantApplyNeedCheck: 'options',
    shopAgreement: 'richtext',
  },
  options: {
    personApplyEnabled: [
      { label: '是', value: 1 },
      { label: '否', value: 0 },
    ],
    merchantApplyNeedCheck: [
      { label: '是', value: 1 },
      { label: '否', value: 0 },
    ],
  },
  rules: {},
  fieldHelp: {},
  hiddenFields: [],
  defaults: {
    personApplyEnabled: 1,
    merchantApplyNeedCheck: 1,
    maxShopCount: 10,
    shopAgreement: '',
  },
  renderers: {},
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

export default function AdminMerchantSettings() {
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
      fieldHelp={def.fieldHelp}
      hiddenFields={def.hiddenFields}
      defaults={def.defaults}
      renderers={def.renderers}
    />
  );
}

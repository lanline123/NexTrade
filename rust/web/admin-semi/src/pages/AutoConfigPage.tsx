import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Button,
  Card,
  CheckboxGroup,
  ColorPicker,
  Input,
  InputNumber,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Space,
  Switch,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconBell,
  IconBox,
  IconClock,
  IconComment,
  IconCreditCard,
  IconFile,
  IconGift,
  IconGlobe,
  IconHome,
  IconIdCard,
  IconList,
  IconServer,
  IconSetting,
  IconShoppingBag,
  IconUser,
} from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '../api';
import { configLabels } from '../config/configLabels';
import { useI18n } from '../i18n';
import ImageUploader from '../components/ImageUploader';
import RichTextEditor from '../components/RichTextEditor';
import RegionSelect from '../components/RegionSelect';
import SecretInput from '../components/SecretInput';

const { Text } = Typography;

const NEXTRADE_TECH_SUPPORT = '/admin-assets/nextrade-tech-support.svg';

const CONFIG_SECTION_ICONS: Record<string, ReactNode> = {
  商城信息: <IconHome />,
  备案信息: <IconFile />,
  经营许可证: <IconIdCard />,
  商城状态: <IconSetting />,
  商品货币设置: <IconCreditCard />,
  商品录入设置: <IconBox />,
  商品编辑设置: <IconSetting />,
  商品信息显示设置: <IconShoppingBag />,
  商品评价设置: <IconComment />,
  购物全局设置: <IconShoppingBag />,
  积分设置: <IconGift />,
  发票设置: <IconCreditCard />,
  退换货设置: <IconBox />,
  基础设置: <IconList />,
  售后设置: <IconClock />,
  平台管理订单流转设置: <IconList />,
  店铺后台订单流转设置: <IconList />,
  平台代客下单设置: <IconUser />,
  客服设置: <IconComment />,
  客服信息: <IconBell />,
  聊天工具: <IconComment />,
  全局设置: <IconSetting />,
  存储设置: <IconServer />,
  多语言设置: <IconGlobe />,
  货币设置: <IconCreditCard />,
  地区设置: <IconGlobe />,
  用户设置: <IconUser />,
};

const CONFIG_SECTION_DESCRIPTIONS: Record<string, string> = {
  商城信息: '商城 Logo、名称、版权与技术支持等基础展示信息。',
  备案信息: 'ICP 备案号、公安备案号及对应跳转链接。',
  经营许可证: '营业执照展示与经营许可证相关开关。',
  商城状态: '注册、下单与营业执照状态控制。',
  商品货币设置: '商城货币符号及中文展示方式。',
  商品录入设置: '商品名称长度、编码前缀与市场价格规则。',
  商品编辑设置: '库存编辑权限与规格图片展示方式。',
  商品信息显示设置: '商品列表与详情页的销量、市场价、询价等展示规则。',
  商品评价设置: '商品评价入口与匿名评价规则。',
  购物全局设置: '下单与地区校验相关规则。',
  积分设置: '积分获取、抵扣、签到与评论奖励规则。',
  发票设置: '发票入口与增值税专用发票规则。',
  退换货设置: '退货收件人、联系电话与退货地址。',
  基础设置: '订单自动流转、虚拟订单与取消规则。',
  售后设置: '售后审核、退货、自动确认与财务复核规则。',
  平台管理订单流转设置: '平台端可取消已支付或已发货订单的规则。',
  店铺后台订单流转设置: '店铺端取消已发货订单的规则。',
  平台代客下单设置: '平台代客下单时积分与余额的使用规则。',
};

export interface ConfigWhen {
  field?: string;
  equals?: unknown;
  notEquals?: unknown;
  in?: unknown[];
  /** 逗号分隔列表包含（如 smsAliyunChannel "1,2" 包含 "2"）。 */
  includes?: unknown;
  any?: ConfigWhen[];
  all?: ConfigWhen[];
}

export interface ConfigFieldRule {
  visibleWhen?: ConfigWhen;
  disabledWhen?: ConfigWhen;
}

export interface ConfigFieldGroup {
  title: string;
  description?: string;
  tag?: string;
  icon?: string;
  fields: string[];
  visibleWhen?: ConfigWhen;
}

/** 数字字段的取值范围与精度约束（对齐旧版 el-input-number / decimal 输入）。 */
export interface ConfigNumberLimit {
  min?: number;
  max?: number;
  /** 0 表示只允许整数；1 表示保留 1 位小数。 */
  precision?: number;
  step?: number;
}

export interface ConfigRendererContext {
  value: unknown;
  values: Record<string, unknown>;
  update: (key: string, next: unknown) => void;
}

function SettingsModeToggle({ custom, onChange }: { custom: boolean; onChange: (custom: boolean) => void }) {
  const { t } = useI18n();
  return (
    <div className="settings-mode-toggle" role="tablist" aria-label={t('选择配置方式')}>
      <button
        type="button"
        role="tab"
        aria-selected={!custom}
        className={!custom ? 'is-active' : ''}
        onClick={() => onChange(false)}
      >
        <span className="settings-mode-toggle__dot" />
        {t('系统默认')}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={custom}
        className={custom ? 'is-active' : ''}
        onClick={() => onChange(true)}
      >
        <span className="settings-mode-toggle__dot" />
        {t('自定义')}
      </button>
    </div>
  );
}

function SettingsFieldHint({ children }: { children: ReactNode }) {
  return (
    <div className="settings-field-hint">
      <span className="settings-field-hint__icon">i</span>
      <span>{children}</span>
    </div>
  );
}

export function CopyrightConfigField({ value, values, update }: ConfigRendererContext) {
  const { t } = useI18n();
  const custom = Number(value) === 0;
  const customText = String(values.shopCompanyTxt ?? '');
  const defaultText = String(values.defaultCopyright ?? 'Copyright © 2024 NexTrade. All Rights Reserved').replace(/Tigshop/gi, 'NexTrade');
  return (
    <div className="copyright-config-field">
      <SettingsModeToggle custom={custom} onChange={(next) => update('shopCompany', next ? 0 : 1)} />
      {custom ? (
        <div className="settings-editor-card">
          <div className="settings-editor-card__label">{t('自定义版权文案')}</div>
          <div className="settings-editor-card__row">
            <Input
              value={customText}
              onChange={(next) => update('shopCompanyTxt', next)}
              placeholder={t('请输入版权信息')}
            />
            <Button size="small" onClick={() => update('defaultCopyright', customText)}>
              {t('设为默认')}
            </Button>
          </div>
        </div>
      ) : (
        <div className="settings-preview-card">
          <div className="settings-preview-card__head">
            <span>{t('当前使用平台默认版权')}</span>
            <span className="settings-badge">{t('平台默认')}</span>
          </div>
          <div className="settings-preview-card__copyright">{defaultText}</div>
        </div>
      )}
      <SettingsFieldHint>
        {t('版权信息将会显示在商城页面底部，如需自定义或隐藏，请购买去版权服务。')}
      </SettingsFieldHint>
    </div>
  );
}

export function BusinessLicenseConfigField({ value, values, update }: ConfigRendererContext) {
  const { t } = useI18n();
  const enabled = Number(value) === 1;
  const types = Array.isArray(values.businessLicenseType) ? (values.businessLicenseType as string[]) : [];
  const type = types.includes('icp') && types.includes('edi') ? 'icp_edi' : types.includes('edi') ? 'edi' : 'icp';
  const licenseNo = String((type === 'edi' ? values.ediLicense : values.businessLicense) || values.ediLicense || values.businessLicense || '');
  const applyType = (next: string) => {
    const no = String(values.businessLicense || values.ediLicense || '');
    update('businessLicenseType', next === 'icp_edi' ? ['icp', 'edi'] : [next]);
    if (next === 'icp_edi') {
      update('businessLicense', no);
      update('ediLicense', no);
    } else if (next === 'edi') {
      update('businessLicense', '');
      update('ediLicense', no);
    } else {
      update('businessLicense', no);
      update('ediLicense', '');
    }
  };
  const applyNo = (no: string) => {
    if (type === 'icp_edi') {
      update('businessLicense', no);
      update('ediLicense', no);
    } else if (type === 'edi') {
      update('ediLicense', no);
    } else {
      update('businessLicense', no);
    }
  };
  return (
    <div className="license-config-field">
      <RadioGroup value={enabled ? 1 : 0} onChange={(event) => update('businessLicenseEnabled', Number(event.target.value))}>
        <Radio value={1}>{t('开启')}</Radio>
        <Radio value={0}>{t('关闭')}</Radio>
      </RadioGroup>
      {enabled && (
        <div className="license-config-field__body">
          <div className="license-config-field__row">
            <span className="license-config-field__label">{t('经营许可证类型')}</span>
            <RadioGroup value={type} onChange={(event) => applyType(String(event.target.value))}>
              <Radio value="icp">{t('ICP证')}</Radio>
              <Radio value="edi">{t('EDI证')}</Radio>
              <Radio value="icp_edi">{t('ICP+EDI 双证')}</Radio>
            </RadioGroup>
          </div>
          <div className="license-config-field__row">
            <span className="license-config-field__label">{t('许可证号')}</span>
            <Input value={licenseNo} onChange={applyNo} placeholder={t('请输入许可证号')} style={{ maxWidth: 450 }} />
          </div>
          <div className="auto-config-field-help">
            {t('经营性互联网信息服务需公示 ICP 增值电信业务经营许可证，该信息将展示在商城底部，证号为空则前台不显示。')}
          </div>
        </div>
      )}
    </div>
  );
}

export function TechSupportConfigField({ value, values, update }: ConfigRendererContext) {
  const { t } = useI18n();
  const custom = Number(value) === 0;
  const logo = String(values.poweredByLogo ?? '');
  const defaultLogo = String(values.defaultTechSupport ?? '') || `${window.location.origin}${NEXTRADE_TECH_SUPPORT}`;
  return (
    <div className="tech-support-config-field">
      <SettingsModeToggle custom={custom} onChange={(next) => update('poweredBy', next ? 0 : 1)} />
      {custom ? (
        <div className="settings-editor-card">
          <div className="settings-editor-card__label">{t('自定义技术支持图片')}</div>
          <div className="settings-editor-card__row settings-editor-card__row--media">
            <ImageUploader
              single
              value={logo ? [logo] : []}
              onChange={(next) => update('poweredByLogo', next[0] || '')}
            />
            {logo && (
              <Button size="small" onClick={() => update('defaultTechSupport', logo)}>
                {t('设为默认')}
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div className="settings-preview-card settings-preview-card--media">
          <div className="settings-preview-card__head">
            <span>{t('当前使用平台默认技术支持标识')}</span>
            <span className="settings-badge">{t('平台默认')}</span>
          </div>
          {defaultLogo ? (
            <img src={defaultLogo} alt="" />
          ) : (
            <span className="tech-support-config-field__empty">{t('暂无默认技术支持标识')}</span>
          )}
        </div>
      )}
      <SettingsFieldHint>
        {t('技术标识将会显示在商城页面底部，如需自定义或隐藏，请购买去版权服务。')}
      </SettingsFieldHint>
    </div>
  );
}

export type ConfigControlType =
  | 'radio'
  | 'switch'
  | 'segmented'
  | 'color'
  | 'options'
  | 'multi'
  | 'select'
  | 'richtext'
  | 'textarea';

/** 配置页动作按钮的执行上下文。旧版配置页里的按钮型功能统一走这里，避免"字段在、功能不在"。 */
export type ConfigActionContext = {
  values: Record<string, unknown>;
  /** prompt 弹窗里用户输入的内容 */
  input: string;
  apiGet: typeof apiGet;
  apiPost: typeof apiPost;
  reload: () => Promise<void>;
  copy: (text: string) => Promise<void>;
};

export type ConfigAction = {
  label: string;
  /** 归属的分组标题；填写后按钮渲染在该分组卡片头部，否则渲染在页面底部操作区。 */
  section?: string;
  /** 二次确认文案 */
  confirm?: string;
  /** 需要用户输入（例如测试邮箱） */
  prompt?: { label: string; placeholder?: string; defaultValue?: string };
  /** 成功提示文案 */
  success?: string;
  /** 执行完成后重新拉取配置 */
  reload?: boolean;
  visibleWhen?: (values: Record<string, unknown>) => boolean;
  /** 主要动作用 solid，其余用 light */
  primary?: boolean;
  run: (context: ConfigActionContext) => Promise<void>;
};

interface AutoConfigPageProps {
  title: string;
  getApi: string;
  saveApi: string;
  sections?: Array<{ title: string; fields: string[] }>;
  rules?: Record<string, ConfigFieldRule>;
  fieldGroups?: ConfigFieldGroup[];
  controls?: Record<string, ConfigControlType>;
  options?: Record<string, Array<{ label: string; value: string | number; color?: string }>>;
  hiddenFields?: string[];
  fieldHelp?: Record<string, string>;
  /** 字段中文标签覆盖，优先级高于 configLabels / 内置 labelMap。 */
  labels?: Record<string, string>;
  /** 接口未返回时的字段缺省值（如 0/1 证书上传标记），不会覆盖接口返回值。 */
  defaults?: Record<string, unknown>;
  /** 特殊字段的自定义控件渲染器（拖拽排序、证书上传等）。 */
  renderers?: Record<string, (context: ConfigRendererContext) => ReactNode>;
  /** 数字字段的取值范围、精度与步长。 */
  numberLimits?: Record<string, ConfigNumberLimit>;
  /** 字段变更后的联动修正（返回值会合并进表单值）。 */
  adjustValues?: (
    key: string,
    value: unknown,
    values: Record<string, unknown>,
  ) => Record<string, unknown> | void;
  /** 保存前校验；返回错误文案则中止保存。 */
  validate?: (values: Record<string, unknown>) => string | null | undefined;
  /** 旧版配置页里的按钮型功能：密钥生成/复制、批量更新、测试邮件等。 */
  actions?: ConfigAction[];
  onSaved?: (values: Record<string, unknown>) => void;
  modern?: boolean;
}

function matchesCondition(condition: ConfigWhen | undefined, values: Record<string, unknown>): boolean {
  if (!condition) return true;
  if (condition.any) return condition.any.some((item) => matchesCondition(item, values));
  if (condition.all) return condition.all.every((item) => matchesCondition(item, values));
  const current = condition.field ? values[condition.field] : undefined;
  if ('equals' in condition) return String(current) === String(condition.equals);
  if ('notEquals' in condition) return String(current) !== String(condition.notEquals);
  if (condition.in) return condition.in.some((item) => String(item) === String(current));
  if ('includes' in condition && condition.includes !== undefined) {
    return String(current ?? '')
      .split(',')
      .map((item) => item.trim())
      .includes(String(condition.includes));
  }
  return true;
}

const labelMap: Record<string, string> = {
  businessLicense: '营业执照',
  businessLicenseEnabled: '经营许可证开关',
  businessLicenseType: '经营许可证类型',
  closeOrder: '关闭下单',
  closeShop: '关闭商城',
  ediLicense: '电子营业执照',
  shopLogo: '商城 Logo',
  shopRegClosed: '关闭注册',
  autoAddCartAfterScan: '扫码自动加入购物车',
  autoDeductionPoints: '收银积分自动抵扣',
  autoEraseZero: '店内收银自动抹零',
  autoPrintOfflineOrder: '线下订单自动打印',
  autoPrintOnlineOrder: '线上订单自动打印',
  defaultCollectionMethod: '默认收款方式',
  posProductSource: '收银机添加商品',
  shopCommonRemarks: '店铺常用备注',
  shopName: '商城名称',
  shopTitle: '首页 SEO 标题',
  shopTitleSuffix: 'SEO 标题后缀',
  shopKeywords: '首页 SEO 关键词',
  shopDesc: '首页 SEO 描述',
  shopIcpNo: 'ICP 备案号',
  shop110No: '公安备案号',
  shop110Link: '公安备案链接',
  shopCompany: '公司信息',
  shopCompanyTxt: '版权信息',
  defaultCopyright: '默认版权',
  defaultTechSupport: '技术支持',
  kefuAddress: '客服地址',
  lightShopLogo: '浅色 Logo',
  darkShopLogo: '深色 Logo',
  icoImg: 'ICO 图标',
  adminLightLogo: '后台 Logo',
  adminDomain: '后台域名',
  pcDomain: 'PC 域名',
  h5Domain: 'H5 域名',
  isOpenPscws: '搜索分词',
  selfStoreName: '自营名称',
  navTheme: '外观',
  primaryColor: '主题色',
  versionInfoHidden: '是否隐藏版本号',
  layout: '布局',
  defaultCountry: '默认国家',
  autoRedirect: '自动跳转',
  clientDefaultUse: '客户端默认使用',
  shopDefaultRegions: '商城默认地区',
  langOn: '开启多语言',
  langType: '多语言类型',
  langVolcengineAccessKey: '多语言火山 Access Key',
  langVolcengineSecret: '多语言火山 Secret',
  seoCategoryEnable: '商品类目使用 SEO 链接',
  seoProductEnable: '商品使用 SEO 链接',
  workbuddyApiKey: 'Workbuddy API Key',
  smsProvider: '短信服务商',
  smsAliyunChannel: '阿里云短信通道',
  smsHuaweiAppKey: '华为云短信 App Key',
  smsHuaweiAppSecret: '华为云短信 App Secret',
  smsHuaweiChannel: '华为云短信通道',
  smsHuaweiEndpoint: '华为云短信 Endpoint',
  smsHuaweiShopMobile: '华为云商家短信号码',
  smsHuaweiSignName: '华为云短信签名',
  smsSenderId: '短信发送者 ID',
  smsTencentSdkAppId: '腾讯云短信 SDK App ID',
  smsTencentSecretId: '腾讯云短信 Secret ID',
  smsTencentSecretKey: '腾讯云短信 Secret Key',
  smsTencentShopMobile: '腾讯云商家短信号码',
  smsTencentSignName: '腾讯云短信签名',
  smsVolcengineAccessKey: '火山引擎短信 Access Key',
  smsVolcengineSecretKey: '火山引擎短信 Secret Key',
  smsVolcengineShopMobile: '火山引擎商家短信号码',
  smsVolcengineSignName: '火山引擎短信签名',
  smsVolcengineSmsAccount: '火山引擎短信账户',
  searchScopeTitle: '搜索范围标题',
  defaultDeliveryServiceFeeRate: '默认配送服务费率',
  defaultServerServiceFeeRate: '默认服务服务费率',
  deliveryServiceFeeEnabled: '配送服务费开关',
  serverServiceFeeEnabled: '服务服务费开关',
  autoReturnGoodsDays: '自动同意售后天数',
  productRawImageDownloadEnabled: '商品原图下载',
  productRawImageDownloadChannels: '开启渠道',
  productRawImageDownloadScopes: '自动打包范围',
  orderSendPointNode: '赠送积分节点',
  orderSendPoint: '赠送积分',
  integralScale: '积分换算比例',
  commentSendPoint: '评论商品赠送积分',
  showSendPoint: '晒单赠送积分',
  useQiandaoPoint: '签到赠送积分',
  continuousSignIn: '连续签到',
  childAreaNeedRegion: '运费模板地区设置机制',
  returnConsignee: '回寄联系人设置',
  returnMobile: '回寄电话设置',
  returnAddress: '回寄地址设置',
  productCommentEnabled: '开启商品评价',
  anonymousCommentEnabled: '匿名评价',
  showMarketprice: '显示市场价',
  showSelledCount: '显示销量',
  marketPriceRate: '市场价系数',
  snPrefix: '商品编号前缀',
  customProductNameLength: '商品名称长度',
  dollarSign: '货币符号',
  dollarSignCn: '货币单位',
  canInvoice: '允许开发票',
  invoiceAdded: '发票附加',
  integralName: '积分名称',
  integralPercent: '积分比例',
  autoCancelOrderMinute: '自动取消订单（分钟）',
  autoConfirmReceiptDays: '自动确认收货（天）',
  autoDeliveryDays: '自动发货（天）',
  afterSalesLimitDays: '售后期限（天）',
  afterSalesReview: '售后审核',
  afterSalesReasonEnabled: '售后原因启用',
  kefuPhone: '客服电话',
  kefuTime: '客服时间',
  kefuType: '客服类型',
  kefuCode: '客服代码',
  kefuCodeBlank: '客服代码新窗口',
  kefuWorkwxId: '企业微信 ID',
  corpId: '企业 ID',
  wechatAppId: '微信 AppID',
  wechatAppSecret: '微信 AppSecret',
  wechatServerToken: '微信服务器 Token',
  wechatServerSecret: '微信服务器 Secret',
  googleLoginOn: 'Google 登录',
  googleClientId: 'Google Client ID',
  googleClientSecret: 'Google Client Secret',
  facebookLoginOn: 'Facebook 登录',
  facebookClientId: 'Facebook Client ID',
  facebookClientSecret: 'Facebook Client Secret',
  twitterLoginOn: 'Twitter 登录',
  twitterClientId: 'Twitter Client ID',
  twitterClientSecret: 'Twitter Client Secret',
  usernamePrefix: '用户名前缀',
  openEmailRegister: '邮箱注册',
  isOpenMobileAreaCode: '手机区号',
  mapProvider: '地图服务商',
  amapWebKey: '高德 Web Key',
  amapWebSecret: '高德 Web Secret',
  amapJsKey: '高德 JS Key',
  amapJsSecret: '高德 JS Secret',
  amapMiniKey: '高德小程序 Key',
  amapMiniSecret: '高德小程序 Secret',
  tiandituWebTk: '天地图 Web TK',
  tiandituJsTk: '天地图 JS TK',
  imageUploadMaxSize: '图片上传上限（MB）',
  materialUploadNameType: '素材命名方式',
  msgHackWord: '消息屏蔽词',
  themeStyle: '主题风格',
  themeColor: '主题色',
  pageWidth: '页面宽度',
  noticeType: '通知方式',
  mailHost: '邮件服务器',
  mailPort: '邮件端口',
  mailUser: '邮箱账号',
  mailPass: '邮箱密码',
};

function formatLabel(key: string) {
  if (configLabels[key]) return configLabels[key];
  if (labelMap[key]) return labelMap[key];
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (char) => char.toUpperCase())
    .trim();
}

export default function AutoConfigPage({
  title,
  getApi,
  saveApi,
  sections,
  rules,
  fieldGroups,
  controls,
  options,
  hiddenFields,
  fieldHelp,
  labels,
  defaults,
  renderers,
  numberLimits,
  adjustValues,
  validate,
  actions,
  onSaved,
  modern,
}: AutoConfigPageProps) {
  const { t } = useI18n();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [jsonDrafts, setJsonDrafts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(0);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [actionPrompt, setActionPrompt] = useState<{ action: ConfigAction; value: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<Record<string, unknown>>(getApi);
      const data = { ...defaults, ...(result || {}) };
      // 品牌迁移仅作用于品牌相关配置，避免把计算字段注入其它配置分组
      const brandConfigApi = /basicSettings|globalSettings|getAdmin/.test(getApi);
      if (brandConfigApi && typeof data.defaultCopyright === 'string') {
        data.defaultCopyright = data.defaultCopyright.replace(/Tigshop/gi, 'NexTrade');
      }
      // 历史默认技术支持图来自第三方 OSS / 旧品牌，统一替换为平台自有标识
      if (
        brandConfigApi &&
        (typeof data.defaultTechSupport !== 'string' ||
          !data.defaultTechSupport ||
          /tigshop|nlatstore|default_tech_support/i.test(data.defaultTechSupport))
      ) {
        data.defaultTechSupport = `${window.location.origin}${NEXTRADE_TECH_SUPPORT}`;
      }
      setValues(data);
      const drafts: Record<string, string> = {};
      Object.entries(data).forEach(([key, value]) => {
        if (value && typeof value === 'object') drafts[key] = JSON.stringify(value, null, 2);
      });
      setJsonDrafts(drafts);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '加载失败' });
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getApi]);

  useEffect(() => {
    void load();
  }, [load]);

  // 开发期告警：声明成选项型控件却没配 options 的字段会静默退化成空选项组 / 文本框。
  useEffect(() => {
    if (!import.meta.env.DEV || !controls) return;
    const missing = Object.entries(controls)
      .filter(
        ([key, control]) =>
          ['select', 'options', 'multi', 'radio', 'segmented'].includes(control) &&
          !options?.[key]?.length,
      )
      .map(([key]) => key);
    if (missing.length) {
      console.warn(
        `[AutoConfigPage] ${title} 的以下字段声明了选项型控件但未提供 options，将退化为空选项组：${missing.join(', ')}`,
      );
    }
  }, [controls, options, title]);

  const entries = useMemo(() => Object.entries(values), [values]);

  const update = (key: string, value: unknown) => {
    setValues((current) => {
      const next = { ...current, [key]: value };
      const patch = adjustValues?.(key, value, next);
      return patch ? { ...next, ...patch } : next;
    });
  };

  const normalizeNumber = (key: string, next: unknown): number => {
    const limit = numberLimits?.[key];
    let parsed = Number(next);
    if (!Number.isFinite(parsed)) parsed = limit?.min ?? 0;
    if (limit?.precision !== undefined) {
      const factor = 10 ** Math.max(0, limit.precision);
      parsed = Math.round(parsed * factor) / factor;
    }
    if (limit?.min !== undefined) parsed = Math.max(limit.min, parsed);
    if (limit?.max !== undefined) parsed = Math.min(limit.max, parsed);
    return parsed;
  };

  const labelOf = (key: string) => labels?.[key] || formatLabel(key);

  const save = async () => {
    const invalid = validate?.(values);
    if (invalid) {
      Toast.error({ content: invalid });
      return;
    }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...values };
      Object.entries(jsonDrafts).forEach(([key, raw]) => {
        try {
          payload[key] = JSON.parse(raw);
        } catch {
          throw new Error(`${t(labelOf(key))} ${t('JSON 格式不正确')}`);
        }
      });
      await apiPost(saveApi, payload);
      onSaved?.(payload);
      Toast.success({ content: t('保存成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  const copyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // 非安全上下文（http / 旧浏览器）降级为 execCommand
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  };

  const visibleActions = (sectionTitle?: string) =>
    (actions || []).filter(
      (action) =>
        action.section === sectionTitle &&
        (!action.visibleWhen || action.visibleWhen(values)),
    );

  const runAction = async (action: ConfigAction, input = '') => {
    if (action.confirm) {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: t('确认操作'),
          content: t(action.confirm as string),
          okText: t('确定'),
          cancelText: t('取消'),
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) return;
    }
    setActionBusy(action.label);
    try {
      await action.run({ values, input, apiGet, apiPost, reload: load, copy: copyText });
      if (action.reload) await load();
      Toast.success({ content: t(action.success || '操作成功') });
    } catch (error) {
      if (error instanceof Error && error.message === '__cancelled__') return;
      // 后端明确返回业务错误（例如能力未迁移的 1001）时如实展示，不做"假成功"
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setActionBusy(null);
    }
  };

  const onActionClick = (action: ConfigAction) => {
    if (action.prompt) {
      setActionPrompt({
        action,
        value: String(action.prompt.defaultValue ?? ''),
      });
      return;
    }
    void runAction(action);
  };

  const actionButtons = (list: ConfigAction[]) =>
    list.map((action) => (
      <Button
        key={action.label}
        size="small"
        theme={action.primary ? 'solid' : 'light'}
        type={action.primary ? 'primary' : undefined}
        loading={actionBusy === action.label}
        disabled={Boolean(actionBusy) || loading}
        onClick={() => onActionClick(action)}
      >
        {t(action.label)}
      </Button>
    ));

  const grouped = useMemo(() => {
    if (!sections?.length) return [{ title: '', items: entries }];
    const known = new Set(sections.flatMap((section) => section.fields));
    const result = sections
      .map((section) => ({
        title: section.title,
        items: section.fields
          .map((key) => entries.find(([entryKey]) => entryKey === key))
          .filter((item): item is [string, unknown] => Boolean(item)),
      }))
      .filter((section) => section.items.length > 0);
    const rest = entries.filter(([key]) => !known.has(key));
    if (rest.length) {
      if (result.length) result[result.length - 1].items.push(...rest);
      else result.push({ title: t('其它'), items: rest });
    }
    return result;
  }, [entries, sections]);

  const isFieldVisible = (key: string) => {
    if (hiddenFields?.includes(key)) return false;
    return matchesCondition(rules?.[key]?.visibleWhen, values);
  };
  const isFieldDisabled = (key: string) => {
    const condition = rules?.[key]?.disabledWhen;
    return condition ? matchesCondition(condition, values) : false;
  };

  const renderField = ([key, value]: [string, unknown], disabled = false) => {
    const isObject = value !== null && typeof value === 'object';
    const text = value === null || value === undefined ? '' : String(value);
    const isImage =
      typeof value === 'string' &&
      /(logo|img|image|ico|icon|avatar|banner|photo|qrcode)/i.test(key) &&
      !/(defined|css|size|type|mode|name)/i.test(key);
    const isImageList =
      Array.isArray(value) &&
      value.every((item) => typeof item === 'string') &&
      /(gallery|images|photos|pics|banner)/i.test(key);
    const isColor =
      typeof value === 'string' &&
      /(color|colour)/i.test(key) &&
      /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(text);
    const isRegion = /(^regionId$|provinceId$|cityId$|areaId$|^region$|^province$|^city$|^area$)/i.test(
      key,
    );
    const isSecret = typeof value === 'string' && /(secret|password|pass|token|key$)/i.test(key);
    const isRichText =
      typeof value === 'string' && /(content|notice|agreement|protocol)/i.test(key);
    const isBinaryFlag =
      (typeof value === 'number' || typeof value === 'string') &&
      ['0', '1'].includes(String(value)) &&
      /(enabled|enable|on$|is[A-Z]|show|open|close|can|use|auto|review|status|powered|hidden|switch|sign|bind)/i.test(
        key,
      ) &&
      !/(type|mode|provider|days|minute|limit|rate|size|count|sort|order|percent|number|price|id|amount)$/i.test(
        key,
      );
    const wide = isObject || isRichText || isImage || isImageList;
    const custom = renderers?.[key];
    return (
      <div className={`auto-config-field ${wide ? 'is-wide' : ''}`} key={key}>
        <label>{t(labelOf(key))}</label>
        <div className="auto-config-control">
        {custom ? (
          custom({ value, values, update })
        ) : isImageList ? (
          <ImageUploader
            value={(value as string[]) || []}
            onChange={(next) => update(key, next)}
          />
        ) : isImage ? (
          <ImageUploader
            single
            value={text ? [text] : []}
            onChange={(next) => update(key, next[0] || '')}
          />
        ) : isRichText ? (
          <RichTextEditor value={text} onChange={(next) => update(key, next)} height={260} />
        ) : isColor ? (
          <ColorPicker
            value={hexToColorValue(typeof text === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(text.trim()) ? text.trim() : '#ffffff')}
            onChange={(color: any) =>
              update(key, typeof color === 'string' ? color : color?.hex || '')
            }
          />
        ) : isRegion ? (
          <RegionSelect value={value as number | string} onChange={(next) => update(key, next)} />
        ) : isSecret ? (
          <SecretInput value={text} onChange={(next) => update(key, next)} />
        ) : controls?.[key] === 'options' ? (
          <RadioGroup
            value={value as string | number}
            disabled={disabled}
            options={options?.[key] || []}
            onChange={(event) => {
              const selected = (options?.[key] || []).find(
                (option) => String(option.value) === String(event.target.value),
              );
              update(key, selected?.value ?? event.target.value);
            }}
          />
        ) : controls?.[key] === 'multi' ? (
          <CheckboxGroup
            value={
              Array.isArray(value)
                ? (value as Array<string | number>)
                : String(value ?? '')
                    .split(',')
                    .map((item) => item.trim())
                    .filter(Boolean)
            }
            disabled={disabled}
            options={options?.[key] || []}
            onChange={(next) =>
              update(key, Array.isArray(value) ? next : (next as Array<string | number>).join(','))
            }
          />
        ) : controls?.[key] === 'select' ? (
          <Select
            style={{ width: 450 }}
            value={(value as string | number) ?? ''}
            disabled={disabled}
            optionList={(options?.[key] || []).map((option) => ({
              label: option.label,
              value: option.value,
            }))}
            onChange={(next) => update(key, next)}
          />
        ) : controls?.[key] === 'richtext' ? (
          <RichTextEditor value={text} onChange={(next) => update(key, next)} height={260} />
        ) : controls?.[key] === 'textarea' ? (
          <TextArea
            value={text}
            disabled={disabled}
            autosize={{ minRows: 4, maxRows: 8 }}
            onChange={(next) => update(key, next)}
          />
        ) : controls?.[key] === 'color' ? (
          <div className="auto-config-color-list">
            {(options?.[key] || []).map((option) => (
              <button
                type="button"
                key={String(option.value)}
                title={option.label}
                aria-label={option.label}
                className={`auto-config-color-item ${
                  String(value) === String(option.value) ? 'is-active' : ''
                }`}
                style={{ backgroundColor: option.color }}
                onClick={() => update(key, option.value)}
              />
            ))}
          </div>
        ) : controls?.[key] === 'segmented' ? (
          <RadioGroup
            type="button"
            value={String(value)}
            disabled={disabled}
            options={options?.[key] || []}
            onChange={(event) => update(key, event.target.value)}
          />
        ) : controls?.[key] === 'radio' ? (
          <RadioGroup
            value={String(value)}
            disabled={disabled}
            onChange={(event) => update(key, Number(event.target.value))}
          >
            <Radio value="1">{t('是')}</Radio>
            <Radio value="0">{t('否')}</Radio>
          </RadioGroup>
        ) : isBinaryFlag ? (
          <Switch
            disabled={disabled}
            checked={String(value) === '1'}
            onChange={(next) => update(key, next ? 1 : 0)}
          />
        ) : typeof value === 'boolean' ? (
          <Switch disabled={disabled} checked={value} onChange={(next) => update(key, next)} />
        ) : typeof value === 'number' ? (
          <InputNumber
            disabled={disabled}
            value={value}
            min={numberLimits?.[key]?.min}
            max={numberLimits?.[key]?.max}
            precision={numberLimits?.[key]?.precision}
            step={numberLimits?.[key]?.step}
            onChange={(next) => update(key, normalizeNumber(key, next))}
          />
        ) : isObject ? (
          <TextArea
            value={jsonDrafts[key] || ''}
            autosize={{ minRows: 3, maxRows: 8 }}
            onChange={(next) => setJsonDrafts((current) => ({ ...current, [key]: next }))}
          />
        ) : (
          <Input
            disabled={disabled}
            value={String(value ?? '')}
            onChange={(next) => update(key, next)}
            mode={/secret|password|pass/i.test(key) ? 'password' : undefined}
          />
        )}
        {fieldHelp?.[key] && <p className="auto-config-field-help">{fieldHelp[key]}</p>}
        </div>
      </div>
    );
  };

  const visibleEntries = entries.filter(([key]) => {
    if (!isFieldVisible(key)) return false;
    const fieldGroup = fieldGroups?.find((item) => item.fields.includes(key));
    return !fieldGroup || matchesCondition(fieldGroup.visibleWhen, values);
  });

  const renderSection = (group: (typeof grouped)[number], sectionIndex = 0) => {
    const renderedGroups = new Set<string>();
    return (
      <div className="auto-config-section" key={group.title || 'all'} id={`settings-section-${sectionIndex}`}>
        {group.title && (
          <h4>
            {t(group.title)}
            <span className="auto-config-section-count">{group.items.length}</span>
          </h4>
        )}
        <div className="auto-config-grid">
          {group.items.map(([key, value]) => {
            const fieldGroup = (fieldGroups || []).find((item) => item.fields.includes(key));
            if (fieldGroup) {
              if (renderedGroups.has(fieldGroup.title)) return null;
              if (!matchesCondition(fieldGroup.visibleWhen, values)) return null;
              renderedGroups.add(fieldGroup.title);
              const items = fieldGroup.fields
                .map((itemKey) => group.items.find(([innerKey]) => innerKey === itemKey))
                .filter((item): item is [string, unknown] => Boolean(item))
                .filter(([itemKey]) => isFieldVisible(itemKey));
              if (!items.length) return null;
              return (
                <div className="auto-config-subgroup" key={fieldGroup.title}>
                  <div className="auto-config-subgroup-head">
                    {fieldGroup.icon && (
                      <span className="auto-config-subgroup-icon">{fieldGroup.icon}</span>
                    )}
                    <div className="auto-config-subgroup-head-main">
                      <h5>{t(fieldGroup.title)}</h5>
                      {fieldGroup.description && (
                        <p className="auto-config-subgroup-desc">{t(fieldGroup.description)}</p>
                      )}
                    </div>
                    {fieldGroup.tag && (
                      <span className="auto-config-subgroup-tag">{t(fieldGroup.tag)}</span>
                    )}
                  </div>
                  <div className="auto-config-subgroup-body">
                    <div className="auto-config-grid">
                      {items.map((item) => renderField(item, isFieldDisabled(item[0])))}
                    </div>
                  </div>
                </div>
              );
            }
            if (!isFieldVisible(key)) return null;
            return renderField([key, value], isFieldDisabled(key));
          })}
        </div>
      </div>
    );
  };

  const promptModal = (
    <Modal
      title={actionPrompt ? t(actionPrompt.action.prompt?.label || '请输入') : ''}
      visible={Boolean(actionPrompt)}
      okText={t('确定')}
      cancelText={t('取消')}
      onCancel={() => setActionPrompt(null)}
      onOk={() => {
        if (!actionPrompt) return;
        const { action, value } = actionPrompt;
        setActionPrompt(null);
        void runAction(action, value.trim());
      }}
    >
      <Input
        value={actionPrompt?.value ?? ''}
        placeholder={actionPrompt ? t(actionPrompt.action.prompt?.placeholder || '') : undefined}
        onChange={(next) =>
          setActionPrompt((current) => (current ? { ...current, value: next } : current))
        }
      />
    </Modal>
  );

  if (modern !== false) {
    return (
      <>
        <div className="base-settings-list">
          {grouped.map((group, index) => (
            <Card
              key={group.title || index}
              className="base-settings-card"
              title={
                <div className="base-settings-card__title">
                  <span className="base-settings-card__icon">{CONFIG_SECTION_ICONS[group.title] || <IconSetting />}</span>
                  <span className="base-settings-card__title-text">
                    <strong>{t(group.title || '其他')}</strong>
                    <small>
                      {t(CONFIG_SECTION_DESCRIPTIONS[group.title] || '配置{title}相关参数。', {
                        title: t(group.title || '其他'),
                      })}
                    </small>
                  </span>
                </div>
              }
              headerExtraContent={
                <Space>
                  <span className="base-settings-card__count">
                    {t('{count} 项', { count: group.items.length })}
                  </span>
                  {actionButtons(visibleActions(group.title))}
                </Space>
              }
            >
              {renderSection(group, index)}
            </Card>
          ))}
          <div className="base-settings-list__actions">
            <Space wrap>
              {actionButtons(visibleActions(undefined))}
              <Button theme="solid" type="primary" loading={saving || loading} onClick={save}>
                {t('保存')}
              </Button>
            </Space>
          </div>
        </div>
        {promptModal}
      </>
    );
  }

  return (
    <>
      <Card className="auto-config-card" shadows="hover">
        <div className="auto-config-head">
          <Text type="tertiary" size="small">
            {t('共 {count} 项配置', { count: visibleEntries.length })}
          </Text>
        </div>
        {grouped.map((group, index) => renderSection(group, index))}
        <div className="auto-config-actions">
          <Space wrap>
            {actionButtons((actions || []).filter((action) => !action.visibleWhen || action.visibleWhen(values)))}
            <Button theme="solid" type="primary" loading={saving || loading} onClick={save}>
              {t('保存')}
            </Button>
          </Space>
        </div>
      </Card>
      {promptModal}
    </>
  );
}

/** hex → Semi ColorPicker 的 ColorValue（2.104 要求 {hsva, rgba, hex} 对象，传字符串会崩）。 */
export function hexToColorValue(hex: string): {
  hsva: { h: number; s: number; v: number; a: number };
  rgba: { r: number; g: number; b: number; a: number };
  hex: string;
} {
  let clean = hex.replace('#', '');
  if (clean.length === 3 || clean.length === 4) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const r = parseInt(clean.slice(0, 2), 16) || 0;
  const g = parseInt(clean.slice(2, 4), 16) || 0;
  const b = parseInt(clean.slice(4, 6), 16) || 0;
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
  }
  h = Math.round((h < 0 ? h + 6 : h) * 60);
  const s = max === 0 ? 0 : Math.round((d / max) * 100);
  const v = Math.round(max * 100);
  return { hsva: { h, s, v, a: 1 }, rgba: { r, g, b, a: 1 }, hex };
}

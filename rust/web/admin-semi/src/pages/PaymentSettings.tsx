import { useState, type ReactNode } from 'react';
import { Button, RadioGroup, Tabs, Toast } from '@douyinfe/semi-ui';
import AutoConfigPage, {
  type ConfigControlType,
  type ConfigFieldRule,
  type ConfigRendererContext,
} from './AutoConfigPage';
import PaymentOrderList from '../components/PaymentOrderList';
import CertFileUpload from '../components/CertFileUpload';
import SecretInput from '../components/SecretInput';
import { Select } from '@douyinfe/semi-ui';
import { apiPost } from '../api';
import { useI18n } from '../i18n';

interface ListOption {
  name?: string;
  label?: string;
  value?: string | number;
}

interface PaymentTabDef {
  key: string;
  label: string;
  title: string;
  getApi: string;
  saveApi: string;
  sections: Array<{ title: string; fields: string[] }>;
  labels: Record<string, string>;
  controls?: Record<string, ConfigControlType>;
  options?: Record<string, Array<{ label: string; value: string | number; color?: string }>>;
  rules?: Record<string, ConfigFieldRule>;
  fieldHelp?: Record<string, string>;
  hiddenFields?: string[];
  defaults?: Record<string, unknown>;
  renderers?: Record<string, (context: ConfigRendererContext) => ReactNode>;
  notice?: string;
}

const paymentOrderOptions = [
  { label: '微信支付', value: 'wechat' },
  { label: '支付宝', value: 'alipay' },
  { label: '汇付-微信支付', value: 'huifuWechat' },
  { label: '汇付-支付宝', value: 'huifuAlipay' },
  { label: '拉卡拉-微信支付', value: 'lakalaWechat' },
  { label: '拉卡拉-支付宝', value: 'lakalaAlipay' },
  { label: '易宝-微信支付', value: 'yeepayWechat' },
  { label: '易宝-支付宝', value: 'yeepayAlipay' },
  { label: 'PayPal', value: 'paypal' },
  { label: 'Apple Pay', value: 'applepay' },
];

const networkOptions = [
  { label: '银联', value: 'chinaUnionPay' },
  { label: 'Visa', value: 'visa' },
  { label: 'MasterCard', value: 'masterCard' },
  { label: 'American Express', value: 'amex' },
  { label: 'JCB', value: 'jcb' },
  { label: 'Discover', value: 'discover' },
];

const providerOptions = [
  { label: '通用自解密(generic)', value: 'generic' },
  { label: 'Adyen(adyen)', value: 'adyen' },
  { label: '银联商务(ums)', value: 'ums' },
];

const umsSignTypeOptions = [
  { label: 'SHA256', value: 'SHA256' },
  { label: 'SM3', value: 'SM3' },
];

const supportRadio = (onLabel: string, offLabel: string) => [
  { label: onLabel, value: 1 },
  { label: offLabel, value: 0 },
];

function PaymentOrderField({ value, update }: ConfigRendererContext) {
  const { t } = useI18n();
  return (
    <PaymentOrderList
      value={String(value ?? '')}
      options={paymentOrderOptions.map((item) => ({ ...item, label: t(item.label) }))}
      onChange={(next) => update('paymentOrder', next)}
    />
  );
}

const paymentOrderRenderer = (context: ConfigRendererContext) => <PaymentOrderField {...context} />;

interface CertUploadFieldProps extends ConfigRendererContext {
  field: string;
  uploadType: number;
  fileHint: string;
}

function CertUploadField({ field, uploadType, fileHint, value, update }: CertUploadFieldProps) {
  const { t } = useI18n();
  return (
    <CertFileUpload
      value={value}
      uploadType={uploadType}
      fileHint={t(fileHint)}
      onChange={(next) => update(field, next)}
    />
  );
}

const certUploadRenderer = (field: string, uploadType: number, fileHint: string) =>
  (context: ConfigRendererContext) => (
    <CertUploadField
      field={field}
      uploadType={uploadType}
      fileHint={fileHint}
      value={context.value}
      values={context.values}
      update={context.update}
    />
  );

const secretRenderer = (field: string) =>
  ({ value, update }: ConfigRendererContext) => (
    <SecretInput value={String(value ?? '')} onChange={(next) => update(field, next)} />
  );

interface ListSelectFieldProps extends ConfigRendererContext {
  field: string;
  listKey: string;
  fallback: ListOption[];
}

function ListSelectField({ field, listKey, fallback, value, values, update }: ListSelectFieldProps) {
  const { t } = useI18n();
  const raw = values[listKey];
  const useBackendList = Array.isArray(raw) && raw.length > 0;
  const list = useBackendList ? (raw as ListOption[]) : fallback;
  const optionList = list
    .map((item) => {
      const name = String(item.name ?? item.label ?? '');
      return {
        label: useBackendList ? name : t(name),
        value: item.value as string | number,
      };
    })
    .filter((item) => item.value !== undefined);
  return (
    <Select
      style={{ width: 450 }}
      value={(value as string | number) ?? ''}
      optionList={optionList}
      onChange={(next) => update(field, next)}
    />
  );
}

const listSelectRenderer = (field: string, listKey: string, fallback: ListOption[]) =>
  (context: ConfigRendererContext) => (
    <ListSelectField
      field={field}
      listKey={listKey}
      fallback={fallback}
      value={context.value}
      values={context.values}
      update={context.update}
    />
  );

function PlatformCertificateButton({ value, update }: ConfigRendererContext) {
  const { t } = useI18n();
  return (
    <Button
      type="warning"
      theme="solid"
      onClick={async () => {
        try {
          await apiPost('/setting/config/createPlatformCertificate', {});
          update('wechatPayPlatformCertificate', 1);
          Toast.success({ content: t('操作成功') });
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      }}
    >
      {Number(value) === 1 ? t('更新证书') : t('生成证书')}
    </Button>
  );
}

const platformCertRenderer = (context: ConfigRendererContext) => <PlatformCertificateButton {...context} />;

const baseTab: PaymentTabDef = {
  key: 'base',
  label: '基础设置',
  title: '基础设置',
  getApi: '/setting/config/basicPaySettings',
  saveApi: '/setting/config/saveBasicPay',
  sections: [
    { title: '基础支付设置', fields: ['useSurplus', 'usePoints', 'useCoupon', 'useCredit'] },
    { title: '支付顺序', fields: ['paymentOrder'] },
  ],
  labels: {
    useSurplus: '余额支付',
    usePoints: '积分抵扣',
    useCoupon: '优惠券',
    useCredit: '账期支付',
    paymentOrder: '支付顺序',
  },
  controls: {
    useSurplus: 'options',
    usePoints: 'options',
    useCoupon: 'options',
    useCredit: 'options',
  },
  options: {
    useSurplus: supportRadio('支持', '不支持'),
    usePoints: supportRadio('支持', '不支持'),
    useCoupon: supportRadio('支持', '不支持'),
    useCredit: supportRadio('支持', '不支持'),
  },
  fieldHelp: {
    useSurplus: '订单结算页面是否支持余额支付功能，不支持则不显示',
    usePoints: '订单结算页面是否支持积分抵扣功能，不支持则不显示',
    useCoupon: '订单结算页面是否支持优惠券功能，不支持则不显示',
    useCredit:
      '若要开启此功能，需要先开启实名认证；在用户端的订单结算页面，对已开通账期支付功能的用户，显示可使用账期支付功能',
    paymentOrder: '前端展示的支付顺序，拖拽排序后点击提交按钮保存',
  },
  renderers: { paymentOrder: paymentOrderRenderer },
};

const wechatTab: PaymentTabDef = {
  key: 'wechat',
  label: '微信支付',
  title: '微信支付',
  getApi: '/setting/config/wechatPaySettings',
  saveApi: '/setting/config/saveWechatPay',
  sections: [
    {
      title: '微信支付设置',
      fields: [
        'useWechat',
        'wechatMchidType',
        'wechatPayMchid',
        'wechatPaySubMchid',
        'wechatPayKey',
        'wechatPayV2Key',
        'wechatPayCheckType',
        'wechatPaySerialNo',
        'wechatPayCertificate',
        'wechatPayPrivateKey',
        'wechatPayPlatformCertificate',
        'wechatPayPublicKeyId',
        'wechatPayPublicKey',
      ],
    },
    { title: '微信小程序支付', fields: ['wechatMiniProgramAppId', 'wechatMiniProgramSecret'] },
    { title: '微信APP支付', fields: ['wechatPayAppId', 'wechatPayAppSecret'] },
  ],
  labels: {
    useWechat: '是否开启',
    wechatMchidType: '微信商户类型',
    wechatPayMchid: '微信商户号',
    wechatPaySubMchid: '微信子商户号',
    wechatPayKey: '商户APIv3密钥',
    wechatPayV2Key: '商户APIV2密钥',
    wechatPayCheckType: '验证微信支付方式',
    wechatPaySerialNo: '商户证书序列号',
    wechatPayCertificate: '商户API证书',
    wechatPayPrivateKey: '商户API证书密钥',
    wechatPayPlatformCertificate: '平台证书',
    wechatPayPublicKeyId: '微信支付公钥ID',
    wechatPayPublicKey: '微信支付公钥文件',
    wechatMiniProgramAppId: '微信小程序AppID',
    wechatMiniProgramSecret: '微信小程序AppSecret',
    wechatPayAppId: '应用APP ID',
    wechatPayAppSecret: '应用APP SECRET',
  },
  controls: {
    useWechat: 'options',
    wechatMchidType: 'options',
    wechatPayCheckType: 'options',
  },
  options: {
    useWechat: supportRadio('开启', '关闭'),
    wechatMchidType: [
      { label: '普通商户模式', value: 1 },
      { label: '服务商模式', value: 2 },
    ],
    wechatPayCheckType: [
      { label: '平台证书', value: 1 },
      { label: '微信支付公钥', value: 2 },
    ],
  },
  rules: {
    wechatMchidType: { visibleWhen: { field: 'useWechat', equals: 1 } },
    wechatPayMchid: { visibleWhen: { field: 'useWechat', equals: 1 } },
    wechatPaySubMchid: {
      visibleWhen: { all: [{ field: 'useWechat', equals: 1 }, { field: 'wechatMchidType', equals: 2 }] },
    },
    wechatPayKey: { visibleWhen: { field: 'useWechat', equals: 1 } },
    wechatPayV2Key: { visibleWhen: { field: 'useWechat', equals: 1 } },
    wechatPayCheckType: { visibleWhen: { field: 'useWechat', equals: 1 } },
    wechatPaySerialNo: { visibleWhen: { field: 'useWechat', equals: 1 } },
    wechatPayCertificate: { visibleWhen: { field: 'useWechat', equals: 1 } },
    wechatPayPrivateKey: { visibleWhen: { field: 'useWechat', equals: 1 } },
    wechatPayPlatformCertificate: {
      visibleWhen: { all: [{ field: 'useWechat', equals: 1 }, { field: 'wechatPayCheckType', equals: 1 }] },
    },
    wechatPayPublicKeyId: {
      visibleWhen: { all: [{ field: 'useWechat', equals: 1 }, { field: 'wechatPayCheckType', equals: 2 }] },
    },
    wechatPayPublicKey: {
      visibleWhen: { all: [{ field: 'useWechat', equals: 1 }, { field: 'wechatPayCheckType', equals: 2 }] },
    },
    wechatMiniProgramAppId: { visibleWhen: { field: 'useWechat', equals: 1 } },
    wechatMiniProgramSecret: { visibleWhen: { field: 'useWechat', equals: 1 } },
    wechatPayAppId: { visibleWhen: { field: 'useWechat', equals: 1 } },
    wechatPayAppSecret: { visibleWhen: { field: 'useWechat', equals: 1 } },
  },
  fieldHelp: {
    useWechat: '是否开启微信支付，如关闭则不显示微信支付选项',
    wechatPaySubMchid: '请填写由服务商提供的子商户号',
    wechatPayKey: '请使用APIv3密钥，编辑完成后，点击下方提交按钮确认修改，请确保填写正确的商户APIv3密钥',
    wechatPayV2Key: '请使用APIv2密钥，编辑完成后，点击下方提交按钮确认修改，请确保填写正确的商户APIV2密钥',
    wechatPaySerialNo: '请使用API证书序列号',
    wechatPayCertificate:
      '调用微信商户接口时需要用到的API证书，文件名称一般为apiclient_cert.pem，具体操作请参考教程',
    wechatPayPrivateKey:
      '调用微信商户接口时需要用到的API证书密钥，文件名称一般为apiclient_key.pem，具体操作请参考教程',
    wechatPayPlatformCertificate:
      '调用微信商户接口时需要用到的平台证书，上传API证书后需要更新平台证书，具体操作请参考教程',
    wechatPayPublicKeyId: '请使用微信支付公钥ID',
    wechatPayPublicKey:
      '调用微信商户接口时需要用到的公钥证书，文件名称一般为public.pem，具体操作请参考教程',
    wechatMiniProgramAppId: '微信小程序公众平台->设置->开发设置中获取，开通小程序必填',
    wechatMiniProgramSecret:
      '微信小程序公众平台->设置->开发设置中获取，开通小程序必填；编辑完成后，点击下方提交按钮确认修改，请确保填写正确的微信小程序AppSecret',
    wechatPayAppId: '需开通微信开发者平台，创建APP应用（未开通本系统APP商城可忽略）',
    wechatPayAppSecret:
      '需通微信开发者平台获取（未开通本系统APP商城可忽略）；编辑完成后，点击下方提交按钮确认修改，请确保填写正确的应用APP SECRET',
  },
  defaults: {
    wechatPayCertificate: 0,
    wechatPayPrivateKey: 0,
    wechatPayPlatformCertificate: 0,
    wechatPayPublicKey: 0,
  },
  renderers: {
    wechatPayCertificate: certUploadRenderer('wechatPayCertificate', 1, 'apiclient_cert.pem'),
    wechatPayPrivateKey: certUploadRenderer('wechatPayPrivateKey', 2, 'apiclient_key.pem'),
    wechatPayPlatformCertificate: platformCertRenderer,
    wechatPayPublicKey: certUploadRenderer('wechatPayPublicKey', 3, '微信支付公钥文件（如：pub_key.pem）'),
  },
};

const alipayTab: PaymentTabDef = {
  key: 'alipay',
  label: '支付宝',
  title: '支付宝',
  getApi: '/setting/config/aliPaySettings',
  saveApi: '/setting/config/saveAliPay',
  sections: [
    {
      title: '支付宝设置',
      fields: ['useAlipay', 'alipayRsaPrivateKey', 'alipayRsaPublicKey', 'alipayAppAuthToken'],
    },
    { title: '网页应用支付', fields: ['alipayAppid'] },
    { title: '移动应用支付', fields: ['alipayMobileAppid'] },
    {
      title: '资金分账',
      fields: [
        'alipayDelayAcctEnabled',
        'alipayProfitSharingEnabled',
        'alipayProfitSharingMaxRatio',
        'alipayProfitSharingNotifyUrl',
        'alipayProfitSharingPlatformId',
        'alipayProfitSharingRuleOrigin',
      ],
    },
  ],
  labels: {
    useAlipay: '是否开启',
    alipayRsaPrivateKey: '应用私钥',
    alipayRsaPublicKey: '支付宝公钥',
    alipayAppid: '支付APPID',
    alipayMobileAppid: '支付APPID',
    alipayAppAuthToken: '应用授权令牌',
    alipayDelayAcctEnabled: '延迟入账',
    alipayProfitSharingEnabled: '分账',
    alipayProfitSharingMaxRatio: '最大分账比例',
    alipayProfitSharingNotifyUrl: '分账通知地址',
    alipayProfitSharingPlatformId: '分账平台 ID',
    alipayProfitSharingRuleOrigin: '分账规则来源',
  },
  controls: { useAlipay: 'options' },
  options: { useAlipay: supportRadio('开启', '关闭') },
  rules: {
    alipayRsaPrivateKey: { visibleWhen: { field: 'useAlipay', equals: 1 } },
    alipayRsaPublicKey: { visibleWhen: { field: 'useAlipay', equals: 1 } },
    alipayAppid: { visibleWhen: { field: 'useAlipay', equals: 1 } },
    alipayMobileAppid: { visibleWhen: { field: 'useAlipay', equals: 1 } },
    alipayAppAuthToken: { visibleWhen: { field: 'useAlipay', equals: 1 } },
    alipayDelayAcctEnabled: { visibleWhen: { field: 'useAlipay', equals: 1 } },
    alipayProfitSharingEnabled: { visibleWhen: { field: 'useAlipay', equals: 1 } },
    alipayProfitSharingMaxRatio: { visibleWhen: { field: 'useAlipay', equals: 1 } },
    alipayProfitSharingNotifyUrl: { visibleWhen: { field: 'useAlipay', equals: 1 } },
    alipayProfitSharingPlatformId: { visibleWhen: { field: 'useAlipay', equals: 1 } },
    alipayProfitSharingRuleOrigin: { visibleWhen: { field: 'useAlipay', equals: 1 } },
  },
  fieldHelp: {
    useAlipay: '是否开启支付宝支付，如关闭则不显示支付宝支付选项',
    alipayRsaPrivateKey: '编辑完成后，点击下方提交按钮确认修改，请确保填写正确的应用私钥',
    alipayRsaPublicKey: '编辑完成后，点击下方提交按钮确认修改，请确保填写正确的支付宝公钥',
  },
};

const offlineTab: PaymentTabDef = {
  key: 'offline',
  label: '线下支付',
  title: '线下支付',
  getApi: '/setting/config/offlinePaySettings',
  saveApi: '/setting/config/saveOfflinePay',
  sections: [
    { title: '线下支付设置', fields: ['useOffline'] },
    {
      title: '汇款方式',
      fields: [
        'thirdPartyPaymentTransferEnable',
        'offlinePayBankEnable',
        'offlinePayCompanyEnable',
        'otherPaymentRemittanceEnable',
      ],
    },
    {
      title: '汇款说明',
      fields: [
        'thirdPartyPaymentTransfer',
        'offlinePayBank',
        'offlinePayCompany',
        'otherPaymentRemittance',
      ],
    },
  ],
  // 汇款方式 paymentMethods 在旧版由复选框合成；此处由 4 个 Enable 开关直接表达，行为一致
  labels: {
    useOffline: '是否开启',
    thirdPartyPaymentTransferEnable: '第三方支付转账',
    offlinePayBankEnable: '银行汇款',
    offlinePayCompanyEnable: '企业汇款',
    otherPaymentRemittanceEnable: '其他汇款方式',
    thirdPartyPaymentTransfer: '第三方支付转账说明',
    offlinePayBank: '银行汇款说明',
    offlinePayCompany: '企业汇款说明',
    otherPaymentRemittance: '其他汇款方式说明',
  },
  controls: {
    thirdPartyPaymentTransfer: 'richtext',
    offlinePayBank: 'richtext',
    offlinePayCompany: 'richtext',
    otherPaymentRemittance: 'richtext',
  },
  rules: {
    thirdPartyPaymentTransferEnable: { visibleWhen: { field: 'useOffline', equals: 1 } },
    offlinePayBankEnable: { visibleWhen: { field: 'useOffline', equals: 1 } },
    offlinePayCompanyEnable: { visibleWhen: { field: 'useOffline', equals: 1 } },
    otherPaymentRemittanceEnable: { visibleWhen: { field: 'useOffline', equals: 1 } },
    thirdPartyPaymentTransfer: {
      visibleWhen: {
        all: [{ field: 'useOffline', equals: 1 }, { field: 'thirdPartyPaymentTransferEnable', equals: 1 }],
      },
    },
    offlinePayBank: {
      visibleWhen: {
        all: [{ field: 'useOffline', equals: 1 }, { field: 'offlinePayBankEnable', equals: 1 }],
      },
    },
    offlinePayCompany: {
      visibleWhen: {
        all: [{ field: 'useOffline', equals: 1 }, { field: 'offlinePayCompanyEnable', equals: 1 }],
      },
    },
    otherPaymentRemittance: {
      visibleWhen: {
        all: [{ field: 'useOffline', equals: 1 }, { field: 'otherPaymentRemittanceEnable', equals: 1 }],
      },
    },
  },
  fieldHelp: {
    useOffline: '是否开启线下支付，如关闭则不显示线下支付选项',
    thirdPartyPaymentTransferEnable: '选择可用的汇款方式，至少选择一种',
  },
  defaults: {
    thirdPartyPaymentTransferEnable: 0,
    offlinePayBankEnable: 0,
    offlinePayCompanyEnable: 0,
    otherPaymentRemittanceEnable: 0,
  },
};

const applePayTab: PaymentTabDef = {
  key: 'applepay',
  label: 'Apple Pay',
  title: 'Apple Pay',
  getApi: '/setting/config/applePaySettings',
  saveApi: '/setting/config/saveApplePay',
  sections: [
    {
      title: '基础参数',
      fields: [
        'applePayMerchantId',
        'applePayDisplayName',
        'applePayCountryCode',
        'applePayCurrency',
        'applePaySupportedNetworks',
      ],
    },
    {
      title: '证书配置',
      fields: [
        'applePayMerchantIdentityCert',
        'applePayMerchantIdentityKey',
        'applePayProcessingPrivateKey',
      ],
    },
    {
      title: '收单通道',
      fields: [
        'applePayAcquirerProvider',
        'applePayUmsSignType',
        'applePayAcquirerGateway',
        'applePayAcquirerMerchantNo',
        'applePayAcquirerKey',
      ],
    },
  ],
  labels: {
    useApplePay: '是否开启',
    applePayMerchantId: '商户标识 Merchant ID',
    applePayDisplayName: '商户展示名',
    applePayCountryCode: '国家/地区',
    applePayCurrency: '货币',
    applePaySupportedNetworks: '支持卡组织',
    applePayMerchantIdentityCert: '商户身份证书',
    applePayMerchantIdentityKey: '商户身份证书私钥',
    applePayProcessingPrivateKey: '支付处理证书私钥',
    applePayAcquirerProvider: '收单机构',
    applePayUmsSignType: '银联签名类型',
    applePayAcquirerGateway: '收单网关地址',
    applePayAcquirerMerchantNo: '收单商户号',
    applePayAcquirerKey: '收单密钥',
  },
  hiddenFields: ['applePayCountryList', 'applePayCountryListStr', 'applePayCurrencyList', 'applePayCurrencyListStr'],
  controls: {
    useApplePay: 'options',
    applePayAcquirerProvider: 'select',
    applePayUmsSignType: 'select',
    applePaySupportedNetworks: 'multi',
  },
  options: {
    useApplePay: supportRadio('开启', '关闭'),
    applePayAcquirerProvider: providerOptions,
    applePayUmsSignType: umsSignTypeOptions,
    applePaySupportedNetworks: networkOptions,
  },
  rules: {
    applePayMerchantId: { visibleWhen: { field: 'useApplePay', equals: 1 } },
    applePayDisplayName: { visibleWhen: { field: 'useApplePay', equals: 1 } },
    applePayCountryCode: { visibleWhen: { field: 'useApplePay', equals: 1 } },
    applePayCurrency: { visibleWhen: { field: 'useApplePay', equals: 1 } },
    applePaySupportedNetworks: { visibleWhen: { field: 'useApplePay', equals: 1 } },
    applePayMerchantIdentityCert: { visibleWhen: { field: 'useApplePay', equals: 1 } },
    applePayMerchantIdentityKey: { visibleWhen: { field: 'useApplePay', equals: 1 } },
    applePayProcessingPrivateKey: {
      visibleWhen: {
        all: [{ field: 'useApplePay', equals: 1 }, { field: 'applePayAcquirerProvider', equals: 'generic' }],
      },
    },
    applePayAcquirerProvider: { visibleWhen: { field: 'useApplePay', equals: 1 } },
    applePayUmsSignType: {
      visibleWhen: {
        all: [{ field: 'useApplePay', equals: 1 }, { field: 'applePayAcquirerProvider', equals: 'ums' }],
      },
    },
    applePayAcquirerGateway: { visibleWhen: { field: 'useApplePay', equals: 1 } },
    applePayAcquirerMerchantNo: { visibleWhen: { field: 'useApplePay', equals: 1 } },
    applePayAcquirerKey: { visibleWhen: { field: 'useApplePay', equals: 1 } },
  },
  fieldHelp: {
    useApplePay: '是否开启Apple Pay支付，如关闭则不显示Apple Pay支付选项',
    applePayMerchantId: 'Apple开发者后台创建的Merchant ID，形如 merchant.com.yourshop',
    applePayDisplayName: '展示在Apple Pay支付面板中的商户名称',
    applePayCountryCode: '收单商户注册地国家码（ISO 3166 两位码），影响支付面板合规展示',
    applePayCurrency:
      '结算币种（ISO 4217 三位码），须与收单通道商户号支持币种一致。请保持和商城默认货币一致，否则会导致下单和结账货币不一致',
    applePaySupportedNetworks: '用户钱包中仅这些卡组织的卡可用于支付；境内收单请勾选银联',
    applePayMerchantIdentityCert: '与Apple服务器建立商户校验会话所需证书（Merchant Identity Certificate）',
    applePayMerchantIdentityKey: '商户身份证书对应私钥',
    applePayProcessingPrivateKey:
      '用于解密Apple Pay支付Token的私钥（Payment Processing Certificate 私钥）；当前收单机构由对方解密支付凭据时，无需上传支付处理证书私钥',
    applePayAcquirerProvider:
      '收单机构：通用自解密由我方解密卡凭据（需支付处理证书）；Adyen/银联商务由对方解密（无需支付处理证书）',
    applePayUmsSignType: '银联商务报文签名算法，默认 SHA256，可选 SM3（需与收单商户开通的算法一致）',
    applePayAcquirerGateway: '收单机构提供的支付网关地址（测试/生产不同）',
    applePayAcquirerMerchantNo: '收单机构分配的商户号。未修改时请勿清空，原样提交即可（后端识别掩码后跳过更新）',
    applePayAcquirerKey: '收单机构分配的API密钥，编辑完成后点击下方提交按钮确认修改',
  },
  defaults: {
    applePayMerchantIdentityCert: 0,
    applePayMerchantIdentityKey: 0,
    applePayProcessingPrivateKey: 0,
  },
  renderers: {
    applePayCountryCode: listSelectRenderer('applePayCountryCode', 'applePayCountryList', [
      { name: '中国', value: 'CN' },
    ]),
    applePayCurrency: listSelectRenderer('applePayCurrency', 'applePayCurrencyList', [
      { name: '人民币', value: 'CNY' },
    ]),
    applePayMerchantIdentityCert: certUploadRenderer(
      'applePayMerchantIdentityCert',
      4,
      'apple_pay_merchant_id.pem',
    ),
    applePayMerchantIdentityKey: certUploadRenderer(
      'applePayMerchantIdentityKey',
      5,
      'apple_pay_merchant_id_key.pem',
    ),
    applePayProcessingPrivateKey: certUploadRenderer(
      'applePayProcessingPrivateKey',
      6,
      'apple_pay_payment_processing_key.pem',
    ),
    applePayAcquirerMerchantNo: secretRenderer('applePayAcquirerMerchantNo'),
  },
  notice:
    '配置前请了解以下几点：1. 展示范围：Apple Pay 只会在 iPhone、Mac 的 Safari 浏览器且设备已开通 Apple Pay 时，才在收银台出现；微信内、小程序、安卓、Chrome 等环境会自动隐藏，属正常现象，无需处理。2. 参数来源：下方的商户信息、证书与收单参数均需从 Apple 开发者后台和收单机构处获取；证书和密钥涉及资金安全，请妥善保管、切勿外泄。3. 上线前提：保存并开启后，还需在 Apple 开发者后台完成各前台域名验证，并将验证文件部署到对应域名的 /.well-known/ 目录，否则用户端将无法唤起 Apple Pay。',
};

const payPalTab: PaymentTabDef = {
  key: 'payPal',
  label: 'PayPal',
  title: 'PayPal',
  getApi: '/setting/config/payPalSettings',
  saveApi: '/setting/config/savePayPal',
  sections: [
    { title: 'PayPal支付设置', fields: ['usePaypal', 'paypalCurrency', 'paypalClientId', 'paypalSecret'] },
  ],
  labels: {
    usePaypal: '是否开启',
    paypalCurrency: '货币',
    paypalClientId: 'Client ID',
    paypalSecret: 'Secret',
  },
  hiddenFields: ['paypalCurrencyList', 'paypalCurrencyListStr'],
  controls: { usePaypal: 'options' },
  options: { usePaypal: supportRadio('开启', '关闭') },
  rules: {
    paypalCurrency: { visibleWhen: { field: 'usePaypal', equals: 1 } },
    paypalClientId: { visibleWhen: { field: 'usePaypal', equals: 1 } },
    paypalSecret: { visibleWhen: { field: 'usePaypal', equals: 1 } },
  },
  fieldHelp: {
    usePaypal: '是否开启PayPal支付，如关闭则不显示PayPal支付选项',
    paypalCurrency:
      '如果选择了默认国家，则会员在选择地址时默认会显示该国家下的省份或地区，不再显示国家选择（修改设置对已经添加的会员地址不生效）。请保持和商城默认货币一致，否则会导致下单和结账货币不一致',
    paypalSecret: '编辑完成后，点击下方提交按钮确认修改，请确保填写正确的Secret',
  },
  renderers: {
    paypalCurrency: listSelectRenderer('paypalCurrency', 'paypalCurrencyList', [
      { name: '不选择', value: 0 },
    ]),
  },
};

const huifuTab: PaymentTabDef = {
  key: 'huifu',
  label: '汇付天下',
  title: '汇付天下',
  getApi: '/setting/config/huifuSettings',
  saveApi: '/setting/config/saveHuifu',
  sections: [
    {
      title: '汇付天下支付设置',
      fields: [
        'useHuifu',
        'huifuSysId',
        'huifuProductId',
        'huifuMerchantId',
        'huifuRsaPrivateKey',
        'huifuPublicKey',
        'huifuGateway',
        'huifuHostingProjectId',
      ],
    },
    {
      title: '资金分账',
      fields: [
        'huifuDelayAcctEnabled',
        'huifuProfitSharingEnabled',
        'huifuProfitSharingMaxRatio',
        'huifuProfitSharingNotifyUrl',
        'huifuProfitSharingRuleOrigin',
      ],
    },
  ],
  labels: {
    useHuifu: '是否开启',
    huifuSysId: '系统号',
    huifuProductId: '产品号',
    huifuMerchantId: '商户号',
    huifuRsaPrivateKey: '商户RSA私钥',
    huifuPublicKey: '汇付公钥',
    huifuGateway: '网关地址',
    huifuHostingProjectId: '托管项目号',
    huifuDelayAcctEnabled: '延迟入账',
    huifuProfitSharingEnabled: '分账',
    huifuProfitSharingMaxRatio: '最大分账比例',
    huifuProfitSharingNotifyUrl: '分账通知地址',
    huifuProfitSharingRuleOrigin: '分账规则来源',
  },
  controls: { useHuifu: 'options' },
  options: { useHuifu: supportRadio('开启', '关闭') },
  rules: {
    huifuSysId: { visibleWhen: { field: 'useHuifu', equals: 1 } },
    huifuProductId: { visibleWhen: { field: 'useHuifu', equals: 1 } },
    huifuMerchantId: { visibleWhen: { field: 'useHuifu', equals: 1 } },
    huifuRsaPrivateKey: { visibleWhen: { field: 'useHuifu', equals: 1 } },
    huifuPublicKey: { visibleWhen: { field: 'useHuifu', equals: 1 } },
    huifuGateway: { visibleWhen: { field: 'useHuifu', equals: 1 } },
    huifuHostingProjectId: { visibleWhen: { field: 'useHuifu', equals: 1 } },
    huifuDelayAcctEnabled: { visibleWhen: { field: 'useHuifu', equals: 1 } },
    huifuProfitSharingEnabled: { visibleWhen: { field: 'useHuifu', equals: 1 } },
    huifuProfitSharingMaxRatio: { visibleWhen: { field: 'useHuifu', equals: 1 } },
    huifuProfitSharingNotifyUrl: { visibleWhen: { field: 'useHuifu', equals: 1 } },
    huifuProfitSharingRuleOrigin: { visibleWhen: { field: 'useHuifu', equals: 1 } },
  },
  fieldHelp: {
    useHuifu: '开启后，用户在支付页可使用「微信支付」「支付宝支付」；关闭则不展示这两个选项',
    huifuSysId: '登录汇付商户控台（dashboard.huifu.com）→开发设置→开发者信息中获取',
    huifuProductId: '登录汇付商户控台→开发设置→开发者信息中获取，产品号对同一商户固定',
    huifuMerchantId: '商户进件成功后由汇付分配，在汇付商户控台→商户管理→商户信息查询中获取',
    huifuRsaPrivateKey:
      '在汇付商户控台→开发设置→密钥管理中自助生成并下载（私钥仅首次生成时可下载，请妥善保管、不要外泄）。如无需更换，保持原样直接提交即可',
    huifuPublicKey:
      '在汇付商户控台→开发设置→密钥管理中获取的「汇付公钥」，用于校验汇付返回结果。如无需更换，保持原样直接提交即可',
    huifuGateway: '汇付接口地址，正式环境为 https://api.huifu.com；测试环境地址不同，请以汇付对接文档为准',
    huifuHostingProjectId: 'PC 端收银台使用的托管项目号，在汇付商户控台中获取；不使用 PC 收银台时可留空',
  },
  notice:
    '汇付斗拱是汇付天下旗下的聚合支付品牌，一次接入即可同时支持微信、支付宝收款。开启后，支付页面将展示「微信支付」「支付宝支付」两个选项，用户付款体验与原生一致、对汇付渠道无感知。以下参数需先在汇付开通商户后获取，密钥相关请妥善保管、切勿外泄。',
};

const lakalaTab: PaymentTabDef = {
  key: 'lakala',
  label: '拉卡拉支付',
  title: '拉卡拉支付',
  getApi: '/setting/config/lakalaSettings',
  saveApi: '/setting/config/saveLakala',
  sections: [
    { title: '拉卡拉支付设置', fields: ['useLakala'] },
    {
      title: '基础参数',
      fields: [
        'lakalaAppId',
        'lakalaMerchantNo',
        'lakalaTermNo',
        'lakalaSerialNo',
        'lakalaGatewayUrl',
        'lakalaSandbox',
      ],
    },
    { title: '密钥与证书', fields: ['lakalaMerchantPrivateKey', 'lakalaPlatformCert', 'lakalaSm4Key'] },
    { title: '微信支付参数', fields: ['lakalaWxSubAppid', 'lakalaWxMiniAppid'] },
  ],
  labels: {
    useLakala: '是否开启',
    lakalaAppId: '开放平台 AppId',
    lakalaMerchantNo: '商户号',
    lakalaTermNo: '终端号',
    lakalaSerialNo: '证书序列号',
    lakalaGatewayUrl: '网关地址',
    lakalaSandbox: '环境',
    lakalaMerchantPrivateKey: '商户私钥',
    lakalaPlatformCert: '平台证书',
    lakalaSm4Key: 'SM4 密钥',
    lakalaWxSubAppid: '微信子 AppId',
    lakalaWxMiniAppid: '微信小程序 AppId',
  },
  controls: { useLakala: 'options', lakalaSandbox: 'options' },
  options: {
    useLakala: supportRadio('开启', '关闭'),
    lakalaSandbox: [
      { label: '生产环境', value: 0 },
      { label: '沙箱环境', value: 1 },
    ],
  },
  rules: {
    lakalaAppId: { visibleWhen: { field: 'useLakala', equals: 1 } },
    lakalaMerchantNo: { visibleWhen: { field: 'useLakala', equals: 1 } },
    lakalaTermNo: { visibleWhen: { field: 'useLakala', equals: 1 } },
    lakalaSerialNo: { visibleWhen: { field: 'useLakala', equals: 1 } },
    lakalaGatewayUrl: { visibleWhen: { field: 'useLakala', equals: 1 } },
    lakalaSandbox: { visibleWhen: { field: 'useLakala', equals: 1 } },
    lakalaMerchantPrivateKey: { visibleWhen: { field: 'useLakala', equals: 1 } },
    lakalaPlatformCert: { visibleWhen: { field: 'useLakala', equals: 1 } },
    lakalaSm4Key: { visibleWhen: { field: 'useLakala', equals: 1 } },
    lakalaWxSubAppid: { visibleWhen: { field: 'useLakala', equals: 1 } },
    lakalaWxMiniAppid: { visibleWhen: { field: 'useLakala', equals: 1 } },
  },
  fieldHelp: {
    useLakala: '开启后，用户在支付页可使用「微信」「支付宝」；关闭则不展示这两个选项',
    lakalaAppId: '登录拉卡拉开放平台（open.lakala.com）→应用管理，创建/查看应用后获取；也可由拉卡拉对接人员开通后提供',
    lakalaMerchantNo: '商户进件成功后由拉卡拉分配，在拉卡拉商户平台→商户信息中查看',
    lakalaTermNo: '与商户号一并分配，在拉卡拉商户平台→终端管理中查看',
    lakalaSerialNo: '用拉卡拉提供的密钥/证书生成工具生成商户证书后获得（也可用 OpenSSL 查看 .cer 的 serial）',
    lakalaGatewayUrl: '以拉卡拉对接文档为准；生产环境一般为 https://s2.lakala.com，沙箱地址不同请勿混用',
    lakalaSandbox: '沙箱用于联调，生产用于真实收款；上线前务必切生产，并与上方网关地址一致',
    lakalaMerchantPrivateKey:
      '用拉卡拉密钥生成工具生成（PKCS8 Base64），私钥仅本地保存、勿外泄。如无需更换，保持原样直接提交即可',
    lakalaPlatformCert:
      '在拉卡拉开放平台→应用管理中下载平台公钥证书（.cer），粘贴文件全部内容。如无需更换，保持原样直接提交即可',
    lakalaSm4Key: '开通报文对称加密后由拉卡拉提供；未开通可留空',
    lakalaWxSubAppid:
      '微信公众平台→设置与开发→开发者ID 中的 AppID（公众号内 H5/JSAPI 必填，且需在拉卡拉侧完成绑定）',
    lakalaWxMiniAppid: '微信小程序后台→设置→开发设置中的 AppID（小程序场景必填，且需在拉卡拉侧完成绑定）',
  },
  renderers: {
    lakalaPlatformCert: secretRenderer('lakalaPlatformCert'),
  },
  notice:
    '拉卡拉聚合收单，一次接入即可支持微信、支付宝收款。开启后，支付页面将展示「微信」「支付宝」两个选项。下方参数请在拉卡拉开放平台 / 商户平台获取或按说明自行生成；密钥相关请妥善保管、切勿外泄。',
};

const yeepayTab: PaymentTabDef = {
  key: 'yeepay',
  label: '易宝支付',
  title: '易宝支付',
  getApi: '/setting/config/yeepaySettings',
  saveApi: '/setting/config/saveYeepay',
  sections: [
    {
      title: '易宝支付设置',
      fields: [
        'useYeepay',
        'yeepayAppKey',
        'yeepayParentMerchantNo',
        'yeepayMerchantNo',
        'yeepayIsvPrivateKey',
        'yeepayServerRoot',
      ],
    },
  ],
  labels: {
    useYeepay: '是否开启',
    yeepayAppKey: '应用 AppKey',
    yeepayParentMerchantNo: '发起方商户号',
    yeepayMerchantNo: '收款商户号',
    yeepayIsvPrivateKey: '商户私钥',
    yeepayServerRoot: '接口地址',
  },
  controls: { useYeepay: 'options' },
  options: { useYeepay: supportRadio('开启', '关闭') },
  rules: {
    yeepayAppKey: { visibleWhen: { field: 'useYeepay', equals: 1 } },
    yeepayParentMerchantNo: { visibleWhen: { field: 'useYeepay', equals: 1 } },
    yeepayMerchantNo: { visibleWhen: { field: 'useYeepay', equals: 1 } },
    yeepayIsvPrivateKey: { visibleWhen: { field: 'useYeepay', equals: 1 } },
    yeepayServerRoot: { visibleWhen: { field: 'useYeepay', equals: 1 } },
  },
  fieldHelp: {
    useYeepay: '开启后，用户在支付页可使用「微信支付」「支付宝支付」；关闭则不展示这两个选项',
    yeepayAppKey: '登录易宝商户平台（merchant.yeepay.com）→开发者中心→应用管理中获取，形如 OPR:1000xxxxxxx',
    yeepayParentMerchantNo: '易宝分配的发起方（父）商户编号，在易宝商户平台→账户信息中获取',
    yeepayMerchantNo: '实际收款商户编号；直连商户与发起方一致时可留空，留空则默认取发起方商户号',
    yeepayIsvPrivateKey:
      '用易宝提供的密钥生成工具生成 RSA 密钥对，私钥填此处、公钥上传至易宝商户平台（私钥请妥善保管、不要外泄）。如无需更换，保持原样直接提交即可',
    yeepayServerRoot: '选填，易宝接口地址；留空使用易宝默认生产地址，联调沙箱时按易宝对接文档填写',
  },
  notice:
    '易宝支付（YeePay）聚合收单，一次接入即可同时支持微信、支付宝收款。开启后，支付页面将展示「微信支付」「支付宝支付」两个选项，用户付款体验与原生一致、对易宝渠道无感知。以下参数需先在易宝商户平台开通商户后获取，密钥相关请妥善保管、切勿外泄。',
};

const otherPayTabs = [payPalTab, huifuTab, lakalaTab, yeepayTab];

type Translate = (key: string) => string;

type PaymentOption = { label: string; value: string | number; color?: string };

function translateTab(def: PaymentTabDef, t: Translate): PaymentTabDef {
  return {
    ...def,
    title: t(def.title),
    sections: def.sections.map((section) => ({ ...section, title: t(section.title) })),
    labels: Object.fromEntries(
      Object.entries(def.labels).map(([key, value]): [string, string] => [key, t(value)]),
    ),
    options: def.options
      ? Object.fromEntries(
          Object.entries(def.options).map(
            ([key, list]): [string, PaymentOption[]] => [
              key,
              list.map((item) => ({ ...item, label: t(item.label) })),
            ],
          ),
        )
      : undefined,
    fieldHelp: def.fieldHelp
      ? Object.fromEntries(
          Object.entries(def.fieldHelp).map(([key, value]): [string, string] => [key, t(value)]),
        )
      : undefined,
    notice: def.notice ? t(def.notice) : undefined,
  };
}

function renderTab(def: PaymentTabDef, t: Translate) {
  const localized = translateTab(def, t);
  return (
    <div className="payment-settings-tab">
      {localized.notice && <p className="payment-settings-notice">{localized.notice}</p>}
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
    </div>
  );
}

export default function PaymentSettings() {
  const { t } = useI18n();
  const [activeKey, setActiveKey] = useState('base');
  const [otherKey, setOtherKey] = useState('payPal');

  return (
    <div className="payment-settings">
      <Tabs
        type="line"
        activeKey={activeKey}
        onChange={(next) => setActiveKey(String(next))}
        tabList={[
          { tab: t(baseTab.label), itemKey: 'base' },
          { tab: t(wechatTab.label), itemKey: 'wechat' },
          { tab: t(alipayTab.label), itemKey: 'alipay' },
          { tab: t(offlineTab.label), itemKey: 'offline' },
          { tab: t(applePayTab.label), itemKey: 'applepay' },
          { tab: t('其他支付'), itemKey: 'other' },
        ]}
      />
      {activeKey === 'base' && renderTab(baseTab, t)}
      {activeKey === 'wechat' && renderTab(wechatTab, t)}
      {activeKey === 'alipay' && renderTab(alipayTab, t)}
      {activeKey === 'offline' && renderTab(offlineTab, t)}
      {activeKey === 'applepay' && renderTab(applePayTab, t)}
      {activeKey === 'other' && (
        <div className="payment-settings-other">
          <RadioGroup
            type="button"
            value={otherKey}
            options={otherPayTabs.map((item) => ({ label: t(item.label), value: item.key }))}
            onChange={(event) => setOtherKey(event.target.value)}
          />
          {renderTab(otherPayTabs.find((item) => item.key === otherKey) || payPalTab, t)}
        </div>
      )}
    </div>
  );
}

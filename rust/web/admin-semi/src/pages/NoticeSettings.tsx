import { useRef, useState, type ReactNode } from 'react';
import { Input, Popover, Tabs, Toast } from '@douyinfe/semi-ui';
import AutoConfigPage, { type ConfigRendererContext, type ConfigWhen } from './AutoConfigPage';
import { apiPost } from '../api';
import { useI18n } from '../i18n';

/**
 * 通知设置（baseNoticeManage）。
 * 对齐旧版 setting/config/base/NoticeSettings/Index.vue：四个 Tab，
 * 短信 / 邮件 / 钉钉 / 企业微信各自走独立接口（notifySettings / mailSettings /
 * getDingConfig / getWXWorkConfig），不是单一配置页。
 */

const DING_EXAMPLE_IMG = '/admin-assets/ding.png';
const WXWORK_EXAMPLE_IMG = '/admin-assets/wxwork.png';

/** 旧版 isMaskedOrFilled：密文字段含 * 或非空即视为已填写。 */
function isMaskedOrFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const s = String(v);
  if (s.includes('*')) return true;
  return s.trim().length > 0;
}

function textFilled(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  return String(v).trim().length > 0;
}

function providerEquals(provider: number): ConfigWhen {
  return { field: 'smsProvider', equals: provider };
}

const aliyunFieldsVisible: ConfigWhen = providerEquals(1);
const tencentFieldsVisible: ConfigWhen = providerEquals(2);
const huaweiFieldsVisible: ConfigWhen = providerEquals(3);
const volcengineFieldsVisible: ConfigWhen = providerEquals(4);

function SmsExtraWithExample({ text, img, width }: { text: string; img: string; width: number }) {
  const { t } = useI18n();
  return (
    <div>
      <div style={{ width: 450 }}>
        <span>{t(text)}</span>
        <Popover content={<img src={img} style={{ width }} alt={t('查看示例')} />}>
          <a style={{ marginLeft: 6 }}>{t('查看示例')}</a>
        </Popover>
      </div>
    </div>
  );
}

function dingAppSecretRenderer({ value, update }: ConfigRendererContext): ReactNode {
  return (
    <div>
      <div style={{ width: 450, marginBottom: 4 }}>
        <Input value={String(value ?? '')} onChange={(next) => update('dingAppSecret', next)} />
      </div>
      <SmsExtraWithExample
        text="可在“钉钉开放平台-应用开发-选择应用-机器人”页面获取。"
        img={DING_EXAMPLE_IMG}
        width={900}
      />
    </div>
  );
}

function wxworkWebhookRenderer({ value, update }: ConfigRendererContext): ReactNode {
  return (
    <div>
      <div style={{ width: 450, marginBottom: 4 }}>
        <Input value={String(value ?? '')} onChange={(next) => update('wxworkWebhookUrl', next)} />
      </div>
      <SmsExtraWithExample
        text="可在“企业微信-创建机器人-机器人名片”页面获取。"
        img={WXWORK_EXAMPLE_IMG}
        width={600}
      />
    </div>
  );
}

function SmsSettings() {
  const { t } = useI18n();
  // 记录保存前的服务商，切换后按旧版提示确认模板 ID（旧版 Msg.vue onSubmit）
  const currentProvider = useRef<number>(1);

  return (
    <AutoConfigPage
      title={t('短信通知设置')}
      getApi="/setting/config/notifySettings"
      saveApi="/setting/config/saveNotify"
      sections={[
        {
          title: t('短信设置'),
          fields: [
            'smsProvider',
            'smsKeyId',
            'smsKeySecret',
            'smsSignName',
            'smsShopMobile',
            'smsAliyunChannel',
            'smsSenderId',
            'smsTencentSecretId',
            'smsTencentSecretKey',
            'smsTencentSdkAppId',
            'smsTencentSignName',
            'smsTencentShopMobile',
            'smsHuaweiAppKey',
            'smsHuaweiAppSecret',
            'smsHuaweiChannel',
            'smsHuaweiSignName',
            'smsHuaweiEndpoint',
            'smsHuaweiShopMobile',
            'smsVolcengineAccessKey',
            'smsVolcengineSecretKey',
            'smsVolcengineSmsAccount',
            'smsVolcengineSignName',
            'smsVolcengineShopMobile',
          ],
        },
      ]}
      hiddenFields={[
        // notifySettings 返回但旧版 UI 不渲染（旧版 Msg.vue 仅在 payload 里原样带回）
        'serviceEmail',
        'sendConfirmEmail',
        'orderPayEmail',
        'sendServiceEmail',
        'sendShipEmail',
      ]}
      controls={{
        smsProvider: 'options',
        smsAliyunChannel: 'multi',
      }}
      options={{
        smsProvider: [
          { label: t('阿里云'), value: 1 },
          { label: t('腾讯云'), value: 2 },
          { label: t('华为云'), value: 3 },
          { label: t('火山引擎'), value: 4 },
        ],
        // 跨境版：服务商通道（旧版 smsAliyunChannel 复选框，字符串 "1,2" 存储）
        smsAliyunChannel: [
          { label: t('+86国内通道'), value: '1' },
          { label: t('其他海外通道'), value: '2' },
        ],
      }}
      labels={{
        smsProvider: t('服务商'),
        smsKeyId: t('短信帐户用户名'),
        smsKeySecret: t('短信帐户密码'),
        smsSignName: t('短信签名'),
        smsShopMobile: t('商家短信号码'),
        smsAliyunChannel: t('服务商通道'),
        smsSenderId: t('国际短信SenderID'),
        smsTencentSecretId: t('SecretId'),
        smsTencentSecretKey: t('SecretKey'),
        smsTencentSdkAppId: t('SDK AppID'),
        smsTencentSignName: t('短信签名'),
        smsTencentShopMobile: t('商家短信号码'),
        smsHuaweiAppKey: t('APP Key'),
        smsHuaweiAppSecret: t('APP Secret'),
        smsHuaweiChannel: t('短信通道号'),
        smsHuaweiSignName: t('短信签名'),
        smsHuaweiEndpoint: t('接入地址'),
        smsHuaweiShopMobile: t('商家短信号码'),
        smsVolcengineAccessKey: t('AccessKey ID'),
        smsVolcengineSecretKey: t('SecretAccessKey'),
        smsVolcengineSmsAccount: t('短信应用 ID'),
        smsVolcengineSignName: t('短信签名'),
        smsVolcengineShopMobile: t('商家短信号码'),
      }}
      fieldHelp={{
        smsKeyId: t('您所申请的短信服务用户名，不填则表示不开通'),
        smsKeySecret: t('编辑完成后点击下方提交保存；请确保密码正确'),
        smsSignName: t('阿里短信此处填短信签名'),
        smsShopMobile: t('用于接收会员订单等信息'),
        smsAliyunChannel: t(
          '若全部勾选，发送短信时，系统自动识别手机号的国家码前缀：中国大陆号码自动走国内短信通道，海外号码自动走国际短信通道。',
        ),
        smsSenderId: t('阿里云国际短信发送方标识（From），部分国家/地区需在控制台报备；仅海外通道使用。'),
        smsTencentSecretId: t('腾讯云账户的 API 密钥ID，用于标识 API 调用者的身份。'),
        smsTencentSecretKey: t('腾讯云账户的API密钥，用于加密签名字符串和服务器端验证签名字符串的密钥。'),
        smsTencentSdkAppId: t('腾讯云短信应用的ID，在短信服务的应用管理中获取。'),
        smsTencentSignName: t('短信发送时的签名，需在腾讯云短信控制台创建并通过审核。'),
        smsTencentShopMobile: t('用于商家接收会员订单等信息'),
        smsHuaweiAppKey: t('华为云短信应用的 APP Key，用于接口鉴权，请在短信应用管理中获取。'),
        smsHuaweiAppSecret: t('华为云短信应用的 APP Secret，用于接口鉴权，请妥善保管。'),
        smsHuaweiChannel: t('华为云短信通道号，请在短信控制台对应应用配置中获取。'),
        smsHuaweiSignName: t('短信发送时的签名，需在华为云短信控制台申请并审核通过。'),
        smsHuaweiEndpoint: t('示例：https://smsapi.cn-north-4.myhuaweicloud.com:443'),
        smsHuaweiShopMobile: t('用于商家接收会员订单等信息'),
        smsVolcengineAccessKey: t('火山引擎账户的 AccessKey ID，用于标识 API 调用者身份。'),
        smsVolcengineSecretKey: t('火山引擎账户的 SecretAccessKey，用于接口签名鉴权，请妥善保管。'),
        smsVolcengineSmsAccount: t('火山引擎短信应用 ID，请在短信服务控制台的应用管理中获取。'),
        smsVolcengineSignName: t('短信发送时的签名，需在火山引擎短信控制台创建并审核通过。'),
        smsVolcengineShopMobile: t('用于商家接收会员订单等信息'),
      }}
      rules={{
        smsKeyId: { visibleWhen: aliyunFieldsVisible },
        smsKeySecret: { visibleWhen: aliyunFieldsVisible },
        smsSignName: { visibleWhen: aliyunFieldsVisible },
        smsShopMobile: { visibleWhen: aliyunFieldsVisible },
        smsAliyunChannel: { visibleWhen: aliyunFieldsVisible },
        smsSenderId: {
          visibleWhen: { all: [aliyunFieldsVisible, { field: 'smsAliyunChannel', includes: '2' }] },
        },
        smsTencentSecretId: { visibleWhen: tencentFieldsVisible },
        smsTencentSecretKey: { visibleWhen: tencentFieldsVisible },
        smsTencentSdkAppId: { visibleWhen: tencentFieldsVisible },
        smsTencentSignName: { visibleWhen: tencentFieldsVisible },
        smsTencentShopMobile: { visibleWhen: tencentFieldsVisible },
        smsHuaweiAppKey: { visibleWhen: huaweiFieldsVisible },
        smsHuaweiAppSecret: { visibleWhen: huaweiFieldsVisible },
        smsHuaweiChannel: { visibleWhen: huaweiFieldsVisible },
        smsHuaweiSignName: { visibleWhen: huaweiFieldsVisible },
        smsHuaweiEndpoint: { visibleWhen: huaweiFieldsVisible },
        smsHuaweiShopMobile: { visibleWhen: huaweiFieldsVisible },
        smsVolcengineAccessKey: { visibleWhen: volcengineFieldsVisible },
        smsVolcengineSecretKey: { visibleWhen: volcengineFieldsVisible },
        smsVolcengineSmsAccount: { visibleWhen: volcengineFieldsVisible },
        smsVolcengineSignName: { visibleWhen: volcengineFieldsVisible },
        smsVolcengineShopMobile: { visibleWhen: volcengineFieldsVisible },
      }}
      defaults={{ smsProvider: 1, smsAliyunChannel: '1' }}
      // 旧版 validateCurrent：按当前服务商校验必填（密文字段含 * 视为已填）
      validate={(values) => {
        const provider = Number(values.smsProvider ?? 1);
        if (provider === 1) {
          if (!isMaskedOrFilled(values.smsKeyId)) return t('请填写短信帐户用户名');
          if (!isMaskedOrFilled(values.smsKeySecret)) return t('请填写短信帐户密码');
          if (!textFilled(values.smsSignName)) return t('请填写短信签名');
          const channels = String(values.smsAliyunChannel ?? '')
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
          if (channels.length === 0) return t('请至少选择一个服务商通道');
          if (channels.includes('2') && !textFilled(values.smsSenderId)) {
            return t('勾选其他海外通道时，请填写国际短信SenderID');
          }
        } else if (provider === 2) {
          if (!isMaskedOrFilled(values.smsTencentSecretId)) return t('请填写 SecretId');
          if (!isMaskedOrFilled(values.smsTencentSecretKey)) return t('请填写 SecretKey');
          if (!textFilled(values.smsTencentSdkAppId)) return t('请填写 SDK AppID');
          if (!textFilled(values.smsTencentSignName)) return t('请填写短信签名');
        } else if (provider === 3) {
          if (!isMaskedOrFilled(values.smsHuaweiAppKey)) return t('请填写 APP Key');
          if (!isMaskedOrFilled(values.smsHuaweiAppSecret)) return t('请填写 APP Secret');
          if (!textFilled(values.smsHuaweiChannel)) return t('请填写短信通道号');
          if (!textFilled(values.smsHuaweiSignName)) return t('请填写短信签名');
          if (!textFilled(values.smsHuaweiEndpoint)) return t('请填写接入地址');
        } else if (provider === 4) {
          if (!isMaskedOrFilled(values.smsVolcengineAccessKey)) return t('请填写 AccessKey ID');
          if (!isMaskedOrFilled(values.smsVolcengineSecretKey)) return t('请填写 SecretAccessKey');
          if (!textFilled(values.smsVolcengineSmsAccount)) return t('请填写短信应用 ID');
          if (!textFilled(values.smsVolcengineSignName)) return t('请填写短信签名');
        }
        return null;
      }}
      onSaved={(payload) => {
        const provider = Number(payload.smsProvider ?? 1);
        if (currentProvider.current !== provider) {
          Toast.warning({
            content: t('服务商已切换，请确认各消息类型的短信模板 ID 已更新为对应平台的模板'),
          });
          currentProvider.current = provider;
        }
      }}
    />
  );
}

function EmailSettings() {
  const { t } = useI18n();
  return (
    <div>
      <div className="payment-settings-notice">
        <p>
          {t(
            '提示：推荐使用QQ的域名邮箱（免费），设置流程请看本系统教程，另外请确保服务器防火墙未拦截邮箱发送，且对应的端口开放。',
          )}
        </p>
      </div>
      <AutoConfigPage
        title={t('邮件通知设置')}
        getApi="/setting/config/mailSettings"
        saveApi="/setting/config/saveMail"
        sections={[
          {
            title: t('邮件通知设置'),
            fields: [
              'mailService',
              'smtpSsl',
              'smtpHost',
              'smtpPort',
              'smtpUser',
              'smtpPass',
              'smtpMail',
              'mailCharset',
              'testMailAddress',
            ],
          },
        ]}
        hiddenFields={['serviceEMail']}
        controls={{
          mailService: 'options',
          smtpSsl: 'options',
          mailCharset: 'options',
        }}
        options={{
          mailService: [
            { label: t('本地邮件服务器'), value: 0 },
            { label: t('SMTP服务'), value: 1 },
          ],
          smtpSsl: [
            { label: t('是'), value: 1 },
            { label: t('否'), value: 0 },
          ],
          mailCharset: [
            { label: t('国际编码(UTF8)'), value: 'UTF8' },
            { label: t('简体中文(GB2312)'), value: 'GB2312' },
            { label: t('繁体中文(BIG5)'), value: 'BIG5' },
          ],
        }}
        fieldHelp={{
          mailService: t('如果您选择了采用服务器内置的 Mail 服务，您不需要填写下面的内容。'),
          smtpSsl: t('SMTP一般要求加密'),
          smtpHost: t('邮件服务器主机地址。如果本机可以发送邮件则设置为localhost'),
          smtpUser: t('发送邮件所需的认证帐号，如果没有就为空着'),
        }}
        actions={[
          {
            label: t('发送测试邮件'),
            section: t('邮件通知设置'),
            prompt: {
              label: t('发送测试邮件'),
              placeholder: t('请输入接收测试邮件的邮箱地址'),
            },
            success: t('测试邮件已发送'),
            run: async ({ apiPost: post, input, values }) => {
              const address = input || String(values.testMailAddress || '').trim();
              if (!address) throw new Error(t('请输入接收测试邮件的邮箱地址'));
              await post(`/setting/config/sendTestEmail?testMailAddress=${encodeURIComponent(address)}`);
            },
          },
        ]}
      />
    </div>
  );
}

function DingSettings() {
  const { t } = useI18n();
  return (
    <AutoConfigPage
      title={t('钉钉通知设置')}
      getApi="/setting/config/getDingConfig"
      saveApi="/setting/config/saveDingConfig"
      sections={[{ title: t('钉钉通知设置'), fields: ['dingTalkRobotToken', 'dingAppSecret'] }]}
      labels={{ dingTalkRobotToken: t('钉钉群机器人token'), dingAppSecret: t('钉钉appsecret') }}
      renderers={{ dingAppSecret: dingAppSecretRenderer }}
    />
  );
}

function WxWorkSettings() {
  const { t } = useI18n();
  return (
    <AutoConfigPage
      title={t('企业微信通知设置')}
      getApi="/setting/config/getWXWorkConfig"
      saveApi="/setting/config/saveWXWorkConfig"
      sections={[{ title: t('企业微信通知设置'), fields: ['wxworkWebhookUrl'] }]}
      labels={{ wxworkWebhookUrl: t('企业微信群消息机器人') }}
      renderers={{ wxworkWebhookUrl: wxworkWebhookRenderer }}
    />
  );
}

export default function NoticeSettings() {
  const { t } = useI18n();
  const [activeKey, setActiveKey] = useState('msg');

  return (
    <div className="notice-settings">
      <Tabs
        type="line"
        activeKey={activeKey}
        onChange={(next) => setActiveKey(String(next))}
        tabList={[
          { tab: t('短信通知设置'), itemKey: 'msg' },
          { tab: t('邮件通知设置'), itemKey: 'email' },
          { tab: t('钉钉通知设置'), itemKey: 'ding' },
          { tab: t('企业微信通知设置'), itemKey: 'wxwork' },
        ]}
      />
      {activeKey === 'msg' && <SmsSettings />}
      {activeKey === 'email' && <EmailSettings />}
      {activeKey === 'ding' && <DingSettings />}
      {activeKey === 'wxwork' && <WxWorkSettings />}
    </div>
  );
}

import { useCallback, useEffect, useState } from 'react';
import { Button, Input, Modal, Radio, RadioGroup, Spin, TextArea, Toast } from '@douyinfe/semi-ui';
import { useI18n } from '../i18n';
import { apiGet, apiPost } from '../api';

/**
 * 客服设置（对齐旧版 view/admin ServiceSettings.vue）：
 * - 客服选择为按钮式单选组，按所选类型条件渲染对应配置项
 * - sign/企微 ID 等敏感值以截断文本 + 编辑弹窗呈现（旧版 DialogForm EditSecret）
 * - WhatsApp 号码按旧版规则校验（带国家码纯数字 7-15 位）
 * - 底部固定操作条提交
 */

interface KefuForm {
  kefuType?: number;
  kefuYzfType?: number;
  kefuYzfSign?: string;
  kefuWorkwxId?: string;
  kefuCode?: string;
  kefuCodeBlank?: number;
  corpId?: string;
  kefuWhatsappPhone?: string;
  kefuPhone?: string;
  kefuTime?: string;
}

const KEFU_TYPE_OPTIONS = [
  { value: 0, label: '无客服', desc: '关闭商城在线客服功能' },
  { value: 1, label: '腾讯云客服', desc: '接入腾讯云音视频客服' },
  { value: 2, label: '企业微信客服', desc: '通过企业微信联系客服' },
  { value: 3, label: '自定义客服', desc: '跳转自定义客服链接' },
  { value: 4, label: 'TigChat客服', desc: '平台内置在线会话' },
  { value: 5, label: 'WhatsApp客服', desc: '面向海外用户的即时沟通' },
];

const OPEN_MODE_OPTIONS = [
  { value: 0, label: '打开链接地址' },
  { value: 1, label: '小弹窗打开' },
];

/** 敏感值字段：截断展示 + 编辑弹窗（旧版 DialogForm + EditSecret）。 */
function SecretField({
  title,
  value,
  onOk,
}: {
  title: string;
  value: string;
  onOk: (next: string) => void;
}) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);
  const [draft, setDraft] = useState(value);
  return (
    <div className="kefu-setting-secret">
      <span className="kefu-setting-secret-value" title={value}>
        {value || '--'}
      </span>
      <Button
        theme="borderless"
        type="primary"
        size="small"
        onClick={() => {
          setDraft(value);
          setVisible(true);
        }}
      >
        {t('编辑')}
      </Button>
      <Modal
        title={t(title)}
        visible={visible}
        onCancel={() => setVisible(false)}
        onOk={() => {
          onOk(draft);
          setVisible(false);
        }}
        width={600}
      >
        <TextArea value={draft} onChange={(next) => setDraft(next)} autosize={{ minRows: 3, maxRows: 8 }} />
      </Modal>
    </div>
  );
}

export default function KefuSettings() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<KefuForm>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiGet<KefuForm>('/setting/config/kefuSettings');
      setForm({ ...result });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = (key: keyof KefuForm, next: unknown) =>
    setForm((current) => ({ ...current, [key]: next }));

  const kefuType = Number(form.kefuType ?? 0);

  const submit = async () => {
    if (kefuType === 5) {
      const phone = String(form.kefuWhatsappPhone || '').trim();
      if (!phone) {
        Toast.error({ content: t('请填写WhatsApp号码') });
        return;
      }
      if (!/^\d{7,15}$/.test(phone)) {
        Toast.error({ content: t('请填写带国家码的纯数字，不含 + / 空格 / 横线') });
        return;
      }
    }
    setSaving(true);
    try {
      await apiPost('/setting/config/saveKefu', form);
      Toast.success({ content: t('修改成功') });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('保存失败') });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Spin spinning={loading}>
      <div className="kefu-setting-page">
        <form
          className="kefu-setting-form"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <div className="kefu-setting-card">
            <div className="kefu-setting-card-head">
              <div className="kefu-setting-card-title">{t('客服设置')}</div>
              <p className="kefu-setting-card-desc">{t('选择客服接入方式，并配置对应参数')}</p>
            </div>
            <div className="kefu-setting-field">
              <label>{t('客服选择')}</label>
              <div className="kefu-setting-control">
                <div className="kefu-type-grid" role="radiogroup" aria-label={t('客服选择')}>
                  {KEFU_TYPE_OPTIONS.map((option) => {
                    const selected = kefuType === option.value;
                    return (
                      <button
                        type="button"
                        key={option.value}
                        role="radio"
                        aria-checked={selected}
                        className={`kefu-type-card${selected ? ' is-selected' : ''}`}
                        onClick={() => update('kefuType', option.value)}
                      >
                        <span className="kefu-type-card-name">{t(option.label)}</span>
                        <span className="kefu-type-card-desc">{t(option.desc)}</span>
                        {selected && (
                          <span className="kefu-type-card-check" aria-hidden="true">
                            <svg viewBox="0 0 12 12" width="10" height="10">
                              <path
                                d="M1.5 6.2 4.6 9.3 10.5 2.8"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {(kefuType === 1 || kefuType === 2 || kefuType === 3) && (
                  <div className="kefu-setting-extra-group" key={`hint-${kefuType}`}>
                    {kefuType === 1 && (
                      <>
                        <p className="kefu-setting-extra">{t('腾讯云设置地址：https://yzf.qq.com/xv/html/admin/chat/channel/web')}</p>
                        <p className="kefu-setting-extra">{t('设置流程：1、注册账号；2、会话->渠道设置->网站渠道，点击新增网站；3、在编辑里获取sign的值')}</p>
                      </>
                    )}
                    {kefuType === 2 && (
                      <>
                        <p className="kefu-setting-extra">{t('提示：PC端打开企业微信客服会唤起PC端微信，如果未安装PC端微信也可查看二维码后扫码使用;')}</p>
                        <p className="kefu-setting-extra">{t('企业微信客服设置地址：https://work.weixin.qq.com/wework_admin/frame#/apps')}</p>
                        <p className="kefu-setting-extra">{t('设置流程：1、注册账号；2、应用管理->应用->微信客服->客服帐号->创建账号；3、客服账号获取帐号ID')}</p>
                      </>
                    )}
                    {kefuType === 3 && (
                      <p className="kefu-setting-extra">{t('提示：来回切换设置会丢失自定义客服的设置项，如需恢复请勿提交保存，刷新页面即可')}</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="kefu-setting-type-panel" key={`panel-${kefuType}`}>
              {kefuType === 1 && (
              <>
                <div className="kefu-setting-field">
                  <label>{t('腾讯云客服打开方式')}</label>
                  <div className="kefu-setting-control">
                    <RadioGroup
                      value={Number(form.kefuYzfType ?? 0)}
                      onChange={(event) => update('kefuYzfType', Number(event.target.value))}
                    >
                      {OPEN_MODE_OPTIONS.map((option) => (
                        <Radio key={option.value} value={option.value}>
                          {t(option.label)}
                        </Radio>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
                <div className="kefu-setting-field">
                  <label>{t('腾讯云客服sign')}</label>
                  <div className="kefu-setting-control">
                    <SecretField
                      title="腾讯云客服sign"
                      value={String(form.kefuYzfSign ?? '')}
                      onOk={(next) => update('kefuYzfSign', next)}
                    />
                    <p className="kefu-setting-extra">{t('提示：sign为空时客服设置不生效！')}</p>
                  </div>
                </div>
              </>
            )}

            {kefuType === 2 && (
              <>
                <div className="kefu-setting-field">
                  <label>{t('企业微信客服ID')}</label>
                  <div className="kefu-setting-control">
                    <SecretField
                      title="企业微信客服ID"
                      value={String(form.kefuWorkwxId ?? '')}
                      onOk={(next) => update('kefuWorkwxId', next)}
                    />
                    <p className="kefu-setting-extra">{t('提示：ID为空时客服设置不生效！')}</p>
                  </div>
                </div>
                <div className="kefu-setting-field">
                  <label>{t('企业微信企业ID')}</label>
                  <div className="kefu-setting-control">
                    <SecretField
                      title="企业微信企业ID"
                      value={String(form.corpId ?? '')}
                      onOk={(next) => update('corpId', next)}
                    />
                    <p className="kefu-setting-extra">{t('提示：小程序打开微信客服需要设置企业ID！')}</p>
                  </div>
                </div>
              </>
            )}

            {kefuType === 3 && (
              <>
                <div className="kefu-setting-field">
                  <label>{t('客服链接')}</label>
                  <div className="kefu-setting-control">
                    <Input
                      style={{ width: 420 }}
                      value={String(form.kefuCode ?? '')}
                      onChange={(next) => update('kefuCode', next)}
                    />
                    <p className="kefu-setting-extra">{t('如果是脚本控制的链接，请在此处填入： 请填写http开头的客服链接;')}</p>
                  </div>
                </div>
                <div className="kefu-setting-field">
                  <label>{t('客服链接打开方式')}</label>
                  <div className="kefu-setting-control">
                    <RadioGroup
                      value={Number(form.kefuCodeBlank ?? 0)}
                      onChange={(event) => update('kefuCodeBlank', Number(event.target.value))}
                    >
                      {OPEN_MODE_OPTIONS.map((option) => (
                        <Radio key={option.value} value={option.value}>
                          {t(option.label)}
                        </Radio>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </>
            )}

            {kefuType === 5 && (
              <div className="kefu-setting-field">
                <label>{t('WhatsApp号码')}</label>
                <div className="kefu-setting-control">
                  <Input
                    style={{ width: 420 }}
                    value={String(form.kefuWhatsappPhone ?? '')}
                    placeholder={t('例：8613800138000')}
                    onChange={(next) => update('kefuWhatsappPhone', next)}
                  />
                  <p className="kefu-setting-extra">{t('请填带国家码的纯数字，不含 + / 空格 / 横线，例：8613800138000')}</p>
                </div>
              </div>
            )}
            </div>
          </div>

          <div className="kefu-setting-card">
            <div className="kefu-setting-card-head">
              <div className="kefu-setting-card-title">{t('客服信息')}</div>
              <p className="kefu-setting-card-desc">{t('商城前台展示的客服联系方式')}</p>
            </div>
            <div className="kefu-setting-field">
              <label>{t('客服热线电话')}</label>
              <div className="kefu-setting-control">
                <Input
                  style={{ width: 420 }}
                  value={String(form.kefuPhone ?? '')}
                  onChange={(next) => update('kefuPhone', next)}
                />
                <p className="kefu-setting-extra">{t('不填则不显示')}</p>
              </div>
            </div>
            <div className="kefu-setting-field">
              <label>{t('服务时间')}</label>
              <div className="kefu-setting-control">
                <Input
                  style={{ width: 420 }}
                  value={String(form.kefuTime ?? '')}
                  onChange={(next) => update('kefuTime', next)}
                />
              </div>
            </div>
          </div>

          <div className="kefu-setting-actions">
            <Button size="large" theme="solid" type="primary" loading={saving} htmlType="submit">
              {t('提 交')}
            </Button>
          </div>
        </form>
      </div>
    </Spin>
  );
}

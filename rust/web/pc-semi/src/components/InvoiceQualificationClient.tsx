'use client';

/**
 * 增票资质（对照旧版 `pc/pages/member/userinvoice/Info.vue`）。
 *
 * 旧版能力：顶部页签（发票申请 / 增票资质）+ 温馨提示 + 资质状态 + 只读资质信息 + 编辑表单。
 * 状态语义（UserInvoiceVO.status）：0 未申请专用发票 / 1 审核通过 / 2 已申请，待审核 / 3 审核未通过。
 *
 * 接口：
 * - `GET  user/invoice/detail` 增票资质详情
 * - `POST user/invoice/create` 首次申请（status 0）
 * - `POST user/invoice/update` 修改并重新审核（status ≠ 0）
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Checkbox, Input, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface InvoiceForm {
  invoiceId?: number;
  status?: number;
  applyReply?: string;
  invoiceContent?: string;
  companyName?: string;
  companyCode?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyBank?: string;
  companyAccount?: string;
}

/** 状态 → 文案 / 色调 / 说明（色调对应 SCSS 的 `is-*` 修饰类） */
const STATUS_META: Record<number, { text: string; tone: string; desc: string }> = {
  0: { text: '未申请专用发票', tone: 'idle', desc: '您尚未提交增值税专用发票资质，填写并提交后我们会在一个工作日内完成审核。' },
  1: { text: '审核通过', tone: 'ok', desc: '您的增票资质已通过审核，下单结算时可直接申请开具增值税专用发票。' },
  2: { text: '已申请，待审核', tone: 'wait', desc: '资质已提交，我们会在一个工作日内完成审核，期间暂不可修改。' },
  3: { text: '审核未通过', tone: 'bad', desc: '很抱歉，本次资质未通过审核，请根据驳回原因修改后重新提交。' },
};

/** 表单字段（顺序即渲染顺序；wide 占满两列） */
const FIELDS: Array<{
  key: keyof InvoiceForm;
  label: string;
  placeholder: string;
  /** 旧版 rules：六项均必填 */
  required: boolean;
  /** 旧版 createNoChineseValidator：税号 / 电话 / 账号不允许中文 */
  noChinese?: boolean;
  wide?: boolean;
}> = [
  { key: 'companyName', label: '单位名称', placeholder: '请输入单位名称', required: true, wide: true },
  { key: 'companyCode', label: '纳税人识别码', placeholder: '请输入纳税人识别码', required: true, noChinese: true },
  { key: 'companyPhone', label: '注册电话', placeholder: '请输入注册电话', required: true, noChinese: true },
  { key: 'companyAddress', label: '注册地址', placeholder: '请输入注册地址', required: true, wide: true },
  { key: 'companyBank', label: '开户银行', placeholder: '请输入开户银行', required: true },
  { key: 'companyAccount', label: '银行账户', placeholder: '请输入银行账户', required: true, noChinese: true },
];

/** 只读展示字段（顺序照抄旧版 el-form-item 顺序） */
const READONLY_FIELDS: Array<{ key: keyof InvoiceForm; label: string; wide?: boolean; mono?: boolean }> = [
  { key: 'companyName', label: '单位名称', wide: true },
  { key: 'companyCode', label: '纳税人识别码', mono: true },
  { key: 'companyPhone', label: '注册电话', mono: true },
  { key: 'companyAddress', label: '注册地址', wide: true },
  { key: 'companyBank', label: '开户银行' },
  { key: 'companyAccount', label: '银行账户', mono: true },
];

export default function InvoiceQualificationClient() {
    const { t } = useTranslation();
  const [form, setForm] = useState<InvoiceForm>({});
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<InvoiceForm>('user/invoice/detail')
      .then((result) => {
        const data = result || {};
        setForm(data);
        // 无资质记录或审核未通过（3）时直接进入编辑态
        setEditing(!data.companyName || Number(data.status) === 3);
      })
      .catch(() => setEditing(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const update = (key: keyof InvoiceForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  /** 旧版 showEditFun：切换编辑态前重新拉取，并重置勾选 */
  const toggleEdit = (next: boolean) => {
    setAgreed(false);
    setEditing(next);
  };

  const submit = async () => {
    for (const field of FIELDS) {
      const value = String(form[field.key] ?? '').trim();
      if (field.required && !value) return Toast.error({ content: `${field.label}不能为空` });
      if (field.noChinese && /[\u4e00-\u9fa5]/.test(value)) return Toast.error({ content: `${field.label}格式不正确` });
    }
    if (!agreed) return Toast.error({ content: '需要勾选确认才能继续' });

    setSaving(true);
    try {
      const status = Number(form.status || 0);
      // 旧版提交前 delete formState.status，isAdd 仅首次申请为 1
      const rest: InvoiceForm = { ...form };
      delete rest.status;
      const payload = { ...rest, titleType: 2, invoiceType: 1, isAdd: status === 0 ? 1 : 0, isConfirm: 1 };
      if (status === 0 || !form.invoiceId) {
        await apiPost('user/invoice/create', payload);
      } else {
        await apiPost('user/invoice/update', { invoiceId: form.invoiceId, ...payload });
      }
      Toast.success({ content: '操作成功' });
      setAgreed(false);
      setEditing(false);
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSaving(false);
    }
  };

  const status = Number(form.status || 0);
  const meta = STATUS_META[status] || STATUS_META[0];
  const hasRecord = Boolean(form.companyName);
  const readonly = !editing && hasRecord;

  return (
    <Card className="member-card invq">
      {/* 旧版 MemberTopMenu：发票申请 / 增票资质 —— 收进卡片顶栏，与下方内容同属一块 */}
      <div className="invq-head">
        <nav className="invq-tabs">
          <Link href="/member/orderinvoice/list" className="invq-tabs__item">{t('发票申请')}</Link>
          <Link href="/member/userinvoice/info" className="invq-tabs__item is-active">{t('增票资质')}</Link>
        </nav>
      </div>

      {loading ? (
        <div className="invq-skeleton">
          <span className="invq-skeleton__bar invq-skeleton__bar--title" />
          <span className="invq-skeleton__bar" />
          <span className="invq-skeleton__bar invq-skeleton__bar--short" />
        </div>
      ) : (
        <>
          {/* 顶部：标题 + 状态徽标 + 主操作 */}
          <header className="invq-hero">
            <div className="invq-hero__main">
              <span className="invq-hero__eyebrow">{t('增值税专用发票')}</span>
              <h2 className="invq-hero__title">{t('您的增票资质')}</h2>
              <div className={`invq-badge is-${meta.tone}`}>
                <i className="invq-badge__dot" />
                {meta.text}
              </div>
              <p className="invq-hero__desc">{meta.desc}</p>
            </div>
            <div className="invq-hero__actions">
              {readonly ? (
                <Button theme="solid" type="primary" onClick={() => toggleEdit(true)}>
                  {status === 0 ? t('添加增票资质') : '修改并重新审核'}
                </Button>
              ) : null}
            </div>
          </header>

          {/* 温馨提示（旧版 .tips 的 3 条 + 1 条总则） */}
          <section className="invq-notice">
            <span className="invq-notice__badge">!</span>
            <div className="invq-notice__body">
              <b>{t('温馨提示')}</b>
              <ul>
                <li>{t('我们会在一个工作日内完成审核工作。')}</li>
                <li>{t('资质审核结果查询时间：')}<em>{t('资质上传一到两个工作日后即可查询')}</em>。
                </li>
                <li>{t('注意：有效增值税专用发票开票资质仅为一个。')}</li>
              </ul>
            </div>
          </section>

          {/* 审核未通过原因（旧版 status === 3） */}
          {status === 3 && form.applyReply ? (
            <div className="invq-alert">
              <span className="invq-alert__label">{t('审核失败原因')}</span>
              <p className="invq-alert__text">{form.applyReply}</p>
            </div>
          ) : null}

          {/* 只读态：资质信息 */}
          {readonly ? (
            <section className="invq-panel">
              <div className="invq-panel__head">
                <h3>{t('资质信息')}</h3>
                <span>{t('以下为已提交的增票资质内容')}</span>
              </div>
              <dl className="invq-grid">
                {READONLY_FIELDS.map((field) => (
                  <div
                    key={field.key}
                    className={`invq-grid__item${field.wide ? ' is-wide' : ''}`}
                  >
                    <dt>{field.label}</dt>
                    <dd className={field.mono ? 'is-mono' : undefined}>
                      {String(form[field.key] ?? '') || '-'}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ) : (
            /* 编辑态：填写资质信息 */
            <section className="invq-panel">
              <div className="invq-panel__head">
                <h3>{t('填写增票资质信息')}</h3>
                <span>{t('所有信息均为')}<em>{t('必填')}</em>
                </span>
              </div>
              <div className="invq-form">
                {FIELDS.map((field) => (
                  <label
                    key={field.key}
                    className={`invq-field${field.wide ? ' is-wide' : ''}`}
                  >
                    <span className="invq-field__label">
                      {field.label}
                      {field.required ? <i>*</i> : null}
                    </span>
                    <Input
                      size="large"
                      value={String(form[field.key] ?? '')}
                      placeholder={field.placeholder}
                      onChange={(value) => update(field.key, value)}
                    />
                  </label>
                ))}
              </div>
              <div className="invq-agree">
                <Checkbox checked={agreed} onChange={(event) => setAgreed(Boolean(event.target.checked))}>{t('我已阅读并同意')}</Checkbox>
                <Link href="/member/userinvoice/confirminfo" target="_blank" className="invq-agree__link">{t('《增票资质确认书》')}</Link>
              </div>
              <div className="invq-actions">
                <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>{t('确认')}</Button>
                <Button onClick={() => toggleEdit(false)}>{t('取消')}</Button>
              </div>
            </section>
          )}
        </>
      )}
    </Card>
  );
}

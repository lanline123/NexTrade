'use client';

/**
 * 增票资质（对照旧版 `pc/pages/member/userInvoice/Info.vue`）—— Semi Design 现代化版
 *
 * 功能 1:1 保留：
 * - 顶部页签（发票申请 / 增票资质，路由切换）
 * - 状态语义（UserInvoiceVO.status）：0 未申请 / 1 审核通过 / 2 待审核 / 3 审核未通过
 * - 无资质或审核未通过时直接进入编辑态；只读态展示已过审资质
 * - 六项必填 + 税号/电话/账号禁止中文校验；提交前须勾选《增票资质确认书》
 * - 首次申请走 create（isAdd=1），已有记录走 update
 *
 * 现代化（2026-11）：状态卡（浅色语义底 + Tag 在上说明在下）+ Semi Tag/Banner/
 * Descriptions/Input/Checkbox/Skeleton；旧 el-form 手搓结构移除（member-pages.scss
 * 的 .mp-userinvoice-info 块保留未删，用于回滚）。
 *
 * ⚠️ 保护标记（见 docs/pc-parity-notes.md「现代化保护区」）：本组件是用户指定的
 * Semi 现代化最终形态，请勿在后续轮次中回退为 el-form 旧版复刻结构。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Banner, Button, Checkbox, Descriptions, Input, Skeleton, Tag, Toast } from '@douyinfe/semi-ui';
import { IconInfoCircle } from '@douyinfe/semi-icons';
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

/** 状态 → 文案 / Tag 色 / 说明（tag 取值限定 Semi TagColor） */
const STATUS_META: Record<number, { text: string; tag: 'grey' | 'green' | 'orange' | 'red'; desc: string }> = {
  0: { text: '未申请专用发票', tag: 'grey', desc: '您尚未提交增值税专用发票资质，填写并提交后我们会在一个工作日内完成审核。' },
  1: { text: '审核通过', tag: 'green', desc: '您的增票资质已通过审核，下单结算时可直接申请开具增值税专用发票。' },
  2: { text: '已申请，待审核', tag: 'orange', desc: '资质已提交，我们会在一个工作日内完成审核，期间暂不可修改。' },
  3: { text: '审核未通过', tag: 'red', desc: '很抱歉，本次资质未通过审核，请根据驳回原因修改后重新提交。' },
};

/** 表单字段（wide 占满整行；noChinese 对应旧版 createNoChineseValidator） */
const FIELDS: Array<{
  key: keyof InvoiceForm;
  wide?: boolean;
  noChinese?: boolean;
}> = [
  { key: 'companyName', wide: true },
  { key: 'companyCode', noChinese: true },
  { key: 'companyPhone', noChinese: true },
  { key: 'companyAddress', wide: true },
  { key: 'companyBank' },
  { key: 'companyAccount', noChinese: true },
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
    if (next === false) load();
  };

  const submit = async () => {
    const labels: Record<string, string> = {
      companyName: t('单位名称'),
      companyCode: t('纳税人识别码'),
      companyAddress: t('注册地址'),
      companyPhone: t('注册电话'),
      companyBank: t('开户银行'),
      companyAccount: t('银行账户'),
    };
    for (const field of FIELDS) {
      const value = String(form[field.key] ?? '').trim();
      if (!value) return Toast.error({ content: `${labels[field.key]}${t('不能为空')}` });
      if (field.noChinese && /[\u4e00-\u9fa5]/.test(value)) return Toast.error({ content: `${labels[field.key]}${t('格式不正确')}` });
    }
    if (!agreed) return Toast.error({ content: t('需要勾选确认才能继续') });

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
      Toast.success({ content: t('操作成功') });
      setAgreed(false);
      setEditing(false);
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('提交失败') });
    } finally {
      setSaving(false);
    }
  };

  const status = Number(form.status || 0);
  const hasRecord = Boolean(form.companyName);
  const meta = STATUS_META[status] || STATUS_META[0];

  const readonlyData = [
    { key: t('单位名称'), value: String(form.companyName ?? '') },
    { key: t('纳税人识别码'), value: String(form.companyCode ?? '') },
    { key: t('注册地址'), value: String(form.companyAddress ?? '') },
    { key: t('注册电话'), value: String(form.companyPhone ?? '') },
    { key: t('开户银行'), value: String(form.companyBank ?? '') },
    { key: t('银行账户'), value: String(form.companyAccount ?? '') },
  ];

  const editFields: Array<{ key: keyof InvoiceForm; label: string; placeholder: string; wide?: boolean; noChinese?: boolean }> = [
    { key: 'companyName', label: t('单位名称'), placeholder: t('请输入单位名称'), wide: true },
    { key: 'companyCode', label: t('纳税人识别码'), placeholder: t('请输入纳税人识别码'), noChinese: true },
    { key: 'companyPhone', label: t('注册电话'), placeholder: t('请输入注册电话'), noChinese: true },
    { key: 'companyAddress', label: t('注册地址'), placeholder: t('请输入注册地址'), wide: true },
    { key: 'companyBank', label: t('开户银行'), placeholder: t('请输入开户银行') },
    { key: 'companyAccount', label: t('银行账户'), placeholder: t('请输入银行账户'), noChinese: true },
  ];

  return (
    <div className="miq">
      {/* 顶部页签（发票申请 / 增票资质）—— 路由切换 */}
      <div className="miq-tabs">
        <Link className="miq-tab" href="/member/orderinvoice/list">{t('发票申请')}</Link>
        <span className="miq-tab miq-tab--active">{t('增票资质')}</span>
      </div>

      {loading ? (
        <div className="miq-card">
          <Skeleton active loading placeholder={<Skeleton.Paragraph rows={5} style={{ padding: 16 }} />} />
        </div>
      ) : (
        <>
          {/* 状态卡：浅色状态底 + Tag 在上、说明在下 */}
          <div className={`miq-hero miq-hero--${status}`}>
            <div className="miq-hero__main">
              <Tag size="large" color={meta.tag}>{t(meta.text)}</Tag>
              <div className="miq-hero__desc">{t(meta.desc)}</div>
              {status === 3 && String(form.applyReply ?? '').trim() ? (
                <Banner
                  className="miq-hero__reject"
                  type="danger"
                  closeIcon={null}
                  description={`${t('审核失败原因')}：${form.applyReply}`}
                />
              ) : null}
            </div>
            {!editing ? (
              <Button theme="solid" type="primary" onClick={() => toggleEdit(true)}>
                {status === 0 ? t('添加增票资质') : t('修改并重新审核')}
              </Button>
            ) : null}
          </div>

          {/* 温馨提示（轻量信息卡，不用 Banner 的重色块） */}
          <div className="miq-tips">
            <div className="miq-tips__title">
              <IconInfoCircle size="small" />
              {t('温馨提示')}
            </div>
            <ul className="miq-tips__list">
              <li>{t('我们会在一个工作日内完成审核工作')}。</li>
              <li>{t('资质审核结果查询时间')}：{t('资质上传一到两个工作日后即可查询')}。</li>
              <li>{t('注意有效增值税专用发票开票资质仅为一个')}。</li>
            </ul>
          </div>

          {/* 只读资质（已过审且非编辑态） */}
          {!editing && hasRecord ? (
            <div className="miq-card">
              <div className="miq-card__title">{t('填写增票资质信息')}</div>
              <div className="miq-card__body">
                <Descriptions align="left" size="medium" data={readonlyData} />
              </div>
            </div>
          ) : null}

          {/* 编辑表单 */}
          {editing ? (
            <form className="miq-card miq-form" onSubmit={(event) => event.preventDefault()}>
              <div className="miq-card__title">
                {t('填写增票资质信息')}
                <span className="miq-card__title-extra">（{t('所有信息均为必填')}）</span>
              </div>
              <div className="miq-card__body">
                <div className="miq-form__grid">
                  {editFields.map((field) => (
                    <div key={field.key} className={`miq-field${field.wide ? ' miq-field--wide' : ''}`}>
                      <label className="miq-field__label">{field.label}</label>
                      <Input
                        value={String(form[field.key] ?? '')}
                        placeholder={field.placeholder}
                        onChange={(value) => update(field.key, value)}
                      />
                    </div>
                  ))}
                </div>
                <div className="miq-form__agree">
                  <Checkbox checked={agreed} onChange={(event) => setAgreed(Boolean(event.target.checked))}>
                    {t('我已阅读并同意')}
                    <Link className="miq-agree-link" target="_blank" href="/member/userinvoice/confirminfo">
                      《{t('增票资质确认书')}》
                    </Link>
                  </Checkbox>
                </div>
                <div className="miq-form__actions">
                  <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>
                    {t('确认')}
                  </Button>
                  {hasRecord ? (
                    <Button theme="light" onClick={() => toggleEdit(false)}>{t('取消')}</Button>
                  ) : null}
                </div>
              </div>
            </form>
          ) : null}
        </>
      )}
    </div>
  );
}

'use client';

/**
 * 发票详情 / 重新申请
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/orderinvoice/Info.vue
 *   type=info     只读展示（发票类型/抬头/企业信息/银行/发票内容/收票人/发票图片）
 *   type=reapply  重新申请表单（审核驳回后）
 * 接口：GET  /api/user/orderInvoice/detail?id=
 *       POST /api/user/orderInvoice/reapply
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
import { formatPrice } from '@/lib/currency';
interface InvoiceDetail {
  id?: number;
  orderId?: number;
  orderSn?: string;
  totalAmount?: number | string;
  amount?: number | string;
  invoiceType?: number;
  titleType?: number;
  invoiceContent?: string;
  mobile?: string;
  email?: string;
  companyName?: string;
  companyCode?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyBank?: string;
  companyAccount?: string;
  status?: number;
  statusName?: string;
  applyReply?: string;
  invoiceImg?: string;
  [key: string]: unknown;
}

const INVOICE_TYPE: Record<number, string> = { 1: '普通发票', 2: '增值税专用发票' };
const TITLE_TYPE: Record<number, string> = { 1: '个人', 2: '企业' };
const STATUS_TEXT: Record<number, string> = { 0: '待审核', 1: '已开具', 2: '审核未通过', 3: '已作废' };

function money(value: unknown): string {
  return Number(value || 0).toFixed(2);
}

export default function InvoiceDetailClient({ invoiceId, mode }: { invoiceId: string; mode: 'info' | 'reapply' }) {
    const { t } = useTranslation();
  const [detail, setDetail] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<InvoiceDetail>({});

  const load = useCallback(() => {
    if (!invoiceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiGet<InvoiceDetail>('user/orderInvoice/detail', { id: invoiceId })
      .then((data) => {
        setDetail(data || null);
        setForm({ ...(data || {}) });
      })
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [invoiceId]);

  useEffect(() => {
    load();
  }, [load]);

  const update = (key: keyof InvoiceDetail, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const submit = async () => {
    if (!form.companyName?.trim()) return Toast.error({ content: '请输入企业名称' });
    if (!form.companyCode?.trim()) return Toast.error({ content: '请输入纳税人识别号' });
    if (!form.mobile?.trim()) return Toast.error({ content: '请输入收票人手机' });
    setSaving(true);
    try {
      await apiPost('user/orderInvoice/reapply', {
        id: Number(invoiceId),
        invoiceType: Number(form.invoiceType) || 1,
        titleType: Number(form.titleType) || 2,
        invoiceContent: form.invoiceContent || t('商品明细'),
        mobile: String(form.mobile).trim(),
        email: String(form.email || '').trim(),
        companyName: String(form.companyName).trim(),
        companyCode: String(form.companyCode).trim(),
        companyAddress: String(form.companyAddress || '').trim(),
        companyPhone: String(form.companyPhone || '').trim(),
        companyBank: String(form.companyBank || '').trim(),
        companyAccount: String(form.companyAccount || '').trim(),
      });
      Toast.success({ content: '已重新提交，请等待审核' });
      window.location.href = '/member/orderinvoice';
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card className="member-card">{t('加载中...')}</Card>;
  if (!detail) return <div className="comment-empty">{t('未找到发票信息')}</div>;

  const status = Number(detail.status ?? 0);
  const isSpecial = Number(detail.invoiceType) === 2;

  if (mode === 'info') {
    return (
      <Card className="member-card invoice-detail">
        <div className={`invoice-detail__status is-${status}`}>
          <span>{detail.statusName || STATUS_TEXT[status] || t('待审核')}</span>
          {status === 2 && detail.applyReply ? (
            <span className="invoice-detail__reply">驳回原因：{detail.applyReply}</span>
          ) : null}
        </div>

        <dl className="invoice-detail__list">
          <div><dt>{t('订单号')}</dt><dd>
            {detail.orderId ? <Link href={`/member/order/detail?id=${detail.orderId}`}>{detail.orderSn || '-'}</Link> : (detail.orderSn || '-')}
          </dd></div>
          <div><dt>{t('订单金额')}</dt><dd>{formatPrice(detail.totalAmount)}</dd></div>
          <div><dt>{t('发票金额')}</dt><dd>{formatPrice(detail.amount)}</dd></div>
          <div><dt>{t('发票类型')}</dt><dd>{INVOICE_TYPE[Number(detail.invoiceType) || 1]}</dd></div>
          <div><dt>{t('抬头类型')}</dt><dd>{TITLE_TYPE[isSpecial ? 2 : Number(detail.titleType) || 1]}</dd></div>
          {isSpecial || Number(detail.titleType) === 2 ? (
            <>
              <div><dt>{t('企业名称')}</dt><dd>{detail.companyName || '-'}</dd></div>
              <div><dt>{t('纳税人识别号')}</dt><dd>{detail.companyCode || '-'}</dd></div>
              <div><dt>{t('单位地址')}</dt><dd>{detail.companyAddress || '-'}</dd></div>
              <div><dt>{t('单位电话')}</dt><dd>{detail.companyPhone || '-'}</dd></div>
              <div><dt>{t('开户银行')}</dt><dd>{detail.companyBank || '-'}</dd></div>
              <div><dt>{t('银行账号')}</dt><dd>{detail.companyAccount || '-'}</dd></div>
            </>
          ) : (
            <div><dt>{t('发票抬头')}</dt><dd>{detail.companyName || t('个人')}</dd></div>
          )}
          <div><dt>{t('发票内容')}</dt><dd>{detail.invoiceContent || t('商品明细')}</dd></div>
          <div><dt>{t('收票人手机')}</dt><dd>{detail.mobile || '-'}</dd></div>
          <div><dt>{t('收票人邮箱')}</dt><dd>{detail.email || '-'}</dd></div>
        </dl>

        {detail.invoiceImg ? (
          <div className="invoice-detail__img">
            <img src={String(detail.invoiceImg)} alt={t('发票图片')} />
          </div>
        ) : null}

        <div className="invoice-detail__actions">
          <Link href="/member/orderinvoice"><Button>{t('返回发票列表')}</Button></Link>
          {status === 2 ? (
            <Link href={`/member/orderinvoice/info?type=reapply&id=${invoiceId}`}>
              <Button theme="solid" type="primary">{t('重新申请')}</Button>
            </Link>
          ) : null}
        </div>
      </Card>
    );
  }

  return (
    <Card className="member-card invoice-detail">
      <div className="invoice-detail__status is-2">
        <span>{t('审核未通过，请修改后重新提交')}</span>
        {detail.applyReply ? <span className="invoice-detail__reply">驳回原因：{detail.applyReply}</span> : null}
      </div>

      <div className="security-form">
        <label>{t('发票类型')}</label>
        <div className="cert-options">
          <button type="button" className={Number(form.invoiceType) === 1 ? 'is-active' : ''} onClick={() => update('invoiceType', '1')}>{t('普通发票')}</button>
          <button type="button" className={Number(form.invoiceType) === 2 ? 'is-active' : ''} onClick={() => update('invoiceType', '2')}>{t('增值税专用发票')}</button>
        </div>
        <label>{t('企业名称')}</label>
        <input value={String(form.companyName || '')} onChange={(event) => update('companyName', event.target.value)} placeholder={t('请输入企业名称')} />
        <label>{t('纳税人识别号')}</label>
        <input value={String(form.companyCode || '')} onChange={(event) => update('companyCode', event.target.value)} placeholder={t('请输入纳税人识别号')} />
        <label>{t('单位地址')}</label>
        <input value={String(form.companyAddress || '')} onChange={(event) => update('companyAddress', event.target.value)} placeholder={t('请输入单位地址')} />
        <label>{t('单位电话')}</label>
        <input value={String(form.companyPhone || '')} onChange={(event) => update('companyPhone', event.target.value)} placeholder={t('请输入单位电话')} />
        <label>{t('开户银行')}</label>
        <input value={String(form.companyBank || '')} onChange={(event) => update('companyBank', event.target.value)} placeholder={t('请输入开户银行')} />
        <label>{t('银行账号')}</label>
        <input value={String(form.companyAccount || '')} onChange={(event) => update('companyAccount', event.target.value)} placeholder={t('请输入银行账号')} />
        <label>{t('收票人手机')}</label>
        <input value={String(form.mobile || '')} onChange={(event) => update('mobile', event.target.value)} placeholder={t('请输入收票人手机')} />
        <label>{t('收票人邮箱')}</label>
        <input value={String(form.email || '')} onChange={(event) => update('email', event.target.value)} placeholder={t('选填，用于接收电子发票')} />
        <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>{t('重新提交')}</Button>
      </div>
    </Card>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

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

export default function InvoiceQualificationClient() {
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
        setEditing(!data.companyName || Number(data.status) === 0 || Number(data.status) === 3);
      })
      .catch(() => setEditing(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const update = (key: keyof InvoiceForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.companyName?.trim()) return Toast.error({ content: '请输入单位名称' });
    if (!form.companyAddress?.trim()) return Toast.error({ content: '请输入注册地址' });
    if (!form.companyBank?.trim()) return Toast.error({ content: '请输入开户银行' });
    if (!agreed) return Toast.error({ content: '请先阅读并勾选协议' });
    setSaving(true);
    try {
      const payload = { ...form, titleType: 2, invoiceType: 1, isAdd: 1, isConfirm: 1 };
      if (Number(form.status) === 0 || !form.invoiceId) {
        await apiPost('user/invoice/create', payload);
      } else {
        await apiPost('user/invoice/update', { id: form.invoiceId, ...payload });
      }
      Toast.success({ content: '提交成功，等待审核' });
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSaving(false);
    }
  };

  const status = Number(form.status || 0);
  const statusText = status === 1 ? '审核通过' : status === 2 ? '已申请，待审核' : status === 3 ? '审核未通过' : '未申请专用发票';

  if (loading) return <Card className="member-card">加载中...</Card>;

  return (
    <Card className="member-card invoice-card">
      <div className={`invoice-status invoice-status--${status}`}>{statusText}</div>
      {status === 3 && form.applyReply ? <div className="invoice-error">审核失败原因：{form.applyReply}</div> : null}

      {!editing && form.companyName ? (
        <div className="invoice-readonly">
          <div><label>单位名称</label><span>{form.companyName}</span></div>
          <div><label>纳税人识别码</label><span>{form.companyCode || '-'}</span></div>
          <div><label>注册地址</label><span>{form.companyAddress || '-'}</span></div>
          <div><label>注册电话</label><span>{form.companyPhone || '-'}</span></div>
          <div><label>开户银行</label><span>{form.companyBank || '-'}</span></div>
          <div><label>银行账户</label><span>{form.companyAccount || '-'}</span></div>
          <Button onClick={() => setEditing(true)}>修改并重新审核</Button>
        </div>
      ) : (
        <div className="invoice-form">
          <label>单位名称</label>
          <input value={form.companyName || ''} onChange={(event) => update('companyName', event.target.value)} placeholder="请输入单位名称" />
          <label>纳税人识别码</label>
          <input value={form.companyCode || ''} onChange={(event) => update('companyCode', event.target.value)} placeholder="请输入纳税人识别码" />
          <label>注册地址</label>
          <input value={form.companyAddress || ''} onChange={(event) => update('companyAddress', event.target.value)} placeholder="请输入注册地址" />
          <label>注册电话</label>
          <input value={form.companyPhone || ''} onChange={(event) => update('companyPhone', event.target.value)} placeholder="请输入注册电话" />
          <label>开户银行</label>
          <input value={form.companyBank || ''} onChange={(event) => update('companyBank', event.target.value)} placeholder="请输入开户银行" />
          <label>银行账户</label>
          <input value={form.companyAccount || ''} onChange={(event) => update('companyAccount', event.target.value)} placeholder="请输入银行账户" />
          <label className="invoice-agreement"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> 已阅读并同意《发票资质协议》</label>
          <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>提交审核</Button>
        </div>
      )}
    </Card>
  );
}

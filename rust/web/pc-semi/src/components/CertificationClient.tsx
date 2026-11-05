'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface CompanyData {
  documentType?: string;
  corporateName?: string;
  documentNumber?: string;
  contactPhone?: string;
  birthday?: string;
  residentialAddress?: string;
  companyName?: string;
  businessLicenseId?: string;
  businessLicenseAddress?: string;
  businessScope?: string;
}

interface ApplyState {
  status?: number;
  applyReply?: string;
  type?: number;
  companyData?: CompanyData;
  [key: string]: unknown;
}

const STATUS_TEXT: Record<number, string> = { 0: '未申请', 1: '审核通过', 2: '已申请，待审核', 3: '审核未通过' };

export default function CertificationClient() {
  const [state, setState] = useState<ApplyState>({});
  const [form, setForm] = useState<ApplyState>({ type: 1, companyData: {} });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiGet<ApplyState>('user/company/myApply')
      .then((result) => {
        const data = result || {};
        setState(data);
        setForm({ type: Number(data.type) || 1, companyData: { ...(data.companyData || {}) } });
        setEditing(!data.companyData?.corporateName || Number(data.status) === 3);
      })
      .catch(() => setEditing(true))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const update = (key: keyof CompanyData, value: string) => {
    setForm((current) => ({ ...current, companyData: { ...(current.companyData || {}), [key]: value } }));
  };

  const submit = async () => {
    const data = form.companyData || {};
    if (!data.documentType) return Toast.error({ content: '请选择证件类型' });
    if (!data.corporateName?.trim()) return Toast.error({ content: '请输入姓名' });
    if (!data.documentNumber?.trim()) return Toast.error({ content: '请输入证件号码' });
    if (!data.contactPhone?.trim()) return Toast.error({ content: '请输入联系人手机' });
    if (Number(form.type) === 2 && !data.companyName?.trim()) return Toast.error({ content: '请输入企业名称' });
    setSaving(true);
    try {
      await apiPost('user/company/apply', { ...form, companyData: data });
      Toast.success({ content: '提交成功，等待审核' });
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card className="member-card">加载中...</Card>;
  const status = Number(state.status || 0);

  return (
    <Card className="member-card certification-card">
      <div className={`cert-status cert-status--${status}`}>{STATUS_TEXT[status] || '未申请'}</div>
      {status === 3 && state.applyReply ? <div className="cert-error">审核失败原因：{state.applyReply}</div> : null}

      {!editing && state.companyData?.corporateName ? (
        <div className="cert-readonly">
          <div><label>认证类型</label><span>{Number(state.type) === 1 ? '个人' : '企业'}</span></div>
          <div><label>证件类型</label><span>{state.companyData.documentType || '-'}</span></div>
          <div><label>姓名</label><span>{state.companyData.corporateName}</span></div>
          <div><label>证件号码</label><span>{state.companyData.documentNumber}</span></div>
          <div><label>联系人手机</label><span>{state.companyData.contactPhone}</span></div>
          {Number(state.type) === 2 ? <div><label>企业名称</label><span>{state.companyData.companyName || '-'}</span></div> : null}
          {status === 3 ? <Button onClick={() => setEditing(true)}>修改并重新提交</Button> : null}
        </div>
      ) : (
        <div className="security-form cert-form">
          <label>认证类型</label>
          <div className="cert-options">
            <button type="button" className={Number(form.type) === 1 ? 'is-active' : ''} onClick={() => setForm({ ...form, type: 1 })}>个人</button>
            <button type="button" className={Number(form.type) === 2 ? 'is-active' : ''} onClick={() => setForm({ ...form, type: 2 })}>企业</button>
          </div>
          <label>证件类型</label>
          <select value={form.companyData?.documentType || ''} onChange={(event) => update('documentType', event.target.value)}>
            <option value="">请选择证件类型</option>
            <option value="1">身份证</option>
            <option value="2">护照</option>
            <option value="3">营业执照</option>
          </select>
          <label>{Number(form.type) === 1 ? '姓名' : '法定代表人姓名'}</label>
          <input value={form.companyData?.corporateName || ''} onChange={(event) => update('corporateName', event.target.value)} placeholder="请输入姓名" />
          <label>证件号码</label>
          <input value={form.companyData?.documentNumber || ''} onChange={(event) => update('documentNumber', event.target.value)} placeholder="请输入证件号码" />
          <label>联系人手机</label>
          <input value={form.companyData?.contactPhone || ''} onChange={(event) => update('contactPhone', event.target.value)} placeholder="请输入联系人手机" />
          {Number(form.type) === 1 ? (
            <>
              <label>居住地址</label>
              <input value={form.companyData?.residentialAddress || ''} onChange={(event) => update('residentialAddress', event.target.value)} placeholder="请输入居住地址" />
            </>
          ) : (
            <>
              <label>企业名称</label>
              <input value={form.companyData?.companyName || ''} onChange={(event) => update('companyName', event.target.value)} placeholder="请输入企业名称" />
              <label>统一社会信用代码</label>
              <input value={form.companyData?.businessLicenseId || ''} onChange={(event) => update('businessLicenseId', event.target.value)} placeholder="请输入统一社会信用代码" />
              <label>注册地址</label>
              <input value={form.companyData?.businessLicenseAddress || ''} onChange={(event) => update('businessLicenseAddress', event.target.value)} placeholder="请输入注册地址" />
              <label>经营范围</label>
              <input value={form.companyData?.businessScope || ''} onChange={(event) => update('businessScope', event.target.value)} placeholder="请输入经营范围" />
            </>
          )}
          <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>提交认证</Button>
        </div>
      )}
    </Card>
  );
}

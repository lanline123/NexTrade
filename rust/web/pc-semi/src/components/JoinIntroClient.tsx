'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface MerchantApply {
  merchantApplyId?: number;
  status?: number;
  statusName?: string;
  auditRemark?: string;
  [key: string]: unknown;
}

export default function JoinIntroClient() {
  const [apply, setApply] = useState<MerchantApply | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [form, setForm] = useState({
    type: 2,
    companyName: '',
    businessLicenseAddress: '',
    businessLicenseId: '',
    contactName: '',
    contactPhone: '',
    contactEmail: '',
    shopContactMobile: '',
  });

  useEffect(() => {
    apiGet<MerchantApply>('merchant/merchant/myApply')
      .then((result) => setApply(result || null))
      .catch(() => setApply(null))
      .finally(() => setLoading(false));
  }, []);

  const update = (key: keyof typeof form, value: string | number) => setForm((current) => ({ ...current, [key]: value }));

  const submit = async () => {
    if (!form.companyName.trim()) return Toast.error({ content: '请输入公司名称' });
    if (!form.businessLicenseId.trim()) return Toast.error({ content: '请输入统一社会信用代码' });
    if (!form.contactName.trim() || !form.contactPhone.trim()) return Toast.error({ content: '请输入联系人信息' });
    if (!agreed) return Toast.error({ content: '请先阅读并同意入驻协议' });
    setSubmitting(true);
    try {
      await apiPost('merchant/merchant/apply', {
        type: form.type,
        baseData: {
          companyName: form.companyName.trim(),
          businessLicenseAddress: form.businessLicenseAddress.trim(),
          businessLicenseId: form.businessLicenseId.trim(),
        },
        merchantData: {
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim(),
          contactEmail: form.contactEmail.trim(),
          businessLicenseImg: [],
        },
        shopData: {
          contactMobile: form.shopContactMobile.trim() || form.contactPhone.trim(),
        },
      });
      Toast.success({ content: '入驻申请已提交' });
      const result = await apiGet<MerchantApply>('merchant/merchant/myApply').catch(() => null);
      setApply(result || { statusName: '待审核' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <Card className="member-card">加载中...</Card>;

  if (apply?.merchantApplyId) {
    const status = Number(apply.status);
    return (
      <Card className="member-card join-intro-status">
        <h2>入驻申请</h2>
        <div className={`join-intro-status__badge is-${status}`}>{apply.statusName || (status === 1 ? '审核通过' : status === 2 ? '审核驳回' : '待审核')}</div>
        {apply.auditRemark ? <p className="join-intro-status__remark">审核备注：{apply.auditRemark}</p> : null}
        <p>申请编号：{apply.merchantApplyId}</p>
        <p>如需修改资料，请联系平台客服或等待审核结果。</p>
      </Card>
    );
  }

  return (
    <Card className="member-card join-intro">
      <h2>入驻资料</h2>
      <p className="join-intro__hint">请填写企业基本信息与联系人信息，提交后由平台审核。</p>
      <div className="security-form join-intro__form">
        <label>入驻类型</label>
        <select value={form.type} onChange={(event) => update('type', Number(event.target.value))}>
          <option value={2}>企业</option>
          <option value={1}>个人</option>
        </select>
        <label>公司名称</label>
        <input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} placeholder="请输入公司名称" />
        <label>统一社会信用代码</label>
        <input value={form.businessLicenseId} onChange={(event) => update('businessLicenseId', event.target.value)} placeholder="请输入统一社会信用代码" />
        <label>营业执照地址</label>
        <input value={form.businessLicenseAddress} onChange={(event) => update('businessLicenseAddress', event.target.value)} placeholder="请输入营业执照地址" />
        <label>联系人姓名</label>
        <input value={form.contactName} onChange={(event) => update('contactName', event.target.value)} placeholder="请输入联系人姓名" />
        <label>联系人手机</label>
        <input value={form.contactPhone} onChange={(event) => update('contactPhone', event.target.value)} placeholder="请输入联系人手机" />
        <label>联系人邮箱</label>
        <input value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} placeholder="请输入联系人邮箱" />
        <label>店铺联系电话</label>
        <input value={form.shopContactMobile} onChange={(event) => update('shopContactMobile', event.target.value)} placeholder="默认使用联系人手机" />
        <label className="join-intro__agreement"><input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} /> 已阅读并同意入驻协议</label>
        <Button theme="solid" type="primary" loading={submitting} onClick={() => void submit()}>提交入驻申请</Button>
      </div>
    </Card>
  );
}

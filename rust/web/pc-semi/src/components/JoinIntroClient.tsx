'use client';

/**
 * 商家入驻申请
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/join/intro.vue
 * 三步流程（源码 currentStep + step.vue）：
 *   1 主体信息（主体类型、证件类型、姓名/法定代表人、证件号、证件有效期、居住地址、性别）
 *   2 资质与银行（营业执照、统一社会信用代码、注册地址、经营范围、经营期限、开户名/账号/开户行）
 *   3 店铺信息（店铺名称、联系人、联系电话、邮箱）+ 协议勾选 + 提交
 * 接口：GET  /api/merchant/merchant/myApply
 *       POST /api/merchant/merchant/apply
 */
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

interface FormState {
  type: number;
  documentType: string;
  corporateName: string;
  documentNumber: string;
  certificateValidityPeriod: number;
  certificateValidityPeriodDate: string;
  certificateValidityPeriodEnd: string;
  residentialAddress: string;
  sex: number;
  companyName: string;
  businessLicenseId: string;
  businessLicenseAddress: string;
  businessScope: string;
  operatingTermType: number;
  operatingTermTypeDate: string;
  operatingTermTypeEnd: string;
  bankAccountName: string;
  bankAccountNo: string;
  bankName: string;
  shopTitle: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

const EMPTY: FormState = {
  type: 2,
  documentType: '',
  corporateName: '',
  documentNumber: '',
  certificateValidityPeriod: 1,
  certificateValidityPeriodDate: '',
  certificateValidityPeriodEnd: '',
  residentialAddress: '',
  sex: 1,
  companyName: '',
  businessLicenseId: '',
  businessLicenseAddress: '',
  businessScope: '',
  operatingTermType: 1,
  operatingTermTypeDate: '',
  operatingTermTypeEnd: '',
  bankAccountName: '',
  bankAccountNo: '',
  bankName: '',
  shopTitle: '',
  contactName: '',
  contactPhone: '',
  contactEmail: '',
};

const STEPS = ['主体信息', '资质与银行', '店铺信息'];

export default function JoinIntroClient() {
  const [apply, setApply] = useState<MerchantApply | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({ ...EMPTY });

  useEffect(() => {
    apiGet<MerchantApply>('merchant/merchant/myApply')
      .then((result) => setApply(result || null))
      .catch(() => setApply(null))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  /** 源码分步校验：每步只校验本步必填项 */
  const validateStep = (target: number): string => {
    if (target === 1) {
      if (!form.documentType) return '请选择证件类型';
      if (!form.corporateName.trim()) return form.type === 1 ? '请输入姓名' : '请输入法定代表人姓名';
      if (!form.documentNumber.trim()) return '请输入证件号码';
      if (form.certificateValidityPeriod === 2 && (!form.certificateValidityPeriodDate || !form.certificateValidityPeriodEnd)) {
        return '请选择证件有效期';
      }
      if (form.type === 2 && !form.companyName.trim()) return '请输入企业名称';
      return '';
    }
    if (target === 2) {
      if (!form.companyName.trim()) return '请输入企业名称';
      if (!form.businessLicenseId.trim()) return '请输入统一社会信用代码';
      if (!form.businessLicenseAddress.trim()) return '请输入注册地址';
      if (!form.bankAccountName.trim()) return '请输入开户名';
      if (!form.bankAccountNo.trim()) return '请输入银行账号';
      if (!form.bankName.trim()) return '请输入开户银行';
      return '';
    }
    if (!form.shopTitle.trim()) return '请输入店铺名称';
    if (!form.contactName.trim()) return '请输入联系人';
    if (!form.contactPhone.trim()) return '请输入联系电话';
    return '';
  };

  const next = () => {
    const message = validateStep(step);
    if (message) {
      Toast.error({ content: message });
      return;
    }
    setStep((current) => Math.min(3, current + 1));
  };

  const submit = async () => {
    const message = validateStep(3);
    if (message) return Toast.error({ content: message });
    if (!agreed) return Toast.error({ content: '请先阅读并同意入驻协议' });
    setSubmitting(true);
    try {
      await apiPost('merchant/merchant/apply', {
        type: form.type,
        baseData: {
          type: form.type,
          documentType: form.documentType,
          corporateName: form.corporateName.trim(),
          documentNumber: form.documentNumber.trim(),
          certificateValidityPeriod: form.certificateValidityPeriod,
          certificateValidityPeriodDate: form.certificateValidityPeriodDate,
          certificateValidityPeriodEnd: form.certificateValidityPeriodEnd,
          residentialAddress: form.residentialAddress.trim(),
          sex: form.sex,
          companyName: form.companyName.trim(),
          businessLicenseAddress: form.businessLicenseAddress.trim(),
          businessLicenseId: form.businessLicenseId.trim(),
          businessScope: form.businessScope.trim(),
          operatingTermType: form.operatingTermType,
          operatingTermTypeDate: form.operatingTermTypeDate,
          operatingTermTypeEnd: form.operatingTermTypeEnd,
        },
        merchantData: {
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim(),
          contactEmail: form.contactEmail.trim(),
          bankAccountName: form.bankAccountName.trim(),
          bankAccountNo: form.bankAccountNo.trim(),
          bankName: form.bankName.trim(),
          businessLicenseImg: [],
        },
        shopData: {
          shopTitle: form.shopTitle.trim(),
          contactName: form.contactName.trim(),
          contactMobile: form.contactPhone.trim(),
          contactEmail: form.contactEmail.trim(),
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

  if (apply) {
    const status = Number(apply.status ?? 0);
    return (
      <Card className="member-card join-status">
        <h3>入驻申请{apply.statusName || (status === 0 ? '待审核' : status === 1 ? '已通过' : '未通过')}</h3>
        {status === 2 && apply.auditRemark ? <p className="join-status__remark">驳回原因：{apply.auditRemark}</p> : null}
        <p className="join-status__tip">
          {status === 0 ? '您的入驻申请正在审核中，请耐心等待。' : status === 1 ? '恭喜，您的入驻申请已通过，可进入商家中心。' : '请根据驳回原因修改后重新提交。'}
        </p>
      </Card>
    );
  }

  return (
    <Card className="member-card join-form">
      <ol className="join-steps">
        {STEPS.map((label, index) => (
          <li key={label} className={step === index + 1 ? 'is-active' : step > index + 1 ? 'is-done' : ''}>
            <span className="join-steps__index">{index + 1}</span>
            <span className="join-steps__label">{label}</span>
          </li>
        ))}
      </ol>

      {step === 1 ? (
        <div className="security-form">
          <label>主体类型</label>
          <div className="cert-options">
            <button type="button" className={form.type === 1 ? 'is-active' : ''} onClick={() => update('type', 1)}>个人</button>
            <button type="button" className={form.type === 2 ? 'is-active' : ''} onClick={() => update('type', 2)}>企业</button>
          </div>

          <label>证件类型</label>
          <select value={form.documentType} onChange={(event) => update('documentType', event.target.value)}>
            <option value="">请选择证件类型</option>
            <option value="1">身份证</option>
            <option value="2">护照</option>
          </select>

          <label>{form.type === 1 ? '姓名' : '法定代表人姓名'}</label>
          <input value={form.corporateName} onChange={(event) => update('corporateName', event.target.value)} placeholder="请输入姓名" />

          <label>证件号码</label>
          <input value={form.documentNumber} onChange={(event) => update('documentNumber', event.target.value)} placeholder="请输入证件号码" />

          {form.type === 1 ? (
            <>
              <label>性别</label>
              <div className="cert-options">
                <button type="button" className={form.sex === 1 ? 'is-active' : ''} onClick={() => update('sex', 1)}>男</button>
                <button type="button" className={form.sex === 2 ? 'is-active' : ''} onClick={() => update('sex', 2)}>女</button>
              </div>
              <label>居住地址</label>
              <input value={form.residentialAddress} onChange={(event) => update('residentialAddress', event.target.value)} placeholder="请输入居住地址" />
            </>
          ) : (
            <>
              <label>企业名称</label>
              <input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} placeholder="请输入企业名称" />
            </>
          )}

          <label>证件有效期</label>
          <div className="cert-options">
            <button type="button" className={form.certificateValidityPeriod === 1 ? 'is-active' : ''} onClick={() => update('certificateValidityPeriod', 1)}>长期</button>
            <button type="button" className={form.certificateValidityPeriod === 2 ? 'is-active' : ''} onClick={() => update('certificateValidityPeriod', 2)}>指定期限</button>
          </div>
          <div className="cert-range">
            <input
              type="date"
              value={form.certificateValidityPeriodDate}
              disabled={form.certificateValidityPeriod !== 2}
              onChange={(event) => update('certificateValidityPeriodDate', event.target.value)}
            />
            <span>至</span>
            <input
              type="date"
              value={form.certificateValidityPeriodEnd}
              disabled={form.certificateValidityPeriod !== 2}
              onChange={(event) => update('certificateValidityPeriodEnd', event.target.value)}
            />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="security-form">
          <label>企业名称</label>
          <input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} placeholder="请输入企业名称" />
          <label>统一社会信用代码</label>
          <input value={form.businessLicenseId} onChange={(event) => update('businessLicenseId', event.target.value)} placeholder="请输入统一社会信用代码" />
          <label>注册地址</label>
          <input value={form.businessLicenseAddress} onChange={(event) => update('businessLicenseAddress', event.target.value)} placeholder="请输入注册地址" />
          <label>经营范围</label>
          <input value={form.businessScope} onChange={(event) => update('businessScope', event.target.value)} placeholder="请输入经营范围" />

          <label>经营期限</label>
          <div className="cert-options">
            <button type="button" className={form.operatingTermType === 1 ? 'is-active' : ''} onClick={() => update('operatingTermType', 1)}>长期</button>
            <button type="button" className={form.operatingTermType === 2 ? 'is-active' : ''} onClick={() => update('operatingTermType', 2)}>指定期限</button>
          </div>
          <div className="cert-range">
            <input
              type="date"
              value={form.operatingTermTypeDate}
              disabled={form.operatingTermType !== 2}
              onChange={(event) => update('operatingTermTypeDate', event.target.value)}
            />
            <span>至</span>
            <input
              type="date"
              value={form.operatingTermTypeEnd}
              disabled={form.operatingTermType !== 2}
              onChange={(event) => update('operatingTermTypeEnd', event.target.value)}
            />
          </div>

          <label>{form.type === 2 ? '对公银行账户' : '银行账户'}</label>
          <input value={form.bankAccountName} onChange={(event) => update('bankAccountName', event.target.value)} placeholder="请输入开户名" />
          <input value={form.bankAccountNo} onChange={(event) => update('bankAccountNo', event.target.value)} placeholder="请输入银行账号" />
          <input value={form.bankName} onChange={(event) => update('bankName', event.target.value)} placeholder="请输入开户银行" />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="security-form">
          <label>店铺名称</label>
          <input value={form.shopTitle} onChange={(event) => update('shopTitle', event.target.value)} placeholder="请输入店铺名称" />
          <label>联系人</label>
          <input value={form.contactName} onChange={(event) => update('contactName', event.target.value)} placeholder="请输入联系人" />
          <label>联系电话</label>
          <input value={form.contactPhone} onChange={(event) => update('contactPhone', event.target.value)} placeholder="请输入联系电话" />
          <label>联系邮箱</label>
          <input value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} placeholder="请输入联系邮箱（选填）" />
          <label className="register-agree">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>我已阅读并同意《商家入驻协议》</span>
          </label>
        </div>
      ) : null}

      <div className="join-actions">
        {step > 1 ? <Button onClick={() => setStep((current) => Math.max(1, current - 1))}>上一步</Button> : null}
        {step < 3 ? (
          <Button theme="solid" type="primary" onClick={next}>下一步</Button>
        ) : (
          <Button theme="solid" type="primary" loading={submitting} onClick={() => void submit()}>提交入驻申请</Button>
        )}
      </div>
    </Card>
  );
}

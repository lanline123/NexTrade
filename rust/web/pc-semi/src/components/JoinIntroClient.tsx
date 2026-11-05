'use client';

/**
 * 商家入驻申请
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/join/intro.vue
 * 步骤（源码 currentStep）：
 *   1 主体信息   主体类型（个人/个体工商户/企业）、证件类型、姓名/法人、证件号、
 *                出生日期、性别、居住地址、证件有效期、证件照正反面
 *   2 联系人/结算/商户信息  联系人、结算账户（开户行/支行/卡号/开户许可证）、
 *                商户名称、经营地址、详细地址、客服电话、营业执照图、补充材料
 *   3 企业信息   企业名称、信用代码、注册地址、经营范围、营业期限
 *   最后确认提交（协议勾选）
 * 接口：GET  /api/merchant/merchant/myApply
 *       GET  /api/merchant/merchant/applyDetail?id=
 *       POST /api/merchant/merchant/apply
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface MerchantApply {
  id?: number;
  merchantApplyId?: number;
  status?: number;
  statusName?: string;
  auditRemark?: string;
  account?: string;
  password?: string;
  [key: string]: unknown;
}

interface Pic {
  picUrl?: string;
  picThumb?: string;
  [key: string]: unknown;
}

interface FormState {
  type: number;
  documentType: string;
  corporateName: string;
  documentNumber: string;
  birthday: string;
  sex: number;
  residentialAddress: string;
  certificateValidityPeriod: number;
  certificateValidityPeriodDate: string;
  certificateValidityPeriodEnd: string;
  frontOfPhoto: Pic[];
  backOfPhoto: Pic[];
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  bankDeposit: string;
  bankBranch: string;
  bankCard: string;
  accountOpeningPermit: Pic[];
  merchantName: string;
  businessAddress: string;
  businessAddressName: string;
  detailedAddress: string;
  customerServicePhone: string;
  businessLicenseImg: Pic[];
  supplementaryInformation: Pic[];
  companyName: string;
  businessLicenseId: string;
  businessLicenseAddress: string;
  businessScope: string;
  operatingTermType: number;
  operatingTermTypeDate: string;
  operatingTermTypeEnd: string;
  licenseAddrProvince: string;
}

const EMPTY: FormState = {
  type: 2,
  documentType: '',
  corporateName: '',
  documentNumber: '',
  birthday: '',
  sex: 1,
  residentialAddress: '',
  certificateValidityPeriod: 1,
  certificateValidityPeriodDate: '',
  certificateValidityPeriodEnd: '',
  frontOfPhoto: [],
  backOfPhoto: [],
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  bankDeposit: '',
  bankBranch: '',
  bankCard: '',
  accountOpeningPermit: [],
  merchantName: '',
  businessAddress: '',
  businessAddressName: '',
  detailedAddress: '',
  customerServicePhone: '',
  businessLicenseImg: [],
  supplementaryInformation: [],
  companyName: '',
  businessLicenseId: '',
  businessLicenseAddress: '',
  businessScope: '',
  operatingTermType: 1,
  operatingTermTypeDate: '',
  operatingTermTypeEnd: '',
  licenseAddrProvince: '',
};

/** 主体类型：源码 个人 / 个体工商户 / 企业 */
const SUBJECT_TYPES = [
  { value: 1, label: '个人' },
  { value: 3, label: '个体工商户' },
  { value: 2, label: '企业' },
];

/** 图片上传（源码 form/src/UploadImage.vue） */
function PicUploader({
  label,
  tip,
  value,
  max = 5,
  onChange,
}: {
  label: string;
  tip?: string;
  value: Pic[];
  max?: number;
  onChange: (list: Pic[]) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const list = Array.isArray(value) ? value : [];

  const upload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      Toast.error({ content: '单个文件不超过 10MB' });
      return;
    }
    setUploading(true);
    try {
      const token = localStorage.getItem('accessToken') || '';
      const body = new FormData();
      body.append('file', file);
      const response = await fetch('/api/user/user/uploadImg', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body,
        credentials: 'include',
      });
      const json = await response.json();
      if (json?.code !== undefined && json.code !== 0) {
        Toast.error({ content: String(json?.msg || json?.message || '上传失败') });
        return;
      }
      const data = json?.data;
      const url = typeof data === 'string' ? data : String(data?.picUrl || data?.url || '');
      if (url) onChange([...list, { picUrl: url, picThumb: String(data?.picThumb || url) }]);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '上传失败' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="join-upload">
      <div className="join-upload__label">{label}</div>
      {tip ? <div className="join-upload__tip">{tip}</div> : null}
      <div className="join-upload__list">
        {list.map((pic, index) => (
          <span className="join-upload__item" key={index}>
            <img src={String(pic.picThumb || pic.picUrl || '')} alt={label} />
            <button type="button" onClick={() => onChange(list.filter((_, i) => i !== index))}>×</button>
          </span>
        ))}
        {list.length < max ? (
          <label className="join-upload__pick">
            {uploading ? '上传中...' : '+ 上传'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/bmp,application/pdf"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = '';
              }}
            />
          </label>
        ) : null}
      </div>
    </div>
  );
}

const STEPS = ['主体信息', '联系与结算', '企业信息'];

export default function JoinIntroClient() {
  const [apply, setApply] = useState<MerchantApply | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({ ...EMPTY });

  const isEnterprise = Number(form.type) === 2;
  const isIndividual = Number(form.type) === 1;

  useEffect(() => {
    apiGet<MerchantApply>('merchant/merchant/myApply')
      .then((result) => setApply(result || null))
      .catch(() => setApply(null))
      .finally(() => setLoading(false));
  }, []);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  /** 源码分步校验 */
  const validateStep = (target: number): string => {
    if (target === 1) {
      if (!form.documentType) return '请选择证件类型';
      if (!form.corporateName.trim()) return isIndividual ? '请输入姓名' : '请输入法定代表人姓名';
      if (!form.documentNumber.trim()) return '请输入证件号码';
      if (form.certificateValidityPeriod === 2 && (!form.certificateValidityPeriodDate || !form.certificateValidityPeriodEnd)) {
        return '请选择证件有效期';
      }
      if (isEnterprise && !form.companyName.trim()) return '请输入企业名称';
      return '';
    }
    if (target === 2) {
      if (!form.contactName.trim()) return '请填写联系人姓名';
      if (!form.contactPhone.trim()) return '请填写联系电话';
      if (!form.bankDeposit.trim()) return '请输入开户银行';
      if (!form.bankCard.trim()) return '请输入银行卡号';
      if (!form.merchantName.trim()) return '请输入商户名称';
      if (!form.detailedAddress.trim()) return '请填写详细的经营场所地址';
      return '';
    }
    if (isEnterprise) {
      if (!form.companyName.trim()) return '请输入企业名称';
      if (!form.businessLicenseId.trim()) return '请输入营业执照上18位统一社会信用代码';
      if (!form.businessLicenseAddress.trim()) return '请输入注册地址';
      if (form.operatingTermType === 2 && (!form.operatingTermTypeDate || !form.operatingTermTypeEnd)) {
        return '请选择营业期限';
      }
    }
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
    if (!agreed) return Toast.error({ content: '请先阅读并同意商户入驻协议' });
    setSubmitting(true);
    try {
      await apiPost('merchant/merchant/apply', {
        type: form.type,
        baseData: {
          type: form.type,
          documentType: form.documentType,
          corporateName: form.corporateName.trim(),
          documentNumber: form.documentNumber.trim(),
          birthday: form.birthday,
          sex: form.sex,
          residentialAddress: form.residentialAddress.trim(),
          certificateValidityPeriod: form.certificateValidityPeriod,
          certificateValidityPeriodDate: form.certificateValidityPeriodDate,
          certificateValidityPeriodEnd: form.certificateValidityPeriodEnd,
          frontOfPhoto: form.frontOfPhoto,
          backOfPhoto: form.backOfPhoto,
          companyName: form.companyName.trim(),
          businessLicenseId: form.businessLicenseId.trim(),
          businessLicenseAddress: form.businessLicenseAddress.trim(),
          businessScope: form.businessScope.trim(),
          operatingTermType: form.operatingTermType,
          operatingTermTypeDate: form.operatingTermTypeDate,
          operatingTermTypeEnd: form.operatingTermTypeEnd,
          licenseAddrProvince: form.licenseAddrProvince,
          supplementaryInformation: form.supplementaryInformation,
        },
        merchantData: {
          contactName: form.contactName.trim(),
          contactPhone: form.contactPhone.trim(),
          contactEmail: form.contactEmail.trim(),
          bankDeposit: form.bankDeposit.trim(),
          bankBranch: form.bankBranch.trim(),
          bankCard: form.bankCard.trim(),
          accountOpeningPermit: form.accountOpeningPermit,
          merchantName: form.merchantName.trim(),
          businessAddress: form.businessAddress.trim(),
          businessAddressName: form.businessAddressName.trim(),
          detailedAddress: form.detailedAddress.trim(),
          customerServicePhone: form.customerServicePhone.trim(),
          businessLicenseImg: form.businessLicenseImg,
        },
        shopData: {
          shopTitle: form.merchantName.trim(),
          contactName: form.contactName.trim(),
          contactMobile: form.contactPhone.trim(),
          contactEmail: form.contactEmail.trim(),
        },
      });
      Toast.success({ content: '入驻申请已提交' });
      const result = await apiGet<MerchantApply>('merchant/merchant/myApply').catch(() => null);
      setApply(result || { statusName: '申请已受理' });
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
        {status === 1 ? (
          <>
            <h3>恭喜您，您的申请审核通过</h3>
            <p className="join-status__tip">
              您的账号：{String(apply.account || '-')}，初始密码：{String(apply.password || '-')}，请尽快修改初始密码。
            </p>
            <Link href="/member"><Button theme="solid" type="primary">进入商户后台</Button></Link>
          </>
        ) : status === 2 ? (
          <>
            <h3>很遗憾，您的申请审核未通过</h3>
            {apply.auditRemark ? <p className="join-status__remark">驳回原因：{apply.auditRemark}</p> : null}
            <Button theme="solid" type="primary" onClick={() => { setApply(null); setStep(1); }}>重新审核</Button>
          </>
        ) : (
          <>
            <h3>申请已受理</h3>
            <p className="join-status__tip">您的入驻申请已提交，请耐心等待审核结果。</p>
          </>
        )}
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
          <div className="join-section-title">主体类型</div>
          <div className="cert-options">
            {SUBJECT_TYPES.map((item) => (
              <button key={item.value} type="button" className={form.type === item.value ? 'is-active' : ''} onClick={() => update('type', item.value)}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="join-section-title">{isIndividual ? '个人信息' : '法定代表人信息'}</div>
          <label>证件类型</label>
          <select value={form.documentType} onChange={(event) => update('documentType', event.target.value)}>
            <option value="">请选择证件类型</option>
            <option value="1">身份证</option>
            <option value="2">护照</option>
          </select>
          {form.documentType === '2' ? (
            <p className="join-field-tip">护照需要增加翻译件，加盖公司鲜章，外籍商家姓名需为中文（英文），如张三（Zhangsan）。</p>
          ) : null}

          <label>{isIndividual ? '姓名' : '法定代表人姓名'}</label>
          <input value={form.corporateName} onChange={(event) => update('corporateName', event.target.value)} placeholder="填写中文名（英文名），如“张三（Zhang San）”" />

          <label>证件号码</label>
          <input value={form.documentNumber} onChange={(event) => update('documentNumber', event.target.value)} placeholder="请输入证件号码" />

          {isIndividual ? (
            <>
              <label>出生日期</label>
              <input type="date" value={form.birthday} onChange={(event) => update('birthday', event.target.value)} />
              <label>性别</label>
              <div className="cert-options">
                <button type="button" className={form.sex === 1 ? 'is-active' : ''} onClick={() => update('sex', 1)}>男</button>
                <button type="button" className={form.sex === 2 ? 'is-active' : ''} onClick={() => update('sex', 2)}>女</button>
              </div>
              <label>居住地址</label>
              <input value={form.residentialAddress} onChange={(event) => update('residentialAddress', event.target.value)} placeholder="请输入居住地址" />
            </>
          ) : null}

          <label>证件有效期</label>
          <div className="cert-options">
            <button type="button" className={form.certificateValidityPeriod === 1 ? 'is-active' : ''} onClick={() => update('certificateValidityPeriod', 1)}>长期有效</button>
            <button type="button" className={form.certificateValidityPeriod === 2 ? 'is-active' : ''} onClick={() => update('certificateValidityPeriod', 2)}>区间有效</button>
          </div>
          <div className="cert-range">
            <input type="date" value={form.certificateValidityPeriodDate} disabled={form.certificateValidityPeriod !== 2} onChange={(event) => update('certificateValidityPeriodDate', event.target.value)} />
            <span>至</span>
            <input type="date" value={form.certificateValidityPeriodEnd} disabled={form.certificateValidityPeriod !== 2} onChange={(event) => update('certificateValidityPeriodEnd', event.target.value)} />
          </div>

          <PicUploader label="证件照（人像面）" tip="如你的证件类型是身份证，请在此处上传人像面，若为复印件，需加盖公司鲜章。注意：证件盖章不支持电子章。" value={form.frontOfPhoto} onChange={(list) => update('frontOfPhoto', list)} />
          <PicUploader label="证件照（国徽面）" tip="如你的证件类型是身份证，请在此处上传国徽面，若为复印件，需加盖公司鲜章。注意：证件盖章不支持电子章。" value={form.backOfPhoto} onChange={(list) => update('backOfPhoto', list)} />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="security-form">
          <div className="join-section-title">联系人信息</div>
          <label>联系人姓名</label>
          <input value={form.contactName} onChange={(event) => update('contactName', event.target.value)} placeholder="请填写联系人姓名" />
          <label>联系电话</label>
          <input value={form.contactPhone} onChange={(event) => update('contactPhone', event.target.value)} placeholder="请填写联系电话" />
          <label>联系邮箱</label>
          <input value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} placeholder="请输入联系邮箱（选填）" />

          <div className="join-section-title">结算账户信息</div>
          <label>开户银行</label>
          <input value={form.bankDeposit} onChange={(event) => update('bankDeposit', event.target.value)} placeholder="请输入开户银行" />
          <label>开户支行</label>
          <input value={form.bankBranch} onChange={(event) => update('bankBranch', event.target.value)} placeholder="请输入开户支行" />
          <label>银行卡号</label>
          <input value={form.bankCard} onChange={(event) => update('bankCard', event.target.value)} placeholder="请输入银行卡号" />
          <PicUploader label="开户许可证" value={form.accountOpeningPermit} onChange={(list) => update('accountOpeningPermit', list)} />

          <div className="join-section-title">商户信息</div>
          <label>商户名称</label>
          <input value={form.merchantName} onChange={(event) => update('merchantName', event.target.value)} placeholder="该名称将在微信支付、支付宝支付时向买家展示" />
          <label>经营地址</label>
          <input value={form.detailedAddress} onChange={(event) => update('detailedAddress', event.target.value)} placeholder="请填写详细的经营场所地址，如有多个场所，选择一个主要场所填写即可" />
          <label>客服电话</label>
          <input value={form.customerServicePhone} onChange={(event) => update('customerServicePhone', event.target.value)} placeholder="请注意填写格式，举例（座机：0755-88880000；手机：13688880000）" />
          <PicUploader label="营业执照照片" tip="必须为彩色图片（文档请截图后上传），最多5张，单张小于2M。" value={form.businessLicenseImg} onChange={(list) => update('businessLicenseImg', list)} />

          <div className="join-section-title">补充信息</div>
          <PicUploader label="补充材料" tip="在整个申请流程中，遇到需提供资料但无上传入口的情况，都可在此处上传。" value={form.supplementaryInformation} onChange={(list) => update('supplementaryInformation', list)} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="security-form">
          {isEnterprise ? (
            <>
              <div className="join-section-title">企业信息</div>
              <label>企业名称</label>
              <input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} placeholder="请输入企业名称" />
              <label>统一社会信用代码</label>
              <input value={form.businessLicenseId} onChange={(event) => update('businessLicenseId', event.target.value)} placeholder="请输入营业执照上18位统一社会信用代码" />
              <label>注册地址</label>
              <input value={form.businessLicenseAddress} onChange={(event) => update('businessLicenseAddress', event.target.value)} placeholder="注册地址需与营业执照登记住所一致" />
              <label>经营范围</label>
              <input value={form.businessScope} onChange={(event) => update('businessScope', event.target.value)} placeholder="与企业工商营业执照上一致" />
              <label>营业期限</label>
              <div className="cert-options">
                <button type="button" className={form.operatingTermType === 1 ? 'is-active' : ''} onClick={() => update('operatingTermType', 1)}>长期</button>
                <button type="button" className={form.operatingTermType === 2 ? 'is-active' : ''} onClick={() => update('operatingTermType', 2)}>区间有效</button>
              </div>
              <div className="cert-range">
                <input type="date" value={form.operatingTermTypeDate} disabled={form.operatingTermType !== 2} onChange={(event) => update('operatingTermTypeDate', event.target.value)} />
                <span>至</span>
                <input type="date" value={form.operatingTermTypeEnd} disabled={form.operatingTermType !== 2} onChange={(event) => update('operatingTermTypeEnd', event.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="join-section-title">基本信息</div>
              <div className="join-summary-row"><span>主体类型</span><b>{SUBJECT_TYPES.find((item) => item.value === form.type)?.label}</b></div>
              <div className="join-summary-row"><span>姓名</span><b>{form.corporateName || '-'}</b></div>
              <div className="join-summary-row"><span>证件号码</span><b>{form.documentNumber || '-'}</b></div>
              <div className="join-summary-row"><span>联系人</span><b>{form.contactName || '-'} {form.contactPhone}</b></div>
              <div className="join-summary-row"><span>商户名称</span><b>{form.merchantName || '-'}</b></div>
              <div className="join-summary-row"><span>经营地址</span><b>{form.detailedAddress || '-'}</b></div>
            </>
          )}

          <label className="register-agree">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>我已同意《商户入驻协议》</span>
          </label>
        </div>
      ) : null}

      <div className="join-actions">
        {step > 1 ? <Button onClick={() => setStep((current) => Math.max(1, current - 1))}>上一步</Button> : null}
        {step < 3 ? (
          <Button theme="solid" type="primary" onClick={next}>下一步</Button>
        ) : (
          <Button theme="solid" type="primary" loading={submitting} onClick={() => void submit()}>提交</Button>
        )}
      </div>
    </Card>
  );
}

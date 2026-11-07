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
import { useEffect, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { Button, Card, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
  const [apply, setApply] = useState<MerchantApply | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>({ ...EMPTY });
  /** flow：1 招商介绍（introTable / 协议）→ 2 分步入驻表单，对照旧版 intro.vue 的 flow。 */
  const [intro, setIntro] = useState(true);
  const [subjectType, setSubjectType] = useState(2);
  const [agreementVisible, setAgreementVisible] = useState(false);
  const [agreementContent, setAgreementContent] = useState('');
  const [agreementLoading, setAgreementLoading] = useState(false);

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

  /** 开始入驻：需先同意协议，主体类型带入表单（对照 intro.vue 的 startApplying）。 */
  const startApplying = () => {
    if (!agreed) {
      Toast.error({ content: '请同意开通协议' });
      return;
    }
    setForm((current) => ({ ...current, type: subjectType }));
    setStep(1);
    setIntro(false);
  };

  /** 协议弹窗：接口失败时兜底为静态中文提示（对照 agreementWin.vue）。 */
  const openAgreement = async () => {
    setAgreementVisible(true);
    if (agreementContent) return;
    setAgreementLoading(true);
    try {
      const result = await apiGet<string | { content?: string; agreement?: string; html?: string }>('merchant/merchant/applyShopAgreement');
      const text = typeof result === 'string' ? result : String(result?.content || result?.agreement || result?.html || '');
      setAgreementContent(text || t('《商户入驻协议》：请仔细阅读并同意后提交入驻申请。'));
    } catch {
      setAgreementContent('《商户入驻协议》：请仔细阅读并同意后提交入驻申请。');
    } finally {
      setAgreementLoading(false);
    }
  };

  /** 源码分步校验 */
  const validateStep = (target: number): string => {
    if (target === 1) {
      if (!form.documentType) return '请选择证件类型';
      if (!form.corporateName.trim()) return isIndividual ? t('请输入姓名') : '请输入法定代表人姓名';
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

  if (loading) return <Card className="member-card">{t('加载中...')}</Card>;

  if (apply) {
    const status = Number(apply.status ?? 0);
    return (
      <Card className="member-card join-status">
        {status === 1 ? (
          <>
            <h3>{t('恭喜您，您的申请审核通过')}</h3>
            <p className="join-status__tip">
              您的账号：{String(apply.account || '-')}，初始密码：{String(apply.password || '-')}，请尽快修改初始密码。
            </p>
            <Link href="/member"><Button theme="solid" type="primary">{t('进入商户后台')}</Button></Link>
          </>
        ) : status === 2 ? (
          <>
            <h3>{t('很遗憾，您的申请审核未通过')}</h3>
            {apply.auditRemark ? <p className="join-status__remark">驳回原因：{apply.auditRemark}</p> : null}
            <Button theme="solid" type="primary" onClick={() => { setApply(null); setStep(1); }}>{t('重新审核')}</Button>
          </>
        ) : (
          <>
            <h3>{t('申请已受理')}</h3>
            <p className="join-status__tip">{t('您的入驻申请已提交，请耐心等待审核结果。')}</p>
          </>
        )}
      </Card>
    );
  }

  // flow = 1：招商介绍页（对照 join/index.vue + join/intro.vue flow=1 + introTable.vue + step.vue + agreementWin.vue）
  if (intro) {
    const subjectDesc = subjectType === 2
      ? t('“企业”在营业执照上的主体类型一般为：有限公司、有限责任公司等。')
      : subjectType === 3
        ? t('“个体工商户”为持有个体工商户营业执照的商家，无需提供对公银行账户和开户许可证。')
        : '“个人”为根据法律法规和相关规定免于办理工商登记，无营业执照的商家。';
    const isBusiness = subjectType === 2 || subjectType === 3;
    const stepLabels = isBusiness
      ? ['1. 法定代表人信息', '2. 经营信息', '3. 企业信息', '4. 审核及公示', '5. 完成入驻']
      : ['1. 个人信息', '2. 经营信息', '3. 审核及公示', '4. 完成入驻'];
    const cardStyle: CSSProperties = { border: '1px solid #ebedf0', borderRadius: 8, padding: 20 };
    const h2Style: CSSProperties = { fontSize: 26, fontWeight: 400, margin: '0 0 16px' };
    return (
      <div className="join-intro" style={{ background: '#fff' }}>
        {/* 顶部 banner */}
        <section className="join-intro__banner" style={{ padding: '48px 24px', textAlign: 'center', background: 'linear-gradient(135deg, #fbeede, #f5e0b8)', color: '#a9781b' }}>
          <h1 style={{ margin: 0, fontSize: 32 }}>{t('招商入驻')}</h1>
          <p style={{ margin: '12px 0 0', fontSize: 16 }}>{t('我要合作')}</p>
        </section>

        {/* 我要合作：招商计划 / 合作模式 / 招商标准 / 我要入驻 */}
        <section className="join-intro__cooperation" style={{ padding: 24 }}>
          <h2 style={h2Style}>{t('我要合作')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
            {[
              { title: '招商计划', desc: '查询发布的热招类目和品牌', action: '查看招商计划' },
              { title: '合作模式', desc: '了解可以合作那些模式，各模式的优势和区别', action: '查看合作模式' },
              { title: '招商标准', desc: '查询自身行业所需要提交的资质', action: '查看招商标准' },
              { title: '我要入驻', desc: '我已了解所有内容，需要立即入驻', action: '立即入驻' },
            ].map((item) => (
              <div key={item.title} style={{ ...cardStyle, textAlign: 'center' }}>
                <h3 style={{ margin: 0, fontSize: 18 }}>{item.title}</h3>
                <p style={{ color: '#646566', fontSize: 14, minHeight: 40 }}>{item.desc}</p>
                <a href="#join-intro-apply" style={{ display: 'inline-block', padding: '8px 16px', border: '1px solid #a9781b', borderRadius: 4, color: '#a9781b', textDecoration: 'none' }}>{item.action}</a>
              </div>
            ))}
          </div>
        </section>

        {/* 合作模式：平台模式 / 自营模式 */}
        <section className="join-intro__mode" style={{ padding: 24, borderTop: '1px solid #f0f0f0' }}>
          <h2 style={h2Style}>{t('合作模式')}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            {['平台模式', '自营模式'].map((mode) => (
              <div key={mode} style={cardStyle}>
                <h3 style={{ margin: 0, fontSize: 18 }}>{mode}</h3>
                <p style={{ color: '#646566', fontSize: 14, margin: '12px 0 0' }}>{t('了解详情')}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 入驻流程步骤条（对照 step.vue 的 stepList1 / stepList2） */}
        <section className="join-intro__process" style={{ padding: 24, borderTop: '1px solid #f0f0f0' }}>
          <h2 style={h2Style}>{t('入驻流程')}</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {stepLabels.map((label, index) => (
              <div key={label} style={{ flex: 1, minWidth: 140, textAlign: 'center', padding: '12px 8px', fontSize: 14, background: index === 0 ? '#a9781b' : '#f7f7f7', color: index === 0 ? '#fff' : '#333' }}>{label}</div>
            ))}
          </div>
        </section>

        {/* introTable：1 选择主体类型和经营类目 + 2 按照以下清单准备材料 */}
        <section className="join-intro__table" style={{ padding: 24, borderTop: '1px solid #f0f0f0' }}>
          <div style={{ ...cardStyle, marginBottom: 16 }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 20 }}>{t('1. 选择主体类型和经营类目')}</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <span style={{ minWidth: 64, color: '#646566' }}>{t('主体类型')}</span>
              {[{ value: 1, label: '个人' }, { value: 2, label: '企业' }, { value: 3, label: '个体工商户' }].map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => setSubjectType(item.value)}
                  style={{ minWidth: 100, height: 40, border: `1px solid ${subjectType === item.value ? '#a9781b' : '#ebedf0'}`, background: subjectType === item.value ? '#fbeede' : '#fff', color: subjectType === item.value ? '#a9781b' : '#323233', cursor: 'pointer', borderRadius: 2 }}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p style={{ background: '#f7f8fa', padding: 16, color: '#646566', fontSize: 14, lineHeight: 1.6 }}>{subjectDesc}</p>
          </div>
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 16px', fontSize: 20 }}>{t('2. 按照以下清单准备材料')}</h3>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: '#f7f7f7' }}>
                  <th style={{ border: '1px solid #ebedf0', padding: '12px 16px', textAlign: 'left' }}>{t('认证材料')}</th>
                  <th style={{ border: '1px solid #ebedf0', padding: '12px 16px', textAlign: 'left' }}>{t('详细描述（复印件需加盖公司公章）')}</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ border: '1px solid #ebedf0', padding: '12px 16px', verticalAlign: 'top', fontSize: 14 }}>{t('主体资质')}</td>
                  <td style={{ border: '1px solid #ebedf0', padding: '12px 16px', fontSize: 14, lineHeight: 1.8 }}>
                    <div>{isBusiness ? t('统一社会信用代码证') : '法定代表人证件照正反面照片'}</div>
                    <div>{isBusiness ? t('法人证件照正反面照片、法人手持证件照') : '法定代表人证件照正反面照片'}</div>
                    {subjectType === 2 ? <div>开户许可证/基本存款账户照片</div> : null}
                    <p style={{ margin: '8px 0 0', color: '#646566' }}>{t('· 证件包含：身份证、护照、来往内地通行证、外国人居留证等有效证件。')}</p>
                    <p style={{ margin: 0, color: '#646566' }}>{t('· 其中护照需要增加翻译件，加盖公司鲜章，外籍商家姓名需为中文（英文），如张三（Zhangsan）。')}</p>
                    <p style={{ margin: 0, color: '#646566' }}>{t('· 照片标准：四角完整，清晰可辨。若加水印需保证照片重要信息清晰可辨。')}</p>
                    <p style={{ margin: 0, color: '#646566' }}>{t('· 法人证件非大陆身份证（如护照等）时，需要提供法人证明函。')}</p>
                    <p style={{ margin: 0, color: '#646566' }}>· 注意：证件盖章不支持电子章，图片信息不得标有其他平台专用的水印/印章。</p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 协议勾选 + 协议弹窗触发入口 + 开始入驻 */}
        <section id="join-intro-apply" className="join-intro__apply" style={{ padding: 24, borderTop: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>{t('我已同意')}</span>
            <button type="button" onClick={() => void openAgreement()} style={{ border: 'none', background: 'none', color: '#a9781b', cursor: 'pointer', padding: 0, fontSize: 14 }}>{t('《商户入驻协议》')}</button>
          </label>
          <Button theme="solid" type="primary" size="large" onClick={startApplying}>{t('材料准备就绪，开始入驻申请')}</Button>
        </section>

        <Modal
          title={t('商户入驻协议')}
          visible={agreementVisible}
          onCancel={() => setAgreementVisible(false)}
          footer={<Button onClick={() => setAgreementVisible(false)}>{t('关闭')}</Button>}
        >
          <div style={{ maxHeight: 400, overflow: 'auto', whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 14 }}>
            {agreementLoading ? t('协议加载中...') : agreementContent}
          </div>
        </Modal>
      </div>
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
          <div className="join-section-title">{t('主体类型')}</div>
          <div className="cert-options">
            {SUBJECT_TYPES.map((item) => (
              <button key={item.value} type="button" className={form.type === item.value ? 'is-active' : ''} onClick={() => update('type', item.value)}>
                {item.label}
              </button>
            ))}
          </div>

          <div className="join-section-title">{isIndividual ? t('个人信息') : '法定代表人信息'}</div>
          <label>{t('证件类型')}</label>
          <select value={form.documentType} onChange={(event) => update('documentType', event.target.value)}>
            <option value="">{t('请选择证件类型')}</option>
            <option value="1">{t('身份证')}</option>
            <option value="2">{t('护照')}</option>
          </select>
          {form.documentType === '2' ? (
            <p className="join-field-tip">{t('护照需要增加翻译件，加盖公司鲜章，外籍商家姓名需为中文（英文），如张三（Zhangsan）。')}</p>
          ) : null}

          <label>{isIndividual ? t('姓名') : '法定代表人姓名'}</label>
          <input value={form.corporateName} onChange={(event) => update('corporateName', event.target.value)} placeholder={t('填写中文名（英文名），如“张三（Zhang San）”')} />

          <label>{t('证件号码')}</label>
          <input value={form.documentNumber} onChange={(event) => update('documentNumber', event.target.value)} placeholder={t('请输入证件号码')} />

          {isIndividual ? (
            <>
              <label>{t('出生日期')}</label>
              <input type="date" value={form.birthday} onChange={(event) => update('birthday', event.target.value)} />
              <label>{t('性别')}</label>
              <div className="cert-options">
                <button type="button" className={form.sex === 1 ? 'is-active' : ''} onClick={() => update('sex', 1)}>{t('男')}</button>
                <button type="button" className={form.sex === 2 ? 'is-active' : ''} onClick={() => update('sex', 2)}>{t('女')}</button>
              </div>
              <label>{t('居住地址')}</label>
              <input value={form.residentialAddress} onChange={(event) => update('residentialAddress', event.target.value)} placeholder={t('请输入居住地址')} />
            </>
          ) : null}

          <label>{t('证件有效期')}</label>
          <div className="cert-options">
            <button type="button" className={form.certificateValidityPeriod === 1 ? 'is-active' : ''} onClick={() => update('certificateValidityPeriod', 1)}>{t('长期有效')}</button>
            <button type="button" className={form.certificateValidityPeriod === 2 ? 'is-active' : ''} onClick={() => update('certificateValidityPeriod', 2)}>{t('区间有效')}</button>
          </div>
          <div className="cert-range">
            <input type="date" value={form.certificateValidityPeriodDate} disabled={form.certificateValidityPeriod !== 2} onChange={(event) => update('certificateValidityPeriodDate', event.target.value)} />
            <span>{t('至')}</span>
            <input type="date" value={form.certificateValidityPeriodEnd} disabled={form.certificateValidityPeriod !== 2} onChange={(event) => update('certificateValidityPeriodEnd', event.target.value)} />
          </div>

          <PicUploader label="证件照（人像面）" tip="如你的证件类型是身份证，请在此处上传人像面，若为复印件，需加盖公司鲜章。注意：证件盖章不支持电子章。" value={form.frontOfPhoto} onChange={(list) => update('frontOfPhoto', list)} />
          <PicUploader label="证件照（国徽面）" tip="如你的证件类型是身份证，请在此处上传国徽面，若为复印件，需加盖公司鲜章。注意：证件盖章不支持电子章。" value={form.backOfPhoto} onChange={(list) => update('backOfPhoto', list)} />
        </div>
      ) : null}

      {step === 2 ? (
        <div className="security-form">
          <div className="join-section-title">{t('联系人信息')}</div>
          <label>{t('联系人姓名')}</label>
          <input value={form.contactName} onChange={(event) => update('contactName', event.target.value)} placeholder={t('请填写联系人姓名')} />
          <label>{t('联系电话')}</label>
          <input value={form.contactPhone} onChange={(event) => update('contactPhone', event.target.value)} placeholder={t('请填写联系电话')} />
          <label>{t('联系邮箱')}</label>
          <input value={form.contactEmail} onChange={(event) => update('contactEmail', event.target.value)} placeholder={t('请输入联系邮箱（选填）')} />

          <div className="join-section-title">{t('结算账户信息')}</div>
          <label>{t('开户银行')}</label>
          <input value={form.bankDeposit} onChange={(event) => update('bankDeposit', event.target.value)} placeholder={t('请输入开户银行')} />
          <label>{t('开户支行')}</label>
          <input value={form.bankBranch} onChange={(event) => update('bankBranch', event.target.value)} placeholder={t('请输入开户支行')} />
          <label>{t('银行卡号')}</label>
          <input value={form.bankCard} onChange={(event) => update('bankCard', event.target.value)} placeholder={t('请输入银行卡号')} />
          <PicUploader label="开户许可证" value={form.accountOpeningPermit} onChange={(list) => update('accountOpeningPermit', list)} />

          <div className="join-section-title">{t('商户信息')}</div>
          <label>{t('商户名称')}</label>
          <input value={form.merchantName} onChange={(event) => update('merchantName', event.target.value)} placeholder={t('该名称将在微信支付、支付宝支付时向买家展示')} />
          <label>{t('经营地址')}</label>
          <input value={form.detailedAddress} onChange={(event) => update('detailedAddress', event.target.value)} placeholder={t('请填写详细的经营场所地址，如有多个场所，选择一个主要场所填写即可')} />
          <label>{t('客服电话')}</label>
          <input value={form.customerServicePhone} onChange={(event) => update('customerServicePhone', event.target.value)} placeholder={t('请注意填写格式，举例（座机：0755-88880000；手机：13688880000）')} />
          <PicUploader label="营业执照照片" tip="必须为彩色图片（文档请截图后上传），最多5张，单张小于2M。" value={form.businessLicenseImg} onChange={(list) => update('businessLicenseImg', list)} />

          <div className="join-section-title">{t('补充信息')}</div>
          <PicUploader label="补充材料" tip="在整个申请流程中，遇到需提供资料但无上传入口的情况，都可在此处上传。" value={form.supplementaryInformation} onChange={(list) => update('supplementaryInformation', list)} />
        </div>
      ) : null}

      {step === 3 ? (
        <div className="security-form">
          {isEnterprise ? (
            <>
              <div className="join-section-title">{t('企业信息')}</div>
              <label>{t('企业名称')}</label>
              <input value={form.companyName} onChange={(event) => update('companyName', event.target.value)} placeholder={t('请输入企业名称')} />
              <label>{t('统一社会信用代码')}</label>
              <input value={form.businessLicenseId} onChange={(event) => update('businessLicenseId', event.target.value)} placeholder={t('请输入营业执照上18位统一社会信用代码')} />
              <label>{t('注册地址')}</label>
              <input value={form.businessLicenseAddress} onChange={(event) => update('businessLicenseAddress', event.target.value)} placeholder={t('注册地址需与营业执照登记住所一致')} />
              <label>{t('经营范围')}</label>
              <input value={form.businessScope} onChange={(event) => update('businessScope', event.target.value)} placeholder={t('与企业工商营业执照上一致')} />
              <label>{t('营业期限')}</label>
              <div className="cert-options">
                <button type="button" className={form.operatingTermType === 1 ? 'is-active' : ''} onClick={() => update('operatingTermType', 1)}>{t('长期')}</button>
                <button type="button" className={form.operatingTermType === 2 ? 'is-active' : ''} onClick={() => update('operatingTermType', 2)}>{t('区间有效')}</button>
              </div>
              <div className="cert-range">
                <input type="date" value={form.operatingTermTypeDate} disabled={form.operatingTermType !== 2} onChange={(event) => update('operatingTermTypeDate', event.target.value)} />
                <span>{t('至')}</span>
                <input type="date" value={form.operatingTermTypeEnd} disabled={form.operatingTermType !== 2} onChange={(event) => update('operatingTermTypeEnd', event.target.value)} />
              </div>
            </>
          ) : (
            <>
              <div className="join-section-title">{t('基本信息')}</div>
              <div className="join-summary-row"><span>{t('主体类型')}</span><b>{SUBJECT_TYPES.find((item) => item.value === form.type)?.label}</b></div>
              <div className="join-summary-row"><span>{t('姓名')}</span><b>{form.corporateName || '-'}</b></div>
              <div className="join-summary-row"><span>{t('证件号码')}</span><b>{form.documentNumber || '-'}</b></div>
              <div className="join-summary-row"><span>{t('联系人')}</span><b>{form.contactName || '-'} {form.contactPhone}</b></div>
              <div className="join-summary-row"><span>{t('商户名称')}</span><b>{form.merchantName || '-'}</b></div>
              <div className="join-summary-row"><span>{t('经营地址')}</span><b>{form.detailedAddress || '-'}</b></div>
            </>
          )}

          <label className="register-agree">
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} />
            <span>{t('我已同意《商户入驻协议》')}</span>
          </label>
        </div>
      ) : null}

      <div className="join-actions">
        {step > 1 ? <Button onClick={() => setStep((current) => Math.max(1, current - 1))}>{t('上一步')}</Button> : null}
        {step < 3 ? (
          <Button theme="solid" type="primary" onClick={next}>{t('下一步')}</Button>
        ) : (
          <Button theme="solid" type="primary" loading={submitting} onClick={() => void submit()}>{t('提交')}</Button>
        )}
      </div>
    </Card>
  );
}

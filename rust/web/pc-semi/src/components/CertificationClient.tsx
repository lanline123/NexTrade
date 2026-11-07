'use client';

/**
 * 会员实名认证（对照旧版 `member/usercertification/Info.vue` + `src/step.vue`）。
 *
 * 旧版能力：展示当前认证状态 / 审核驳回原因，支持个人与企业两类资质提交；
 * 后端接口（本仓库 Rust）：
 * - `GET  /api/user/company/detail`  最新一条认证（object|null）
 * - `GET  /api/user/company/myApply` 我的申请列表（array）
 * - `POST /api/user/company/apply`   提交/重新提交申请
 *
 * 状态（UserCompany）：0 待审核 / 1 审核通过 / 2 审核未通过。
 */
import { useEffect, useState } from 'react';
import { Button, Card, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
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
  /** 证件有效期：1 长期 / 2 指定区间（源码 certificateValidityPeriod） */
  certificateValidityPeriod?: number | string;
  certificateValidityPeriodDate?: string;
  certificateValidityPeriodEnd?: string;
  /** 证件照（源码 frontOfPhoto / backOfPhoto） */
  frontOfPhoto?: Array<Record<string, unknown>>;
  backOfPhoto?: Array<Record<string, unknown>>;
  /** 营业执照图片与经营期限（源码 businessLicenseImg / operatingTermType） */
  businessLicenseImg?: Array<Record<string, unknown>>;
  licenseAddrProvince?: string;
  operatingTermType?: number | string;
  operatingTermTypeDate?: string;
  operatingTermTypeEnd?: string;
}

interface ApplyState {
  id?: number;
  status?: number;
  auditRemark?: string;
  type?: number;
  companyData?: CompanyData;
  [key: string]: unknown;
}

const STATUS_TEXT: Record<number, string> = { 0: '待审核', 1: '审核通过', 2: '审核未通过' };

/** 证件/营业执照图片上传（源码 form/src/UploadImage.vue，走 /api/user/user/uploadImg） */
function CertImageUpload({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: Array<Record<string, unknown>>;
  onChange: (list: Array<Record<string, unknown>>) => void;
}) {
  const list = Array.isArray(value) ? value : [];
  const [uploading, setUploading] = useState(false);

  const upload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      Toast.error({ content: '只能上传 2M 以内的图片' });
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
    <div className="cert-upload">
      <span className="cert-upload__label">{label}</span>
      {list.map((item, index) => (
        <span key={index} className="cert-upload__thumb">
          <img src={String(item.picThumb || item.picUrl || '')} alt={label} />
          <button type="button" onClick={() => onChange(list.filter((_, i) => i !== index))}>×</button>
        </span>
      ))}
      <label className="cert-upload__pick">
        {uploading ? '上传中...' : '+ 上传'}
        <input
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = '';
          }}
        />
      </label>
    </div>
  );
}

/** 旧接口 `myApply` 返回数组；`detail` 返回单对象，统一归一为最新一条。 */
function normalizeApply(input: unknown): ApplyState | null {
  if (Array.isArray(input)) {
    const list = input as ApplyState[];
    return list.length ? list[0] : null;
  }
  if (input && typeof input === 'object') {
    const data = input as ApplyState;
    return data.companyData || data.status !== undefined ? data : null;
  }
  return null;
}

export default function CertificationClient() {
    const { t } = useTranslation();
  const [state, setState] = useState<ApplyState | null>(null);
  const [form, setForm] = useState<ApplyState>({ type: 1, companyData: {} });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      // 旧版优先 detail，detail 为空时回退 myApply 列表（兼容后端仅返回列表的部署）。
      let data: ApplyState | null = null;
      try {
        data = normalizeApply(await apiGet('user/company/detail'));
      } catch {
        data = null;
      }
      if (!data) {
        try {
          data = normalizeApply(await apiGet('user/company/myApply'));
        } catch {
          data = null;
        }
      }
      setState(data);
      setForm({
        type: Number(data?.type) || 1,
        companyData: { ...(data?.companyData || {}) },
      });
      setEditing(!data || Number(data.status) === 2);
    } catch {
      setEditing(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
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
      // 后端 apply DTO：type / contactName / contactMobile / companyName / companyData，
      // 其中 companyName 为顶层必填；contactName 取证件姓名、contactMobile 取联系人手机。
      await apiPost('user/company/apply', {
        type: Number(form.type) || 1,
        contactName: data.corporateName,
        contactMobile: data.contactPhone,
        companyName: data.companyName || data.corporateName,
        companyData: data,
      });
      Toast.success({ content: '提交成功，等待审核' });
      await load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '提交失败' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Card className="member-card">{t('加载中...')}</Card>;
  const status = Number(state?.status ?? 0);
  const hasRecord = Boolean(state);
  /** 分步指示（对照旧版 step.vue）：1 资料填写 / 2 审核及公示。 */
  const currentStep = !hasRecord || editing || status === 0 ? 1 : 2;

  return (
    <Card className="member-card certification-card">
      <div className="cert-steps" style={{ display: 'flex', marginBottom: 16 }}>
        {['1. 资料填写', '2. 审核及公示'].map((label, index) => (
          <div
            key={label}
            style={{
              flex: 1,
              textAlign: 'center',
              padding: '12px 10px',
              fontSize: 14,
              background: currentStep === index + 1 ? '#a9781b' : '#f5f6fa',
              color: currentStep === index + 1 ? '#fff' : '#333',
            }}
          >
            {label}
          </div>
        ))}
      </div>
      <div className={`cert-status cert-status--${status}`}>{hasRecord ? STATUS_TEXT[status] || t('待审核') : '未申请'}</div>
      {status === 2 && state?.auditRemark ? <div className="cert-error">审核未通过原因：{state.auditRemark}</div> : null}

      {!editing && state?.companyData?.corporateName ? (
        <div className="cert-readonly">
          <h3 className="cert-readonly__title">
            {status === 1 ? t('恭喜您，您的申请审核通过') : status === 2 ? t('很遗憾，您的申请审核未通过') : '申请已受理，我们将在 3 个工作日内完成审核'}
          </h3>
          <div className="cert-readonly__sub">{t('基本信息 · 以下为本次申请内容：')}</div>
          <div><label>{t('认证类型')}</label><span>{Number(state.type) === 1 ? t('个人') : '企业'}</span></div>
          <div><label>{t('证件类型')}</label><span>{state.companyData.documentType || '-'}</span></div>
          <div><label>{Number(state.type) === 1 ? t('姓名') : '法定代表人姓名'}</label><span>{state.companyData.corporateName}</span></div>
          <div><label>{t('证件号码')}</label><span>{state.companyData.documentNumber}</span></div>
          <div><label>{t('联系人手机')}</label><span>{state.companyData.contactPhone}</span></div>
          <div><label>{t('出生日期')}</label><span>{state.companyData.birthday || '-'}</span></div>
          <div><label>{t('证件有效期')}</label><span>{Number(state.companyData.certificateValidityPeriod) === 1 ? t('长期有效') : t('{a} 至 {b}', { a: state.companyData.certificateValidityPeriodDate || '-', b: state.companyData.certificateValidityPeriodEnd || '-' })}</span></div>
          {Number(state.type) === 2 ? (
            <>
              <div><label>{t('企业名称')}</label><span>{state.companyData.companyName || '-'}</span></div>
              <div><label>{t('统一社会信用代码')}</label><span>{state.companyData.businessLicenseId || '-'}</span></div>
              <div><label>{t('注册地址')}</label><span>{state.companyData.businessLicenseAddress || '-'}</span></div>
            </>
          ) : null}
          <div><label>{t('备注')}</label><span>{state.auditRemark || '-'}</span></div>
          {status === 2 ? <Button onClick={() => setEditing(true)}>{t('重新申请')}</Button> : null}
        </div>
      ) : (
        <div className="security-form cert-form">
          {status === 0 ? <div className="cert-tip">{t('认证资料审核中，如需修改请等待审核结果。')}</div> : null}
          <label>{t('认证类型')}</label>
          <div className="cert-options">
            <button type="button" className={Number(form.type) === 1 ? 'is-active' : ''} onClick={() => setForm({ ...form, type: 1 })}>{t('个人')}</button>
            <button type="button" className={Number(form.type) === 2 ? 'is-active' : ''} onClick={() => setForm({ ...form, type: 2 })}>{t('企业')}</button>
          </div>
          <div className="cert-section">{Number(form.type) === 1 ? t('个人信息') : '法定代表人信息'}</div>
          <label>{t('证件类型')}</label>
          <select value={form.companyData?.documentType || ''} onChange={(event) => update('documentType', event.target.value)}>
            <option value="">{t('请选择证件类型')}</option>
            <option value="1">{t('大陆身份证')}</option>
            <option value="2">{t('护照（限境外人士）')}</option>
            <option value="3">{t('来往内地通行证（中国香港居民）')}</option>
            <option value="4">{t('来往内地通行证（中国澳门居民）')}</option>
            <option value="5">{t('来往大陆通行证（中国台湾居民）')}</option>
          </select>
          <label>{Number(form.type) === 1 ? t('姓名') : '法定代表人姓名'}</label>
          <input value={form.companyData?.corporateName || ''} onChange={(event) => update('corporateName', event.target.value)} placeholder={t('填写中文名（英文名），如“张三（Zhang San）”')} />
          <label>{t('证件号码')}</label>
          <input
            value={form.companyData?.documentNumber || ''}
            onChange={(event) => {
              const value = event.target.value;
              setForm((current) => {
                const companyData: CompanyData = { ...(current.companyData || {}), documentNumber: value };
                // 大陆身份证自动识别出生日期（对照旧版 Info.vue 的证件号监听）
                if (String(companyData.documentType) === '1' && value.length >= 18 && !companyData.birthday) {
                  const part = value.slice(6, 14);
                  companyData.birthday = `${part.slice(0, 4)}-${part.slice(4, 6)}-${part.slice(6, 8)}`;
                }
                return { ...current, companyData };
              });
            }}
            placeholder={t('请输入证件号码')}
          />
          <label>{t('联系人手机')}</label>
          <input value={form.companyData?.contactPhone || ''} onChange={(event) => update('contactPhone', event.target.value)} placeholder={t('请输入联系人手机')} />
          <label>{t('出生日期')}</label>
          <input type="date" value={form.companyData?.birthday || ''} onChange={(event) => update('birthday', event.target.value)} placeholder={t('请选择出生日期')} />
          {Number(form.type) === 1 ? (
            <>
              <label>{t('居住地址')}</label>
              <input value={form.companyData?.residentialAddress || ''} onChange={(event) => update('residentialAddress', event.target.value)} placeholder={t('请输入居住地址')} />
              <label>{t('证件有效期')}</label>
              <div className="cert-options">
                <button
                  type="button"
                  className={Number(form.companyData?.certificateValidityPeriod) === 1 ? 'is-active' : ''}
                  onClick={() => setForm((current) => ({ ...current, companyData: { ...(current.companyData || {}), certificateValidityPeriod: 1 } }))}
                >{t('长期有效')}</button>
                <button
                  type="button"
                  className={Number(form.companyData?.certificateValidityPeriod) === 2 ? 'is-active' : ''}
                  onClick={() => setForm((current) => ({ ...current, companyData: { ...(current.companyData || {}), certificateValidityPeriod: 2 } }))}
                >{t('区间有效')}</button>
              </div>
              <label>{t('证件有效期')}</label>
              <div className="cert-range">
                <input
                  type="date"
                  value={form.companyData?.certificateValidityPeriodDate || ''}
                  disabled={Number(form.companyData?.certificateValidityPeriod) !== 2}
                  onChange={(event) => update('certificateValidityPeriodDate', event.target.value)}
                />
                <span>{t('至')}</span>
                <input
                  type="date"
                  value={form.companyData?.certificateValidityPeriodEnd || ''}
                  disabled={Number(form.companyData?.certificateValidityPeriod) !== 2}
                  onChange={(event) => update('certificateValidityPeriodEnd', event.target.value)}
                />
              </div>
              <label>{Number(form.type) === 1 ? t('个人证件照') : '法定代表人证件照'}</label>
              <p className="cert-field-tip">{t('必须为彩色图片且小于2M，若为复印件，需加盖公司红章。')}</p>
              <div className="cert-uploads">
                <CertImageUpload label="证件照（人像面）" value={form.companyData?.frontOfPhoto} onChange={(list) => setForm((current) => ({ ...current, companyData: { ...(current.companyData || {}), frontOfPhoto: list } }))} />
                <CertImageUpload label="证件照（国徽面）" value={form.companyData?.backOfPhoto} onChange={(list) => setForm((current) => ({ ...current, companyData: { ...(current.companyData || {}), backOfPhoto: list } }))} />
              </div>
            </>
          ) : (
            <>
              <div className="cert-section">{t('企业信息')}</div>
              <label>{t('企业名称')}</label>
              <input value={form.companyData?.companyName || ''} onChange={(event) => update('companyName', event.target.value)} placeholder={t('请输入企业名称')} />
              <label>{t('统一社会信用代码')}</label>
              <input value={form.companyData?.businessLicenseId || ''} onChange={(event) => update('businessLicenseId', event.target.value)} placeholder={t('请输入营业执照上18位统一社会信用代码')} />
              <label>{t('注册地址')}</label>
              <input value={form.companyData?.businessLicenseAddress || ''} onChange={(event) => update('businessLicenseAddress', event.target.value)} placeholder={t('注册地址需与营业执照登记住所一致')} />
              <label>{t('经营范围')}</label>
              <input value={form.companyData?.businessScope || ''} onChange={(event) => update('businessScope', event.target.value)} placeholder={t('请输入经营范围')} />
              <label>{t('经营期限')}</label>
              <div className="cert-options">
                <button
                  type="button"
                  className={Number(form.companyData?.operatingTermType) === 1 ? 'is-active' : ''}
                  onClick={() => setForm((current) => ({ ...current, companyData: { ...(current.companyData || {}), operatingTermType: 1 } }))}
                >{t('长期')}</button>
                <button
                  type="button"
                  className={Number(form.companyData?.operatingTermType) === 2 ? 'is-active' : ''}
                  onClick={() => setForm((current) => ({ ...current, companyData: { ...(current.companyData || {}), operatingTermType: 2 } }))}
                >{t('区间有效')}</button>
              </div>
              <label>{t('营业期限')}</label>
              <div className="cert-range">
                <input
                  type="date"
                  value={form.companyData?.operatingTermTypeDate || ''}
                  disabled={Number(form.companyData?.operatingTermType) !== 2}
                  onChange={(event) => update('operatingTermTypeDate', event.target.value)}
                />
                <span>{t('至')}</span>
                <input
                  type="date"
                  value={form.companyData?.operatingTermTypeEnd || ''}
                  disabled={Number(form.companyData?.operatingTermType) !== 2}
                  onChange={(event) => update('operatingTermTypeEnd', event.target.value)}
                />
              </div>
              <label>{t('营业执照图片')}</label>
              <div className="cert-uploads">
                <CertImageUpload label="营业执照" value={form.companyData?.businessLicenseImg} onChange={(list) => setForm((current) => ({ ...current, companyData: { ...(current.companyData || {}), businessLicenseImg: list } }))} />
              </div>
            </>
          )}
          <Button theme="solid" type="primary" loading={saving} onClick={() => void submit()}>{t('提交认证')}</Button>
        </div>
      )}
    </Card>
  );
}

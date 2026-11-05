import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Dropdown,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Select,
  SideSheet,
  Space,
  Spin,
  Table,
  Tag,
  TextArea,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { IconPlus, IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost, apiUpload, getToken } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';
import ImageUploader from '../components/ImageUploader';

type Translate = (key: string, params?: Record<string, string | number>) => string;

interface Row extends Record<string, any> {
  id?: number;
}

function Simple({
  api,
  rowKey = 'id',
  label,
  columns,
}: {
  api: string;
  rowKey?: string;
  label: string;
  columns: ColumnConfig<Row>[];
}) {
  return (
    <ListPage<Row>
      api={api}
      rowKey={rowKey}
      pageSize={10}
      filters={[
        { field: 'keyword', label, type: 'input', placeholder: `输入${label}`, width: 240 },
      ]}
      columns={columns}
    />
  );
}

export function DepositRules() {
  return (
    <Simple
      api="/deposit/rule/list"
      rowKey="shopDepositRuleId"
      label="规则名称"
      columns={[
        { title: '规则名称', dataIndex: 'ruleName' },
        { title: '保证金金额', dataIndex: 'depositAmount', width: 130 },
        { title: '规则状态', dataIndex: 'statusText', width: 120 },
        { title: '创建时间', dataIndex: 'createTime', width: 180 },
      ]}
    />
  );
}

export function DepositAccounts() {
  return (
    <Simple
      api="/deposit/payeeAccount/list"
      label="账户名称"
      columns={[
        { title: '账户名称', dataIndex: 'accountName' },
        { title: '账号', dataIndex: 'accountNo' },
        { title: '账户类型', dataIndex: 'accountTypeText', width: 130 },
        { title: '创建时间', dataIndex: 'createTime', width: 180 },
      ]}
    />
  );
}

export function DepositQuery() {
  return (
    <Simple
      api="/deposit/account/list"
      rowKey="shopId"
      label="组织名称"
      columns={[
        { title: '组织名称', dataIndex: 'shopName' },
        { title: '应缴金额', dataIndex: 'shouldAmount', width: 130 },
        { title: '已缴金额', dataIndex: 'paidAmount', width: 130 },
        { title: '剩余待缴', dataIndex: 'remainingAmount', width: 130 },
        { title: '保证金状态', dataIndex: 'statusText', width: 130 },
      ]}
    />
  );
}

export function DepositAudit() {
  const { t } = useI18n();
  const [mainTab, setMainTab] = useState<'refund' | 'recharge'>('refund');
  const [detail, setDetail] = useState<Row | null>(null);
  const [auditTarget, setAuditTarget] = useState<Row | null>(null);
  const [auditPass, setAuditPass] = useState(true);
  const [auditRemark, setAuditRemark] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const isRefund = mainTab === 'refund';

  const rowId = (record: Row) => Number(isRefund ? record.shopDepositRefundId : record.shopDepositRechargeId);

  const openDetail = async (record: Row) => {
    try {
      const result = await apiGet<Row>(`/deposit/${mainTab}/detail`, { id: rowId(record) });
      setDetail(result);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('详情加载失败') });
    }
  };

  const submitAudit = async () => {
    if (!auditTarget) return;
    try {
      const payload: Record<string, unknown> = {
        id: rowId(auditTarget),
        pass: auditPass,
        auditRemark: auditRemark.trim(),
      };
      if (isRefund && auditPass) payload.payVoucher = '';
      await apiPost(`/deposit/${mainTab}/audit`, payload);
      Toast.success({ content: t('审核完成') });
      setAuditTarget(null);
      setAuditRemark('');
      setReloadKey((key) => key + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('审核失败') });
    }
  };

  const columns: ColumnConfig<Row>[] = isRefund
    ? [
        { title: '组织名称', dataIndex: 'shopName', render: (_: any, row: Row) => row.shopName || row.ownerName || '--' },
        { title: '主体类型', dataIndex: 'subjectTypeText', width: 110 },
        { title: '退还类型', dataIndex: 'typeText', width: 110 },
        { title: '申请金额', dataIndex: 'amount', width: 130, render: (val: any) => `¥${Number(val || 0).toFixed(2)}` },
        { title: '审核状态', dataIndex: 'statusText', width: 110 },
        { title: '申请时间', dataIndex: 'addTimeText', width: 170 },
      ]
    : [
        { title: '组织名称', dataIndex: 'shopName', render: (_: any, row: Row) => row.shopName || row.ownerName || '--' },
        { title: '主体类型', dataIndex: 'subjectTypeText', width: 110 },
        { title: '交易金额', dataIndex: 'amount', width: 130, render: (val: any) => `¥${Number(val || 0).toFixed(2)}` },
        { title: '收款账户', dataIndex: 'payeeAccount', width: 200, render: (_: any, row: Row) => row.payeeAccountNo || row.accountNo || '--' },
        { title: '支付方式', dataIndex: 'payeeAccountTypeText', width: 110 },
        { title: '审核状态', dataIndex: 'statusText', width: 110 },
        { title: '交易备注', dataIndex: 'remark', width: 140, render: (val: any) => val || '--' },
        { title: '提交时间', dataIndex: 'addTimeText', width: 170 },
        { title: '关联凭证', dataIndex: 'payVoucher', width: 110, render: (val: any) => (val ? <Tag color="green">{t('已上传')}</Tag> : '--') },
      ];

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <Button theme={isRefund ? 'solid' : 'light'} type="primary" onClick={() => { setMainTab('refund'); setReloadKey((k) => k + 1); }}>
          {t('退还审核')}
        </Button>
        <Button theme={isRefund ? 'light' : 'solid'} type="primary" onClick={() => { setMainTab('recharge'); setReloadKey((k) => k + 1); }}>
          {t('充值审核')}
        </Button>
      </div>
      <ListPage<Row>
        key={`${mainTab}-${reloadKey}`}
        api={`/deposit/${mainTab}/list`}
        rowKey={(row) => String(rowId(row))}
        pageSize={10}
        columns={columns}
        filters={[
          { field: 'keyword', label: t('组织名称'), type: 'input', width: 220 },
          { field: 'ownerType', label: t('组织类型'), type: 'select', options: [{ label: t('店铺'), value: 'shop' }, { label: t('供应商'), value: 'supplier' }] },
          { field: 'subjectType', label: t('主体类型'), type: 'select', options: [{ label: t('个人'), value: 1 }, { label: t('企业'), value: 2 }] },
          isRefund
            ? { field: 'type', label: t('退还类型'), type: 'select', options: [{ label: t('部分退还'), value: 1 }, { label: t('全额退还'), value: 2 }] }
            : { field: 'payeeAccountType', label: t('支付方式'), type: 'select', options: [{ label: t('银行卡'), value: 1 }, { label: t('支付宝'), value: 2 }, { label: t('微信'), value: 3 }] },
          { field: 'status', label: t('审核状态'), type: 'select', options: [{ label: t('待审核'), value: 0 }, { label: t('审核通过'), value: 1 }, { label: t('审核驳回'), value: 2 }] },
        ]}
        rowActions={(record: Row) => (
          <Space spacing={2}>
            <Button theme="borderless" type="primary" size="small" onClick={() => void openDetail(record)}>
              {t('详细')}
            </Button>
            {Number(record.status) === 0 ? (
              <Button theme="borderless" type="warning" size="small" onClick={() => { setAuditTarget(record); setAuditPass(true); setAuditRemark(''); }}>
                {isRefund ? t('退还审核') : t('充值审核')}
              </Button>
            ) : null}
          </Space>
        )}
      />

      <Modal title={isRefund ? t('退还详情') : t('充值详情')} visible={!!detail} footer={null} onCancel={() => setDetail(null)} width={640}>
        {detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {Object.entries(detail)
              .filter(([key, value]) => value !== undefined && value !== null && value !== '' && !key.endsWith('Id') && typeof value !== 'object')
              .slice(0, 20)
              .map(([key, value]) => (
                <div key={key} style={{ display: 'flex', gap: 16 }}>
                  <span style={{ width: 180, color: '#8a919f' }}>{key}</span>
                  <span>{String(value)}</span>
                </div>
              ))}
          </div>
        ) : null}
      </Modal>

      <Modal
        title={isRefund ? t('退还审核') : t('充值审核')}
        visible={!!auditTarget}
        onCancel={() => setAuditTarget(null)}
        onOk={() => void submitAudit()}
        okText={t('提交审核')}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>{t('组织名称')}：{auditTarget?.shopName || auditTarget?.ownerName || '--'}</div>
          <div>{t('交易金额')}：¥{Number(auditTarget?.amount || 0).toFixed(2)}</div>
          <div style={{ display: 'flex', gap: 16 }}>
            <label><input type="radio" checked={auditPass} onChange={() => setAuditPass(true)} /> {t('审核通过')}</label>
            <label><input type="radio" checked={!auditPass} onChange={() => setAuditPass(false)} /> {t('审核驳回')}</label>
          </div>
          <TextArea value={auditRemark} onChange={setAuditRemark} placeholder={t('审核备注')} rows={3} />
        </div>
      </Modal>
    </div>
  );
}

export function DepositLogs() {
  return (
    <Simple
      api="/deposit/log/list"
      rowKey="shopDepositLogId"
      label="组织名称"
      columns={[
        { title: '组织名称', dataIndex: 'shopName' },
        { title: '交易类型', dataIndex: 'typeText', width: 130 },
        { title: '交易金额', dataIndex: 'amount', width: 130 },
        { title: '交易时间', dataIndex: 'addTimeText', width: 170 },
      ]}
    />
  );
}

export function CategoryFeeRules() {
  return (
    <Simple
      api="/finance/categoryFeeRule/list"
      label="费率名称"
      columns={[
        { title: '费率名称', dataIndex: 'ruleName' },
        { title: '适用类目', dataIndex: 'categoryCount', width: 130 },
        { title: '服务费率', dataIndex: 'serviceFeeRate', width: 130 },
        { title: '规则状态', dataIndex: 'statusText', width: 120 },
      ]}
    />
  );
}

/* ==================================================================
   进件管理（微信支付特约商户进件审核流）
   对应原版 5.8.61 view/admin/src/views/finance/merchantApplication/*：
   ManageList / SubmitForm / DetailForm / RejectForm / ApplicationActions /
   MediaField / WechatBankSelect / applicationRules / onboardingForm / bankPagination
================================================================== */

interface MerchantApplicationItem {
  id?: number | string;
  shopId?: number | string;
  shopName?: string;
  /** 申请主体类型：SHOP 店铺 / VENDOR 供应商 */
  applicantType?: string;
  applicantId?: number | string;
  applicantName?: string;
  payChannel?: string;
  businessCode?: string;
  applymentId?: string;
  status?: string;
  statusDesc?: string;
  abandoned?: number;
  abandonReason?: string;
  abandonTime?: string;
  sourceApplicationId?: number | string;
  retryable?: boolean;
  rejectReason?: string;
  auditTime?: string;
  reasonLabel?: string;
  subMchId?: string;
  signUrl?: string;
  merchantName?: string;
  contactName?: string;
  contactPhone?: string;
  createTime?: string;
  modifyTime?: string;
  organizationType?: string;
  businessLicenseNumber?: string;
  legalPerson?: string;
  licensePeriodBegin?: string;
  licensePeriodEnd?: string;
  idCardName?: string;
  idCardNumber?: string;
  cardPeriodBegin?: string;
  cardPeriodEnd?: string;
  merchantShortName?: string;
  servicePhone?: string;
  storeUrl?: string;
  settlementId?: string;
  qualificationType?: string;
  bankAccountType?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranchName?: string;
  bankBranchId?: string;
  contactType?: string;
  contactIdNumber?: string;
  contactEmail?: string;
  licenseCopy?: string;
  idCardCopy?: string;
  idCardNational?: string;
  requestSnapshot?: string | null;
}

interface ApplicationForm {
  owner?: boolean;
  shopId?: number | string;
  payChannel?: string;
  organizationType?: string;
  merchantName?: string;
  merchantShortName?: string;
  businessLicenseNumber?: string;
  legalPerson?: string;
  licensePeriodBegin?: string;
  licensePeriodEnd?: string;
  licenseCopy?: string;
  idCardName?: string;
  idCardNumber?: string;
  cardPeriodBegin?: string;
  cardPeriodEnd?: string;
  servicePhone?: string;
  storeUrl?: string;
  settlementId?: string;
  qualificationType?: string;
  bankAccountType?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankBranchName?: string;
  bankBranchId?: string;
  contactType?: string;
  contactName?: string;
  contactIdNumber?: string;
  contactPhone?: string;
  contactEmail?: string;
  [key: string]: unknown;
}

type ApplicationReapplyForm = { sourceApplicationId: number | string; abandonReason: string } & Partial<ApplicationForm>;

interface MerchantApplicationListResult {
  records?: MerchantApplicationItem[];
  total?: number;
  current?: number;
  size?: number;
  pages?: number;
}

interface WechatBankPage<T> {
  totalCount: number;
  count?: number;
  offset?: number;
  data: T[];
}
interface WechatBank { bankAlias: string; bankAliasCode: string; accountBank: string; needBankBranch: boolean; }
interface WechatBankBranch { bankBranchName: string; bankBranchId: string; bankAliasCode?: string; accountBank?: string; }
interface WechatBankProvince { provinceName: string; provinceCode: string; }
interface WechatBankCity { cityName: string; cityCode: string; }

const LONG_TERM_VALUE = '长期';
const ORG_ENTERPRISE = '2';
const ORG_INDIVIDUAL = '4';
const ORG_PERSONAL = '2401';
const BANK_CORPORATE = '74';
const BANK_PERSONAL = '75';
const CONTACT_LEGAL = '65';
const PAY_CHANNEL_WECHAT = 'WECHAT';
/** 渠道处理中状态（SUBMITTED 之后、FINISH/REJECTED 之前）。 */
const PROCESSING_STATUSES = ['SUBMITTED', 'CHECKING', 'AUDITING', 'ACCOUNT_NEED_VERIFY', 'NEED_SIGN'];
const APPLICATION_FIELDS = [
  'shopId', 'payChannel', 'organizationType', 'owner', 'merchantName', 'merchantShortName',
  'businessLicenseNumber', 'legalPerson', 'licensePeriodBegin', 'licensePeriodEnd', 'licenseCopy',
  'idCardName', 'idCardNumber', 'idCardCopy', 'idCardNational', 'cardPeriodBegin', 'cardPeriodEnd',
  'servicePhone', 'storeUrl', 'settlementId', 'qualificationType', 'bankAccountType',
  'bankAccountName', 'bankAccountNumber', 'bankName', 'bankBranchName', 'bankBranchId',
  'contactType', 'contactName', 'contactIdNumber', 'contactPhone', 'contactEmail',
] as const;
const MEDIA_FIELDS = ['licenseCopy', 'idCardCopy', 'idCardNational'] as const;
type MediaKey = (typeof MEDIA_FIELDS)[number];
const PERSONAL_OMIT_KEYS = ['businessLicenseNumber', 'legalPerson', 'licensePeriodBegin', 'licensePeriodEnd', 'licenseCopy'];
const OPTIONAL_OMIT_IF_EMPTY = ['contactEmail', 'servicePhone', 'settlementId', 'qualificationType', 'bankBranchName'];

const STATUS_OPTIONS = [
  { label: '草稿', value: 'DRAFT' },
  { label: '待审核', value: 'PENDING_REVIEW' },
  { label: '已放弃（本地）', value: 'ABANDONED' },
  { label: '已提交', value: 'SUBMITTED' },
  { label: '审核中', value: 'CHECKING' },
  { label: '复审中', value: 'AUDITING' },
  { label: '待验证', value: 'ACCOUNT_NEED_VERIFY' },
  { label: '待签约', value: 'NEED_SIGN' },
  { label: '已完成', value: 'FINISH' },
  { label: '已驳回', value: 'REJECTED' },
];
const STATUS_LABELS: Record<string, string> = Object.fromEntries(STATUS_OPTIONS.map((item) => [item.value, item.label]));
const statusLabelText = (code: string | undefined, t: Translate) => {
  const label = STATUS_LABELS[code || ''];
  return label ? t(label) : '';
};
const STATUS_TAG_COLOR: Record<string, 'grey' | 'orange' | 'blue' | 'green' | 'red'> = {
  DRAFT: 'grey',
  PENDING_REVIEW: 'orange',
  SUBMITTED: 'blue',
  CHECKING: 'blue',
  AUDITING: 'blue',
  ACCOUNT_NEED_VERIFY: 'orange',
  NEED_SIGN: 'orange',
  FINISH: 'green',
  REJECTED: 'red',
  ABANDONED: 'grey',
};
const PAY_CHANNEL_LABELS: Record<string, string> = { WECHAT: '微信', ALIPAY: '支付宝', HUIFU: '汇付天下' };

const formatPayChannel = (value: string | undefined, t: Translate) => t(PAY_CHANNEL_LABELS[value || ''] || value || '微信');
const formatOrganizationType = (value: string | undefined, t: Translate) =>
  (value === ORG_ENTERPRISE ? t('企业') : value === ORG_INDIVIDUAL ? t('个体工商户') : value === ORG_PERSONAL ? t('个人') : '-');
const formatBankAccountType = (value: string | undefined, t: Translate) => (value === BANK_CORPORATE ? t('对公') : value === BANK_PERSONAL ? t('对私') : value || '-');
const formatContactType = (value: string | undefined, t: Translate) => (value === CONTACT_LEGAL ? t('经营者/法人') : value === '66' ? t('经办人') : value || '-');

const isPersonalOrg = (type?: string) => type === ORG_PERSONAL;
const isClosedApplication = (row: MerchantApplicationItem) => row.status === 'FINISH' || !!row.subMchId?.trim();
const isAbandoned = (row: MerchantApplicationItem) => row.abandoned === 1;
const canEditApplication = (row: MerchantApplicationItem, platform: boolean) =>
  !isClosedApplication(row) &&
  !isAbandoned(row) &&
  !row.retryable &&
  (platform
    ? row.applicantType === 'SHOP' && ['DRAFT', 'REJECTED'].includes(row.status || '')
    : ['DRAFT', 'REJECTED', 'PENDING_REVIEW'].includes(row.status || ''));
const canSignApplication = (row: MerchantApplicationItem) =>
  !isAbandoned(row) && row.status === 'NEED_SIGN' && /^https?:\/\//i.test(row.signUrl || '');

/** 本后台无 authList 明细权限模型：平台管理员视为持有全部进件权限。 */
function isPlatformAdmin(): boolean {
  const adminType = localStorage.getItem('adminType') || 'admin';
  return adminType === 'admin';
}

interface ApplicationActionFlags {
  edit: boolean;
  retry: boolean;
  abandon: boolean;
  reapply: boolean;
  delete: boolean;
  approve: boolean;
  reject: boolean;
  refresh: boolean;
}

/** 原版 applicationRules.ts applicationActions()（平台端口径）。 */
function applicationActions(row: MerchantApplicationItem): ApplicationActionFlags {
  const has = (_permission: string) => isPlatformAdmin();
  const closed = isClosedApplication(row);
  const abandoned = isAbandoned(row);
  const lifecycle = row.payChannel === PAY_CHANNEL_WECHAT && !closed;
  const known =
    ['DRAFT', 'REJECTED', 'PENDING_REVIEW'].includes(row.status || '') ||
    (PROCESSING_STATUSES.includes(row.status || '') && !!row.applymentId);
  const mutable = lifecycle && !row.retryable && known;
  return {
    edit: has('merchantApplicationSubmit') && canEditApplication(row, true),
    retry:
      has('merchantApplicationReapply') &&
      lifecycle &&
      !abandoned &&
      row.retryable === true &&
      ['DRAFT', 'PENDING_REVIEW', ...PROCESSING_STATUSES].includes(row.status || ''),
    abandon: has('merchantApplicationAbandon') && mutable && !abandoned,
    reapply: has('merchantApplicationReapply') && lifecycle && (abandoned || mutable),
    delete: has('merchantApplicationDelete') && lifecycle && (abandoned || (!row.retryable && ['DRAFT', 'REJECTED'].includes(row.status || ''))),
    approve: has('merchantApplicationApprove') && !closed && !abandoned && !row.retryable && row.status === 'PENDING_REVIEW',
    reject: has('merchantApplicationReject') && !closed && !abandoned && !row.retryable && row.status === 'PENDING_REVIEW',
    refresh: has('merchantApplicationRefresh') && !closed && !abandoned && !!row.applymentId && PROCESSING_STATUSES.includes(row.status || ''),
  };
}

const isHttpStoreUrl = (value: unknown) => {
  try {
    const url = new URL(String(value ?? '').trim());
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname && !/\s/.test(String(value));
  } catch {
    return false;
  }
};
const isDuplicateIdCardPhotos = (copy: unknown, national: unknown) => {
  const front = String(copy ?? '').trim();
  const back = String(national ?? '').trim();
  return !!front && !!back && front === back;
};

function syncPersonalDerivedFields(form: ApplicationForm) {
  if (!isPersonalOrg(form.organizationType)) return;
  const name = form.idCardName || '';
  form.bankAccountType = BANK_PERSONAL;
  form.contactType = CONTACT_LEGAL;
  form.bankAccountName = name;
  form.contactName = name;
  form.contactIdNumber = form.idCardNumber || '';
}

function clearPersonalLicenseFields(form: ApplicationForm) {
  PERSONAL_OMIT_KEYS.forEach((key) => {
    (form as Record<string, unknown>)[key] = '';
  });
}

/** 按主体类型收口银行账户、超管类型；个人还要清空执照字段。 */
function applyOrganizationConstraints(form: ApplicationForm) {
  if (form.organizationType === ORG_ENTERPRISE) form.bankAccountType = BANK_CORPORATE;
  if (isPersonalOrg(form.organizationType)) {
    clearPersonalLicenseFields(form);
    syncPersonalDerivedFields(form);
  }
  return form;
}

function pickApplicationFields(form: ApplicationForm): ApplicationForm {
  const next: Record<string, unknown> = {};
  APPLICATION_FIELDS.forEach((key) => {
    const value = (form as Record<string, unknown>)[key];
    if (value !== undefined && value !== null) next[key] = value;
  });
  return next as ApplicationForm;
}

function parseApplicationSnapshot(raw: unknown): ApplicationForm | null {
  if (typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return pickApplicationFields(parsed as ApplicationForm);
  } catch {
    return null;
  }
}

function buildMerchantApplicationPayload(form: ApplicationForm): Record<string, unknown> {
  const next: Record<string, unknown> = { ...pickApplicationFields(form) };
  applyOrganizationConstraints(next as ApplicationForm);
  if (isPersonalOrg(String(next.organizationType ?? ''))) {
    PERSONAL_OMIT_KEYS.forEach((key) => {
      delete next[key];
    });
  }
  OPTIONAL_OMIT_IF_EMPTY.forEach((key) => {
    const value = next[key];
    if (value === undefined || value === null || String(value).trim() === '') delete next[key];
  });
  return next;
}

function buildReapplyPayload(
  sourceApplicationId: number | string,
  abandonReason: string,
  current: ApplicationForm,
  initial: ApplicationForm,
  changedMedia: MediaKey[],
): ApplicationReapplyForm {
  const changes: Record<string, unknown> = {};
  APPLICATION_FIELDS.forEach((key) => {
    if (['shopId', 'payChannel', 'organizationType'].includes(key)) return;
    if ((MEDIA_FIELDS as readonly string[]).includes(key) && !changedMedia.includes(key as MediaKey)) return;
    const currentValue = (current as Record<string, unknown>)[key];
    const initialValue = (initial as Record<string, unknown>)[key];
    if (currentValue !== undefined && currentValue !== null && currentValue !== initialValue) changes[key] = currentValue;
  });
  const numericId = Number(sourceApplicationId);
  return {
    ...changes,
    sourceApplicationId: Number.isFinite(numericId) && String(numericId) === String(sourceApplicationId) ? numericId : sourceApplicationId,
    abandonReason: abandonReason.trim(),
  } as ApplicationReapplyForm;
}

// ——————————————————————————————————————————————
// 接口（路径与原版 api/finance/merchantApplication.ts 一致）
// ——————————————————————————————————————————————

/** 库表主键统一转数字（Java Jackson 与 Rust serde 均按数值反序列化）。 */
const toId = (id: number | string | undefined): number | string => {
  const raw = String(id ?? '').trim();
  return /^\d+$/.test(raw) ? Number(raw) : (id ?? '');
};

const listApplications = (params: Record<string, unknown>) =>
  apiGet<MerchantApplicationListResult>('/finance/merchantApplication/list', params);
const getApplicationDetail = (id: number | string) =>
  apiGet<MerchantApplicationItem>('/finance/merchantApplication/detail', { id });
const submitApplication = (payload: Record<string, unknown>) =>
  apiPost<MerchantApplicationItem>('/finance/merchantApplication/submit', payload);
const reapplyApplication = (payload: ApplicationReapplyForm) =>
  apiPost<MerchantApplicationItem>('/finance/merchantApplication/reapply', payload);
const approveApplication = (id: number | string) => apiPost<null>('/finance/merchantApplication/approve', { id: toId(id) });
const rejectApplication = (id: number | string, rejectReason: string) =>
  apiPost<null>('/finance/merchantApplication/reject', { id: toId(id), rejectReason });
const abandonApplication = (id: number | string, abandonReason: string) =>
  apiPost<null>('/finance/merchantApplication/abandon', { id: toId(id), abandonReason });
const retryApplication = (id: number | string) => apiPost<MerchantApplicationItem>('/finance/merchantApplication/retry', { id: toId(id) });
const deleteApplicationRecord = (id: number | string) => apiPost<null>('/finance/merchantApplication/delete', { id: toId(id) });
/** 原版契约：POST refresh + query 参数（Java @RequestParam；Rust 侧同样以 Query 读取）。 */
const refreshApplication = (id: number | string) =>
  apiPost<null>(`/finance/merchantApplication/refresh?id=${encodeURIComponent(String(toId(id)))}`);

const uploadApplicationMedia = (file: File) =>
  apiUpload<{ mediaId?: string }>('/finance/merchantApplication/uploadMedia', file, { payChannel: PAY_CHANNEL_WECHAT });

/** 证件原件为渠道媒体二进制；非图片响应（含后端业务错误）转为异常。 */
async function fetchApplicationMedia(id: number | string, role: number): Promise<Blob> {
  const res = await fetch(`/adminapi/finance/merchantApplication/media?id=${encodeURIComponent(String(id))}&role=${role}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  const blob = await res.blob();
  if (!blob.type.startsWith('image/')) {
    let message = '';
    try {
      const parsed = JSON.parse(await blob.text()) as { msg?: string };
      message = parsed.msg || '';
    } catch {
      /* 非图片响应不一定可解析为 JSON */
    }
    throw new Error(message || 'MEDIA_UNAVAILABLE');
  }
  return blob;
}

const asArray = <T,>(result: unknown): T[] =>
  (Array.isArray(result) ? (result as T[]) : ((result as { data?: T[] })?.data ?? []));

async function fetchWechatBanks(params: { accountType: string; offset: number; limit: number; keyword?: string }): Promise<WechatBankPage<WechatBank>> {
  const result = await apiGet<unknown>('/finance/merchantApplication/wechatBanks', params);
  const data = asArray<WechatBank>(result);
  const totalCount = Array.isArray(result) ? data.length : Number((result as { totalCount?: number })?.totalCount ?? 0);
  return { totalCount, count: data.length, offset: params.offset, data };
}
const fetchWechatBankProvinces = () => apiGet<unknown>('/finance/merchantApplication/wechatBankProvinces');
const fetchWechatBankCities = (provinceCode: string) => apiGet<unknown>('/finance/merchantApplication/wechatBankCities', { provinceCode });
async function fetchWechatBankBranches(params: { bankAliasCode: string; cityCode: string; offset: number; limit: number }): Promise<WechatBankPage<WechatBankBranch>> {
  const result = await apiGet<unknown>('/finance/merchantApplication/wechatBankBranches', params);
  const data = asArray<WechatBankBranch>(result);
  const totalCount = Array.isArray(result) ? data.length : Number((result as { totalCount?: number })?.totalCount ?? 0);
  return { totalCount, count: data.length, offset: params.offset, data };
}

/** 原版 bankPagination.ts：支行接口按 offset/limit 分页，循环拉取全量。 */
async function loadAllBankPages<T>(
  fetchPage: (offset: number) => Promise<WechatBankPage<T>>,
  isCurrent: () => boolean = () => true,
): Promise<T[] | null> {
  const rows: T[] = [];
  let total = Infinity;
  while (rows.length < total) {
    const page = await fetchPage(rows.length);
    if (!isCurrent()) return null;
    if (!Array.isArray(page.data) || !Number.isFinite(page.totalCount) || page.totalCount < 0 || (page.data.length === 0 && rows.length < page.totalCount)) {
      throw new Error('INCOMPLETE_BANK_DATA');
    }
    total = page.totalCount;
    rows.push(...page.data);
  }
  return rows;
}

// ——————————————————————————————————————————————
// 商户入驻资料 → 进件表单映射（原版 mapProfileToApplication.ts）
// ——————————————————————————————————————————————

const usableString = (value: unknown): string => {
  if (value === undefined || value === null) return '';
  const str = String(value).trim();
  if (!str || str.includes('*')) return '';
  return str;
};
const firstOf = (...values: unknown[]): string => {
  for (const value of values) {
    const str = usableString(value);
    if (str) return str;
  }
  return '';
};
const toDateString = (value: unknown): string => {
  const str = usableString(value);
  if (!str) return '';
  return str.replace(/[./]/g, '-').slice(0, 10);
};
const pickPhotoUrl = (value: unknown): string => {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed.includes('*')) return '';
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try {
        return pickPhotoUrl(JSON.parse(trimmed));
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  if (Array.isArray(value)) return pickPhotoUrl(value[0]);
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return usableString(record.picUrl ?? record.url);
  }
  return '';
};
const resolveTerm = (type: unknown, range: unknown, longTermStart: unknown) => {
  const dates = Array.isArray(range) ? range : [];
  if (Number(type) === 1) return { begin: toDateString(dates[0]), end: toDateString(dates[1]) };
  return { begin: toDateString(longTermStart) || toDateString(dates[0]), end: LONG_TERM_VALUE };
};
const compactForm = (form: ApplicationForm): ApplicationForm => {
  const next: Record<string, unknown> = {};
  Object.entries(form).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    next[key] = value;
  });
  return next as ApplicationForm;
};

/** 店铺/门店：把商户入驻资料映射为进件表单可回填字段。 */
function mapMerchantProfileToApplication(profile: Record<string, unknown> | null | undefined): ApplicationForm {
  if (!profile) return {};
  const base = (profile.baseData || {}) as Record<string, unknown>;
  const merchant = (profile.merchantData || {}) as Record<string, unknown>;
  const shop = (profile.shopData || {}) as Record<string, unknown>;
  const merchantVo = (profile.merchant || {}) as Record<string, unknown>;
  const type = profile.type ?? base.type ?? merchantVo.type;
  const organizationType = Number(type) === 2 ? ORG_ENTERPRISE : ORG_INDIVIDUAL;
  const legalPerson = firstOf(base.corporateName, profile.corporateName, merchant.corporateName, merchantVo.corporateName);
  const merchantName = firstOf(merchant.merchantName, merchantVo.merchantName, profile.companyName, base.companyName, profile.shopTitle);
  const license = resolveTerm(base.operatingTermType, base.operatingTermTypeDate, base.operatingTermTypeEnd);
  const card = resolveTerm(base.certificateValidityPeriod, base.certificateValidityPeriodDate, base.certificateValidityPeriodEnd);
  const idCardNumber = Number(base.documentType) === 1 || base.documentType == null ? firstOf(base.documentNumber) : '';
  const contactName = firstOf(merchant.contactName, merchantVo.contactName, legalPerson);
  const contactIsLegal = !contactName || contactName === legalPerson;
  return compactForm({
    organizationType,
    businessLicenseNumber: firstOf(base.businessLicenseId),
    merchantName,
    legalPerson,
    licensePeriodBegin: license.begin,
    licensePeriodEnd: license.end,
    licenseCopy: pickPhotoUrl(merchant.businessLicenseImg || merchant.businessLicenseImgTemp || merchantVo.businessLicenseImg),
    idCardName: firstOf(base.corporateName, legalPerson),
    idCardNumber,
    cardPeriodBegin: card.begin,
    cardPeriodEnd: card.end,
    idCardCopy: pickPhotoUrl(base.frontOfPhoto || base.frontOfPhotoTemp),
    idCardNational: pickPhotoUrl(base.backOfPhoto || base.backOfPhotoTemp),
    merchantShortName: firstOf(profile.shopTitle, shop.shopTitle, merchant.merchantName, merchantName),
    servicePhone: firstOf(
      merchant.customerServicePhone,
      profile.shopContactPhone,
      shop.contactMobile,
      shop.customerServicePhone,
      merchant.contactPhone,
      profile.contactMobile,
      profile.kefuPhone,
    ),
    bankAccountType: organizationType === ORG_ENTERPRISE ? BANK_CORPORATE : BANK_PERSONAL,
    bankAccountName:
      organizationType === ORG_ENTERPRISE
        ? firstOf(base.companyName, profile.companyName, merchantName, legalPerson)
        : firstOf(legalPerson, merchant.contactName, merchantVo.contactName),
    bankAccountNumber: firstOf(merchant.bankCard, merchantVo.bankCard),
    bankName: firstOf(merchant.bankDeposit, merchantVo.bankDeposit),
    bankBranchName: firstOf(merchant.bankBranch, merchantVo.bankBranch),
    contactType: CONTACT_LEGAL,
    contactName,
    contactIdNumber: contactIsLegal ? idCardNumber : '',
    contactPhone: firstOf(merchant.contactPhone, profile.shopContactPhone),
    contactEmail: firstOf(merchant.contactEmail),
  });
}

// ——————————————————————————————————————————————
// 通用小组件
// ——————————————————————————————————————————————

const MaSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <div style={{ marginBottom: 26 }}>
    <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600, background: 'var(--semi-color-fill-0)', padding: '10px 12px', marginBottom: 18 }}>
      <span style={{ width: 3, height: 14, background: 'var(--semi-color-primary)', marginRight: 8 }} />
      {title}
    </div>
    {children}
  </div>
);

const MaItem = ({ label, required, error, children, labelWidth = 200 }: { label: ReactNode; required?: boolean; error?: string; children: ReactNode; labelWidth?: number }) => (
  <div style={{ display: 'flex', marginBottom: 18 }}>
    <label style={{ width: labelWidth, flexShrink: 0, textAlign: 'right', paddingRight: 12, fontSize: 14, lineHeight: '32px', color: 'var(--semi-color-text-0)' }}>
      {required ? <span style={{ color: 'var(--semi-color-danger)', marginRight: 2 }}>*</span> : null}
      {label}
    </label>
    <div style={{ flex: 1, minWidth: 0 }}>
      {children}
      {error ? <div style={{ color: 'var(--semi-color-danger)', fontSize: 12, marginTop: 4 }}>{error}</div> : null}
    </div>
  </div>
);

const MaDesc = ({ label, children, labelWidth = 150 }: { label: ReactNode; children: ReactNode; labelWidth?: number }) => (
  <div style={{ display: 'flex', marginBottom: 14 }}>
    <span style={{ width: labelWidth, flexShrink: 0, textAlign: 'right', paddingRight: 12, fontSize: 14, lineHeight: '22px', color: 'var(--semi-color-text-1)' }}>{label}</span>
    <span style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: '22px', wordBreak: 'break-all', color: 'var(--semi-color-text-0)' }}>{children}</span>
  </div>
);

interface RemoteOption { label: string; value: string; }

/** 远程搜索单选（店铺/供应商选择）：300ms 防抖 + 首次展开自动加载。 */
function RemoteSelect({ fetchOptions, value, onChange, placeholder, width = 220, disabled }: {
  fetchOptions: (keyword: string) => Promise<RemoteOption[]>;
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  width?: number;
  disabled?: boolean;
}) {
  const [options, setOptions] = useState<RemoteOption[]>([]);
  const [loading, setLoading] = useState(false);
  const seqRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const load = useCallback(async (keyword: string) => {
    const seq = ++seqRef.current;
    setLoading(true);
    try {
      const next = await fetchOptions(keyword);
      if (seq === seqRef.current) setOptions(next);
    } catch {
      if (seq === seqRef.current) setOptions([]);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [fetchOptions]);

  useEffect(() => {
    void load('');
    return () => {
      seqRef.current += 1;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [load]);

  const onSearch = (keyword: string) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      timerRef.current = undefined;
      void load(keyword.trim());
    }, 300);
  };

  return (
    <Select
      filter
      remote
      showClear
      disabled={disabled}
      placeholder={placeholder}
      style={{ width }}
      optionList={options}
      loading={loading}
      onSearch={onSearch}
      value={value || undefined}
      onChange={(next) => onChange(String(next ?? ''))}
    />
  );
}

/** 证件媒体字段（原版 MediaField.vue）：微信渠道按 role 预览渠道原件并上传 mediaId。 */
function CertificateMediaField({ applicationId, role, readonly, disabled, value, onChange, onBusyChange }: {
  applicationId?: number | string;
  role: number;
  readonly?: boolean;
  disabled?: boolean;
  value?: string;
  onChange?: (mediaId: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const { t } = useI18n();
  const [preview, setPreview] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const previewUrlRef = useRef('');
  const generationRef = useRef(0);

  const replacePreview = useCallback((blob?: Blob | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = blob ? URL.createObjectURL(blob) : '';
    setPreview(previewUrlRef.current);
  }, []);

  const loadPreview = useCallback(async () => {
    const seq = ++generationRef.current;
    replacePreview(null);
    setError('');
    if (!applicationId) return;
    setLoading(true);
    try {
      const blob = await fetchApplicationMedia(applicationId, role);
      if (seq === generationRef.current) replacePreview(blob);
    } catch {
      if (seq === generationRef.current) setError(t('证件预览加载失败，请重试或重新上传'));
    } finally {
      if (seq === generationRef.current) setLoading(false);
    }
  }, [applicationId, role, replacePreview]);

  // 与原版一致：仅在挂载 / applicationId / role 变化时拉取渠道原件预览
  useEffect(() => {
    void loadPreview();
    return () => {
      generationRef.current += 1;
    };
  }, [loadPreview]);

  useEffect(() => () => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
  }, []);

  const handleUpload = async (file?: File) => {
    if (!file || uploading) return;
    const valid =
      /\.(jpe?g|png|bmp)$/i.test(file.name) &&
      ['image/jpeg', 'image/png', 'image/bmp', 'image/x-ms-bmp'].includes(file.type) &&
      file.size <= 5 * 1024 * 1024;
    if (!valid) {
      const message = t('请上传不超过 5 MiB 的 JPG、JPEG、PNG 或 BMP 图片');
      setError(message);
      Toast.error({ content: message });
      if (inputRef.current) inputRef.current.value = '';
      return;
    }
    const seq = ++generationRef.current;
    setUploading(true);
    setLoading(false);
    onBusyChange?.(true);
    try {
      const result = await uploadApplicationMedia(file);
      if (seq !== generationRef.current) return;
      if (!result?.mediaId) throw new Error(t('证件上传失败，请重试'));
      replacePreview(file);
      setError('');
      onChange?.(result.mediaId);
    } catch (uploadError) {
      if (seq === generationRef.current) {
        const message = uploadError instanceof Error && uploadError.message ? uploadError.message : t('证件上传失败，请重试');
        setError(message);
        Toast.error({ content: message });
      }
    } finally {
      setUploading(false);
      onBusyChange?.(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div>
      {loading ? (
        <Spin size="small" />
      ) : preview ? (
        <img
          src={preview}
          alt={t('证件')}
          style={{ width: 160, height: 100, objectFit: 'contain', border: '1px solid var(--semi-color-border)', borderRadius: 4, display: 'block', cursor: 'pointer' }}
          onClick={() => window.open(preview, '_blank')}
        />
      ) : error ? (
        <div>
          <Typography.Text type="danger" size="small">
            {error}
          </Typography.Text>
          <Button theme="borderless" type="primary" size="small" onClick={() => void loadPreview()}>
            {t('刷新')}
          </Button>
        </div>
      ) : (
        <Typography.Text type="tertiary" size="small">
          {t('暂无证件预览')}
        </Typography.Text>
      )}
      {!readonly && (
        <div style={{ marginTop: 8 }}>
          <input ref={inputRef} type="file" accept=".jpg,.jpeg,.png,.bmp" hidden onChange={(event) => void handleUpload(event.target.files?.[0])} />
          <Button size="small" loading={uploading} disabled={disabled || uploading} onClick={() => inputRef.current?.click()}>
            {t('上传证件')}
          </Button>
          <Typography.Text type="tertiary" size="small" style={{ display: 'block', marginTop: 4 }}>
            {t('支持 JPG、JPEG、PNG、BMP，单张不超过 5 MiB')}
          </Typography.Text>
        </div>
      )}
    </div>
  );
}

// ——————————————————————————————————————————————
// 微信支行四级联动（原版 WechatBankSelect.vue）：开户银行 → 省 → 市 → 支行
// ——————————————————————————————————————————————

type BankQueryStage = 'banks' | 'provinces' | 'cities' | 'branches';
const HISTORICAL_BANK = '__historical_bank__';
const BANK_PAGE_SIZE = 20;
const BANK_BRANCH_PAGE_SIZE = 100;

const stageFailureText = (stage: BankQueryStage, t: Translate) => {
  if (stage === 'provinces') return t('银行省份加载失败，请重试');
  if (stage === 'cities') return t('银行城市加载失败，请重试');
  if (stage === 'branches') return t('开户支行加载失败，请重试');
  return t('银行列表加载失败，请重试');
};

interface WechatBankFieldsHandle {
  validate: () => void;
}

const WechatBankFields = forwardRef<WechatBankFieldsHandle, {
  value: ApplicationForm;
  onChange: (patch: Partial<ApplicationForm>) => void;
  disabled?: boolean;
  allowHistorical?: boolean;
}>(function WechatBankFields({ value: model, onChange, disabled, allowHistorical }, ref) {
  const { t } = useI18n();
  const [banks, setBanks] = useState<WechatBank[]>([]);
  const [provinces, setProvinces] = useState<WechatBankProvince[]>([]);
  const [cities, setCities] = useState<WechatBankCity[]>([]);
  const [branches, setBranches] = useState<WechatBankBranch[]>([]);
  const [bankCode, setBankCode] = useState('');
  const [provinceCode, setProvinceCode] = useState('');
  const [cityCode, setCityCode] = useState('');
  const [selectedBank, setSelectedBank] = useState<WechatBank>();
  const [bankLoading, setBankLoading] = useState(false);
  const [stageLoading, setStageLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<BankQueryStage>('banks');
  const [failedStage, setFailedStage] = useState<BankQueryStage | ''>('');
  const [stageError, setStageError] = useState('');
  const [bankKeyword, setBankKeyword] = useState('');

  const stateRef = useRef({ bankCode: '', provinceCode: '', cityCode: '' });
  const bankLoadedRef = useRef(false);
  const bankSeqRef = useRef(0);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const bankKeywordRef = useRef('');
  const seqRef = useRef(0);
  const branchCacheRef = useRef(new Map<string, WechatBankBranch[]>());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const clearBranch = useCallback(() => {
    onChangeRef.current({ bankBranchName: '', bankBranchId: '' });
    setBranches([]);
  }, []);

  const cancelBankSearch = useCallback(() => {
    if (searchTimerRef.current) {
      clearTimeout(searchTimerRef.current);
      searchTimerRef.current = undefined;
    }
    bankSeqRef.current += 1;
    setBankLoading(false);
  }, []);

  const loadBanksNow = useCallback(async (keyword: string, accountType: string) => {
    const seq = ++bankSeqRef.current;
    setBankLoading(true);
    try {
      const page = await fetchWechatBanks({
        accountType: accountType || BANK_CORPORATE,
        offset: 0,
        limit: BANK_PAGE_SIZE,
        ...(keyword ? { keyword } : {}),
      });
      if (seq !== bankSeqRef.current) return;
      if (!Array.isArray(page.data) || !Number.isFinite(page.totalCount) || page.totalCount < 0 || (!page.data.length && page.totalCount > 0)) {
        throw new Error('INCOMPLETE_BANK_DATA');
      }
      setBanks(page.data.map((bank) => ({ ...bank, bankAliasCode: String(bank.bankAliasCode) })));
      bankLoadedRef.current = true;
      if (seq === bankSeqRef.current && failedStage === 'banks') setFailedStage('');
    } catch {
      if (seq === bankSeqRef.current) setFailedStage('banks');
    } finally {
      if (seq === bankSeqRef.current) setBankLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [failedStage]);

  const runStage = useCallback((stage: BankQueryStage, work: (seq: number) => Promise<void>) => {
    const seq = ++seqRef.current;
    setStageLoading(true);
    setLoadingStage(stage);
    setFailedStage('');
    setStageError('');
    void (async () => {
      try {
        await work(seq);
      } catch (stageException) {
        if (seq === seqRef.current) {
          setFailedStage(stage);
          const detail = stageException instanceof Error ? stageException.message.trim() : '';
          const meaningless = !detail || detail === 'null' || detail === 'undefined';
          const message = detail === 'INCOMPLETE_BANK_DATA' ? t('银行数据加载不完整，请重新查询') : meaningless ? stageFailureText(stage, t) : detail;
          setStageError(message);
          Toast.error({ content: message });
        }
      } finally {
        if (seq === seqRef.current) setStageLoading(false);
      }
    })();
  }, []);

  const loadProvincesData = useCallback(async (seq: number) => {
    const result = await fetchWechatBankProvinces();
    if (seq !== seqRef.current) return;
    setProvinces(asArray<WechatBankProvince>(result));
  }, []);

  const loadCitiesData = useCallback(async (seq: number) => {
    const province = stateRef.current.provinceCode;
    if (!province) return;
    const result = await fetchWechatBankCities(province);
    if (seq !== seqRef.current) return;
    setCities(asArray<WechatBankCity>(result));
  }, []);

  const loadBranchesData = useCallback(async (seq: number) => {
    const bank = stateRef.current.bankCode;
    const city = stateRef.current.cityCode;
    if (!bank || !city) return;
    const key = `${bank}:${city}`;
    const cached = branchCacheRef.current.get(key);
    const data =
      cached ||
      (await loadAllBankPages(
        (offset) => fetchWechatBankBranches({ bankAliasCode: bank, cityCode: city, offset, limit: BANK_BRANCH_PAGE_SIZE }),
        () => seq === seqRef.current,
      ));
    if (!data || seq !== seqRef.current) return;
    const normalized = data.map((branch) => ({ ...branch, bankBranchId: String(branch.bankBranchId) }));
    branchCacheRef.current.set(key, normalized);
    setBranches(normalized);
  }, []);

  const changeBank = useCallback((next: string) => {
    const hit = banks.find((bank) => bank.bankAliasCode === next) || (selectedBank?.bankAliasCode === next ? selectedBank : undefined);
    setBankCode(next);
    stateRef.current.bankCode = next;
    setSelectedBank(hit);
    setProvinceCode('');
    stateRef.current.provinceCode = '';
    setCityCode('');
    stateRef.current.cityCode = '';
    setCities([]);
    setBranches([]);
    onChangeRef.current({ bankName: hit?.accountBank || '', bankBranchName: '', bankBranchId: '' });
    if (hit?.needBankBranch) runStage('provinces', loadProvincesData);
    else {
      seqRef.current += 1;
      setStageLoading(false);
      setFailedStage('');
      setStageError('');
    }
  }, [banks, selectedBank, runStage, loadProvincesData]);

  const changeProvince = useCallback((next: string) => {
    setProvinceCode(next);
    stateRef.current.provinceCode = next;
    setCityCode('');
    stateRef.current.cityCode = '';
    setCities([]);
    setBranches([]);
    onChangeRef.current({ bankBranchName: '', bankBranchId: '' });
    runStage('cities', loadCitiesData);
  }, [runStage, loadCitiesData]);

  const changeCity = useCallback((next: string) => {
    setCityCode(next);
    stateRef.current.cityCode = next;
    setBranches([]);
    onChangeRef.current({ bankBranchName: '', bankBranchId: '' });
    runStage('branches', loadBranchesData);
  }, [runStage, loadBranchesData]);

  const chooseBranch = useCallback((next: string) => {
    const branch = branches.find((item) => item.bankBranchId === String(next));
    if (!branch || !selectedBank) {
      onChangeRef.current({ bankBranchName: '', bankBranchId: '' });
      return;
    }
    onChangeRef.current({ bankName: selectedBank.accountBank, bankBranchName: branch.bankBranchName, bankBranchId: branch.bankBranchId });
  }, [branches, selectedBank]);

  const searchBanks = useCallback((keyword: string) => {
    const next = keyword.trim();
    if (next === bankKeywordRef.current && bankLoadedRef.current) return;
    cancelBankSearch();
    bankKeywordRef.current = next;
    setBankKeyword(next);
    setBanks([]);
    bankLoadedRef.current = false;
    searchTimerRef.current = setTimeout(() => {
      searchTimerRef.current = undefined;
      void loadBanksNow(next, model.bankAccountType || BANK_CORPORATE);
    }, 300);
  }, [cancelBankSearch, loadBanksNow, model.bankAccountType]);

  const onBankDropdownVisibleChange = useCallback((visible: boolean) => {
    if (visible && !bankLoadedRef.current && !bankLoading && !searchTimerRef.current) {
      void loadBanksNow(bankKeywordRef.current, model.bankAccountType || BANK_CORPORATE);
    }
  }, [bankLoading, loadBanksNow, model.bankAccountType]);

  const reloadFailedStage = useCallback(() => {
    if (failedStage === 'banks' || !stateRef.current.bankCode) {
      cancelBankSearch();
      void loadBanksNow(bankKeywordRef.current, model.bankAccountType || BANK_CORPORATE);
      return;
    }
    if (!stateRef.current.provinceCode) runStage('provinces', loadProvincesData);
    else if (!stateRef.current.cityCode) runStage('cities', loadCitiesData);
    else runStage('branches', loadBranchesData);
  }, [failedStage, cancelBankSearch, loadBanksNow, model.bankAccountType, runStage, loadProvincesData, loadCitiesData, loadBranchesData]);

  // 银行账户类型变化时重置联动选择（原版 watch bankAccountType immediate）
  const prevAccountTypeRef = useRef(model.bankAccountType);
  useEffect(() => {
    const prev = prevAccountTypeRef.current;
    if (prev !== undefined && model.bankAccountType !== prev) {
      setBankCode('');
      stateRef.current.bankCode = '';
      setProvinceCode('');
      stateRef.current.provinceCode = '';
      setCityCode('');
      stateRef.current.cityCode = '';
      setCities([]);
      setBranches([]);
      onChangeRef.current({ bankName: '', bankBranchName: '', bankBranchId: '' });
    }
    prevAccountTypeRef.current = model.bankAccountType;
    cancelBankSearch();
    seqRef.current += 1;
    setStageLoading(false);
    setFailedStage('');
    setStageError('');
    setSelectedBank(undefined);
    setBanks([]);
    bankLoadedRef.current = false;
  }, [model.bankAccountType, cancelBankSearch]);

  useEffect(
    () => () => {
      cancelBankSearch();
      seqRef.current += 1;
      branchCacheRef.current.clear();
    },
    [cancelBankSearch],
  );

  useImperativeHandle(
    ref,
    () => ({
      validate: () => {
        if (stageLoading) throw new Error(t('银行数据正在加载'));
        if (!stateRef.current.bankCode && allowHistorical && model.bankName) return;
        if (stageError && (failedStage !== 'banks' || !selectedBank)) throw new Error(stageError);
        if (
          !selectedBank ||
          (selectedBank.needBankBranch && !branches.some((branch) => branch.bankBranchId === String(model.bankBranchId ?? '')))
        ) {
          throw new Error(t('请选择银行及开户支行'));
        }
      },
    }),
    [stageLoading, stageError, failedStage, selectedBank, branches, allowHistorical, model.bankName, model.bankBranchId],
  );

  const showHistorical = !bankCode && Boolean(allowHistorical) && !!model.bankName;
  const bankOptionList: Array<{ value: string; label: string; disabled?: boolean }> = [
    ...(showHistorical ? [{ value: HISTORICAL_BANK, label: model.bankName || t('历史开户银行'), disabled: true }] : []),
    ...(bankCode && selectedBank && !banks.some((bank) => bank.bankAliasCode === bankCode)
      ? [{ value: bankCode, label: selectedBank.bankAlias }]
      : []),
    ...banks.map((bank) => ({ value: bank.bankAliasCode, label: bank.bankAlias })),
  ];
  const banksFailed = failedStage === 'banks';

  return (
    <>
      <MaItem label={t('开户银行')} required error={banksFailed ? stageFailureText('banks', t) : ''}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Select
            filter
            remote
            showClear
            disabled={disabled}
            placeholder={t('请选择开户银行')}
            style={{ width: 300 }}
            optionList={bankOptionList}
            loading={bankLoading}
            onSearch={searchBanks}
            onDropdownVisibleChange={onBankDropdownVisibleChange}
            value={bankCode || (showHistorical ? HISTORICAL_BANK : undefined)}
            onChange={(next) => changeBank(String(next ?? ''))}
          />
          {banksFailed && (
            <Button theme="borderless" type="primary" size="small" disabled={disabled} onClick={reloadFailedStage}>
              {t('刷新')}
            </Button>
          )}
        </div>
      </MaItem>
      {showHistorical && model.bankBranchName ? (
        <MaItem label={t('开户支行')}>
          <Input value={model.bankBranchName} disabled style={{ width: 300 }} />
        </MaItem>
      ) : null}
      {selectedBank?.needBankBranch ? (
        <>
          <MaItem label={t('银行所在省份')} required error={failedStage === 'provinces' ? stageError : ''}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Select
                filter
                showClear
                disabled={disabled || (stageLoading && loadingStage === 'provinces') || failedStage === 'provinces'}
                placeholder={t('请选择省份')}
                style={{ width: 300 }}
                optionList={provinces.map((province) => ({ value: province.provinceCode, label: province.provinceName }))}
                loading={stageLoading && loadingStage === 'provinces'}
                value={provinceCode || undefined}
                onChange={(next) => changeProvince(String(next ?? ''))}
              />
              {failedStage === 'provinces' && (
                <Button theme="borderless" type="primary" size="small" disabled={disabled} onClick={reloadFailedStage}>
                  {t('刷新')}
                </Button>
              )}
            </div>
          </MaItem>
          <MaItem label={t('银行所在城市')} required error={failedStage === 'cities' ? stageError : ''}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Select
                filter
                showClear
                disabled={disabled || !provinceCode || (stageLoading && loadingStage === 'cities') || failedStage === 'cities'}
                placeholder={t('请选择城市')}
                style={{ width: 300 }}
                optionList={cities.map((city) => ({ value: city.cityCode, label: city.cityName }))}
                loading={stageLoading && loadingStage === 'cities'}
                value={cityCode || undefined}
                onChange={(next) => changeCity(String(next ?? ''))}
              />
              {failedStage === 'cities' && (
                <Button theme="borderless" type="primary" size="small" disabled={disabled} onClick={reloadFailedStage}>
                  {t('刷新')}
                </Button>
              )}
            </div>
          </MaItem>
          <MaItem label={t('开户支行')} required error={failedStage === 'branches' ? stageError : ''}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Select
                filter
                showClear
                disabled={disabled || !cityCode || (stageLoading && loadingStage === 'branches') || failedStage === 'branches'}
                placeholder={t('请选择开户支行')}
                style={{ width: 300 }}
                optionList={branches.map((branch) => ({ value: branch.bankBranchId, label: branch.bankBranchName }))}
                loading={stageLoading && loadingStage === 'branches'}
                value={model.bankBranchId ? String(model.bankBranchId) : undefined}
                onChange={(next) => chooseBranch(String(next ?? ''))}
              />
              {failedStage === 'branches' && (
                <Button theme="borderless" type="primary" size="small" disabled={disabled} onClick={reloadFailedStage}>
                  {t('刷新')}
                </Button>
              )}
            </div>
          </MaItem>
        </>
      ) : null}
    </>
  );
});

// ——————————————————————————————————————————————
// 提交/修改/重新申请表单（原版 SubmitForm.vue，分步合并为分块长表单）
// ——————————————————————————————————————————————

type SubmitAct = 'add' | 'edit' | 'reapply';

const PROFILE_FILL_KEYS = [
  'organizationType', 'merchantName', 'merchantShortName', 'businessLicenseNumber', 'legalPerson',
  'licensePeriodBegin', 'licensePeriodEnd', 'licenseCopy', 'idCardName', 'idCardNumber',
  'idCardCopy', 'idCardNational', 'cardPeriodBegin', 'cardPeriodEnd', 'servicePhone',
  'bankAccountType', 'bankAccountName', 'bankAccountNumber', 'bankName', 'bankBranchName',
  'contactType', 'contactName', 'contactIdNumber', 'contactPhone', 'contactEmail',
];

const buildEmptyApplicationForm = (): ApplicationForm => ({
  owner: true,
  shopId: '',
  payChannel: PAY_CHANNEL_WECHAT,
  organizationType: ORG_INDIVIDUAL,
  merchantName: '',
  merchantShortName: '',
  businessLicenseNumber: '',
  legalPerson: '',
  licensePeriodBegin: '',
  licensePeriodEnd: '',
  licenseCopy: '',
  idCardName: '',
  idCardNumber: '',
  idCardCopy: '',
  idCardNational: '',
  cardPeriodBegin: '',
  cardPeriodEnd: '',
  servicePhone: '',
  storeUrl: '',
  settlementId: '',
  qualificationType: '',
  bankAccountType: BANK_CORPORATE,
  bankAccountName: '',
  bankAccountNumber: '',
  bankName: '',
  bankBranchName: '',
  bankBranchId: '',
  contactType: CONTACT_LEGAL,
  contactName: '',
  contactIdNumber: '',
  contactPhone: '',
  contactEmail: '',
});

async function fetchShopOptions(keyword: string): Promise<RemoteOption[]> {
  const result = await apiGet<Record<string, unknown>>('/merchant/shop/list', {
    keyword: keyword || undefined,
    page: 1,
    size: 20,
    status: 1,
    shopType: 1,
    includeSelfOperated: 1,
  });
  return ((result?.records as unknown[]) || []).map((row) => {
    const record = row as Record<string, unknown>;
    return { label: String(record.shopTitle || record.shopId), value: String(record.shopId) };
  });
}

async function fetchVendorOptions(keyword: string): Promise<RemoteOption[]> {
  const result = await apiGet<Record<string, unknown>>('/vendor/vendor/list', { keyword: keyword || undefined, page: 1, size: 20 });
  return ((result?.records as unknown[]) || []).map((row) => {
    const record = row as Record<string, unknown>;
    return { label: String(record.vendorName || record.vendorId || record.id), value: String(record.vendorId ?? record.id) };
  });
}

function SubmitFormModal({ visible, act, id, onClose, onSubmitted, onChanged }: {
  visible: boolean;
  act: SubmitAct;
  id?: number | string;
  onClose: () => void;
  onSubmitted: (row: MerchantApplicationItem) => void;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const isReapply = act === 'reapply' && !!id;
  const isEdit = ['edit', 'reapply'].includes(act) && !!id;

  const [form, setForm] = useState<ApplicationForm>(buildEmptyApplicationForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [licenseLongTerm, setLicenseLongTerm] = useState(false);
  const [cardLongTerm, setCardLongTerm] = useState(false);
  const [source, setSource] = useState<MerchantApplicationItem>();
  const [initialForm, setInitialForm] = useState<ApplicationForm>({});
  const [changedMedia, setChangedMedia] = useState<MediaKey[]>([]);
  const [mediaVersion, setMediaVersion] = useState(0);
  const [mediaBusy, setMediaBusy] = useState<Record<string, boolean>>({});
  const [abandonReason, setAbandonReason] = useState('');
  const [preparing, setPreparing] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [snapshotMissing, setSnapshotMissing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [operationBlocked, setOperationBlocked] = useState('');
  const [shopName, setShopName] = useState('');

  const bankRef = useRef<WechatBankFieldsHandle>(null);
  const prefillSeqRef = useRef(0);
  const previousIdsRef = useRef<Set<string>>(new Set());
  const uncertainReapplyRef = useRef<ApplicationReapplyForm>();
  const submittingRef = useRef(false);
  submittingRef.current = submitting;

  const isWechat = form.payChannel === PAY_CHANNEL_WECHAT;
  const isEnterprise = form.organizationType === ORG_ENTERPRISE;
  const isPersonal = isPersonalOrg(form.organizationType);
  const bankAccountNameLabel = form.bankAccountType === BANK_CORPORATE ? t('对公账户名称') : t('银行账户名称');
  const merchantNameLabel = isEnterprise ? t('公司名称') : isPersonal ? t('店铺全称') : t('商户名称');
  const shopDisplay = shopName || String(form.shopId ?? '');

  const setField = useCallback((key: string, value: unknown) => {
    setForm((prev) => ({ ...prev, [key]: value }) as ApplicationForm);
    setErrors((prev) => ({ ...prev, [key]: '' }));
  }, []);

  const setMedia = useCallback((key: MediaKey, mediaId: string) => {
    setForm((prev) => ({ ...prev, [key]: mediaId }) as ApplicationForm);
    setChangedMedia((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  }, []);

  const markMediaBusy = useCallback((key: MediaKey, busy: boolean) => {
    setMediaBusy((prev) => ({ ...prev, [key]: busy }));
  }, []);

  const prefillFromDetail = useCallback(async () => {
    if (!id) return;
    const result = await getApplicationDetail(id);
    const snapshot = parseApplicationSnapshot(result.requestSnapshot);
    const base = buildEmptyApplicationForm();
    const values: Record<string, unknown> = {
      ...pickApplicationFields(result as unknown as ApplicationForm),
      ...(snapshot || {}),
      shopId: result.shopId,
      payChannel: result.payChannel,
    };
    APPLICATION_FIELDS.forEach((key) => {
      const fieldValue = values[key];
      if (fieldValue !== undefined && fieldValue !== null && !String(fieldValue).includes('*')) {
        (base as Record<string, unknown>)[key] = fieldValue;
      }
    });
    if (result.payChannel === PAY_CHANNEL_WECHAT) {
      MEDIA_FIELDS.forEach((key) => {
        (base as Record<string, unknown>)[key] = isReapply ? ((snapshot as Record<string, unknown> | null)?.[key] as string) || '' : '';
      });
    }
    applyOrganizationConstraints(base);
    setSource(result);
    setShopName(result.applicantName || result.shopName || '');
    setSnapshotMissing(!snapshot);
    setForm(base);
    setInitialForm({ ...base });
    setLicenseLongTerm(base.licensePeriodEnd === LONG_TERM_VALUE);
    setCardLongTerm(base.cardPeriodEnd === LONG_TERM_VALUE);
  }, [id, isReapply]);

  useEffect(() => {
    if (!visible) return;
    let alive = true;
    setPreparing(true);
    void (async () => {
      try {
        if (isEdit) await prefillFromDetail();
      } catch (loadException) {
        if (!alive) return;
        setLoadError(true);
        Toast.error({ content: loadException instanceof Error ? loadException.message : t('加载失败') });
      } finally {
        if (alive) setPreparing(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [visible, isEdit, prefillFromDetail]);

  // 主体类型联动：企业仅对公、个人清空执照并同步派生字段（原版 watch）
  useEffect(() => {
    if (isPersonalOrg(form.organizationType)) setLicenseLongTerm(false);
    setForm((prev) => applyOrganizationConstraints({ ...prev }) as ApplicationForm);
  }, [form.organizationType]);

  useEffect(() => {
    setForm((prev) => {
      if (!isPersonalOrg(prev.organizationType)) return prev;
      const next = { ...prev };
      syncPersonalDerivedFields(next);
      return next;
    });
  }, [form.organizationType, form.idCardName, form.idCardNumber]);

  const prefillFromSelectedShop = async (shopId: string) => {
    const seq = ++prefillSeqRef.current;
    setProfileLoading(true);
    try {
      const shop = await apiGet<Record<string, unknown>>('/merchant/shop/detail', { shopId });
      if (seq !== prefillSeqRef.current) return;
      const profile = mapMerchantProfileToApplication({
        ...shop,
        shopContactPhone: String(shop?.contactMobile || shop?.kefuPhone || ''),
      });
      setForm((prev) => {
        const next = { ...prev, shopId };
        PROFILE_FILL_KEYS.forEach((key) => {
          (next as Record<string, unknown>)[key] = (profile as Record<string, unknown>)[key] ?? '';
        });
        if (!next.organizationType) next.organizationType = ORG_INDIVIDUAL;
        if (!next.bankAccountType) next.bankAccountType = BANK_CORPORATE;
        if (!next.contactType) next.contactType = CONTACT_LEGAL;
        if (next.payChannel === PAY_CHANNEL_WECHAT) {
          MEDIA_FIELDS.forEach((key) => {
            (next as Record<string, unknown>)[key] = '';
          });
        }
        applyOrganizationConstraints(next);
        return next;
      });
      setLicenseLongTerm(profile.licensePeriodEnd === LONG_TERM_VALUE);
      setCardLongTerm(profile.cardPeriodEnd === LONG_TERM_VALUE);
    } catch {
      // 选中店铺无商户资料时保持可手工填写
    } finally {
      if (seq === prefillSeqRef.current) setProfileLoading(false);
    }
  };

  const onShopChange = (nextShopId: string) => {
    if (isWechat) {
      setMediaVersion((version) => version + 1);
      setForm((prev) => {
        const next = { ...prev };
        MEDIA_FIELDS.forEach((key) => {
          (next as Record<string, unknown>)[key] = '';
        });
        return next;
      });
      setChangedMedia([]);
    }
    const normalized = String(nextShopId ?? '').trim();
    setForm((prev) => ({ ...prev, shopId: normalized, storeUrl: '' }));
    if (!normalized) return;
    void prefillFromSelectedShop(normalized);
  };

  const onAutoGetShopUrl = async () => {
    const shopId = String(form.shopId ?? '').trim();
    if (!shopId) {
      Toast.warning({ content: t('请先选择店铺') });
      return;
    }
    let domain = '';
    try {
      const base = await apiGet<Record<string, unknown>>('/setting/config/getBase');
      domain = String(base?.pcDomain || base?.h5Domain || '').trim().replace(/\/+$/, '');
    } catch {
      /* 配置缺失时回退当前站点域名 */
    }
    if (!domain) domain = window.location.origin.replace(/\/+$/, '');
    const origin = /^https?:\/\//i.test(domain) ? domain : `https://${domain}`;
    setField('storeUrl', `${origin}/shop/${encodeURIComponent(shopId)}`);
  };

  const anyMediaBusy = Object.values(mediaBusy).some(Boolean);
  const canWrite =
    !operationBlocked &&
    !preparing &&
    !profileLoading &&
    !submitting &&
    !loadError &&
    !uncertain &&
    !anyMediaBusy &&
    (isReapply ? Boolean(source && applicationActions(source).reapply) : Boolean(!source || canEditApplication(source, true)));

  const validateForm = (): string | null => {
    const next: Record<string, string> = {};
    const requireValue = (key: string, message: string) => {
      if (!String((form as Record<string, unknown>)[key] ?? '').trim()) next[key] = message;
    };
    if (!form.payChannel) next.payChannel = t('请选择支付渠道');
    if (!form.organizationType) next.organizationType = t('请选择主体类型');
    if (!isReapply && !String(form.shopId ?? '').trim()) next.shopId = t('请选择店铺');
    if (!isPersonal) {
      requireValue('businessLicenseNumber', t('请输入营业执照号'));
      requireValue('legalPerson', t('请输入法人/经营者姓名'));
      requireValue('licenseCopy', t('请上传营业执照照片'));
    }
    if (!String(form.merchantName ?? '').trim()) next.merchantName = isPersonal ? t('请输入店铺全称') : t('请输入商户名称');
    requireValue('idCardName', t('请输入身份证姓名'));
    requireValue('idCardNumber', t('请输入身份证号码'));
    if (!String(form.cardPeriodBegin ?? '').trim()) next.cardPeriodBegin = t('请选择日期');
    if (!cardLongTerm && !String(form.cardPeriodEnd ?? '').trim()) next.cardPeriodEnd = t('请选择日期');
    requireValue('idCardCopy', t('请上传身份证人像面'));
    if (isDuplicateIdCardPhotos(form.idCardCopy, form.idCardNational)) next.idCardNational = t('身份证人像面与国徽面不可使用同一张图片');
    else requireValue('idCardNational', t('请上传身份证国徽面'));
    requireValue('merchantShortName', t('请输入商户简称'));
    if (!String(form.storeUrl ?? '').trim()) next.storeUrl = t('请输入店铺Url');
    else if (!isHttpStoreUrl(form.storeUrl)) next.storeUrl = t('店铺主页须为可访问的 HTTP/HTTPS 链接');
    if (!form.bankAccountType) next.bankAccountType = t('请选择银行账户类型');
    if (!String(form.bankAccountName ?? '').trim()) {
      next.bankAccountName = form.bankAccountType === BANK_CORPORATE ? t('请输入对公账户名称') : t('请输入银行账户名称');
    }
    requireValue('bankAccountNumber', t('请输入银行账号'));
    if (!isWechat && !String(form.bankName ?? '').trim()) next.bankName = t('请输入开户银行');
    requireValue('contactType', t('请选择超管类型'));
    requireValue('contactName', t('请输入联系人姓名'));
    requireValue('contactIdNumber', t('请输入超管身份证号'));
    requireValue('contactPhone', t('请输入联系人手机'));
    if (isReapply) {
      const length = abandonReason.trim().length;
      if (!length || length > 500) next.abandonReason = t('请填写 1～500 字的放弃原因');
    }
    setErrors(next);
    const firstKey = Object.keys(next)[0];
    if (firstKey) return next[firstKey];
    if (isWechat) {
      if (!bankRef.current) return t('银行数据正在加载');
      try {
        bankRef.current.validate();
      } catch (bankException) {
        return bankException instanceof Error ? bankException.message : t('请选择银行及开户支行');
      }
      if (form.bankBranchId && !/^\d{1,64}$/.test(String(form.bankBranchId))) return t('请选择银行及开户支行');
      if (String(form.storeUrl ?? '').length > 1024 || !isHttpStoreUrl(form.storeUrl)) return t('店铺主页须为可访问的 HTTP/HTTPS 链接');
      if (form.settlementId && !/^\d+$/.test(String(form.settlementId))) return t('结算规则 ID 必须为数字');
      if (!isPersonal && form.idCardName !== form.legalPerson) return t('身份证姓名须与法人或经营者姓名一致');
      if (form.contactName !== form.idCardName || form.contactIdNumber !== form.idCardNumber) return t('超级管理员姓名和身份证号须与身份证资料一致');
      const accountName = form.bankAccountType === BANK_CORPORATE ? form.merchantName : form.idCardName;
      if (form.bankAccountName !== accountName) return t('对公户名须与商户名称一致，对私户名须与身份证姓名一致');
    }
    return null;
  };

  const finishSubmit = useCallback(
    async (row: MerchantApplicationItem) => {
      setUncertain(false);
      let result = row;
      if (result?.id) {
        try {
          result = await getApplicationDetail(result.id);
        } catch {
          /* 保留提交接口返回的结果 */
        }
      }
      setSource(result);
      const statusText = result.statusDesc || result.status || t('进件处理中');
      if (result.retryable && !isClosedApplication(result)) {
        Toast.warning({ content: result.rejectReason || t('申请已保存，渠道结果待确认，请使用重试提交') });
      } else if (!isClosedApplication(result) && (['DRAFT', 'REJECTED'].includes(result.status || '') || result.rejectReason)) {
        Toast.warning({ content: result.rejectReason || statusText });
      } else {
        Toast.success({ content: statusText });
      }
      onSubmitted(result);
    },
    [onSubmitted],
  );

  const checkSubmission = async () => {
    if (submittingRef.current) return;
    setSubmitting(true);
    try {
      if (isReapply && uncertainReapplyRef.current && id) {
        const list = await listApplications({
          page: 1,
          size: 100,
          applicantType: source?.applicantType,
          ...(source?.applicantType === 'SHOP' ? { shopId: source?.shopId } : {}),
        });
        const replacement = (list.records || []).find(
          (row) => String(row.sourceApplicationId) === String(uncertainReapplyRef.current?.sourceApplicationId),
        );
        if (replacement) await finishSubmit(replacement);
        else Toast.warning({ content: t('暂未确认提交结果，请稍后查询') });
      } else {
        const list = await listApplications({ page: 1, size: 100, shopId: form.shopId });
        const rows = (list.records || []).filter(
          (row) =>
            row.payChannel === form.payChannel &&
            row.applicantType === 'SHOP' &&
            !previousIdsRef.current.has(String(row.id)) &&
            row.abandoned !== 1,
        );
        if (rows.length === 1) await finishSubmit(rows[0]);
        else {
          Toast.warning({ content: t('请在进件列表核对申请记录后继续，勿重复提交') });
          onChanged();
        }
      }
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('查询失败') });
      onChanged();
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmit = async () => {
    if (!canWrite || submittingRef.current) return;
    const problem = validateForm();
    if (problem) {
      Toast.error({ content: problem });
      return;
    }
    setSubmitting(true);
    let requested = false;
    try {
      if (source?.id) {
        const current = await getApplicationDetail(source.id);
        const stillAllowed = current ? (isReapply ? applicationActions(current).reapply : canEditApplication(current, true)) : false;
        if (!current || String(current.id) !== String(source.id) || !stillAllowed) {
          if (current) setSource(current);
          throw new Error(t('申请状态已变化，请查看最新详情'));
        }
      }
      previousIdsRef.current = new Set();
      if (!isReapply) {
        const before = await listApplications({ page: 1, size: 100, shopId: form.shopId });
        previousIdsRef.current = new Set((before.records || []).map((row) => String(row.id)));
      }
      const payload = buildMerchantApplicationPayload(form);
      if (isWechat) {
        payload.owner = true;
        payload.contactType = CONTACT_LEGAL;
      } else {
        delete payload.owner;
      }
      if (payload.shopId !== undefined && payload.shopId !== null) payload.shopId = toId(payload.shopId as number | string);
      requested = true;
      if (isReapply && id) {
        const reapplyPayload = buildReapplyPayload(id, abandonReason, form, initialForm, changedMedia);
        uncertainReapplyRef.current = reapplyPayload;
        await finishSubmit(await reapplyApplication(reapplyPayload));
      } else {
        await finishSubmit(await submitApplication(payload));
      }
    } catch (error) {
      const message = error instanceof Error && error.message ? error.message : t('提交失败');
      Toast.error({ content: message });
      if (isReapply && /(?:重新申请|替代申请|新记录).*已删除/.test(message)) setOperationBlocked(message);
      onChanged();
      if (requested) setUncertain(true);
      else uncertainReapplyRef.current = undefined;
    } finally {
      setSubmitting(false);
    }
  };

  const allowHistorical = Boolean(
    isEdit &&
      form.bankAccountType === initialForm.bankAccountType &&
      form.bankName === initialForm.bankName &&
      form.bankBranchName === initialForm.bankBranchName &&
      form.bankBranchId === initialForm.bankBranchId,
  );

  const renderMedia = (key: MediaKey, label: string, role: number) => (
    <MaItem label={label} required error={errors[key]}>
      {isWechat ? (
        <CertificateMediaField
          key={`${key}-${mediaVersion}`}
          applicationId={source?.id}
          role={role}
          disabled={!canWrite}
          value={String((form as Record<string, unknown>)[key] ?? '')}
          onChange={(mediaId) => setMedia(key, mediaId)}
          onBusyChange={(busy) => markMediaBusy(key, busy)}
        />
      ) : (
        <ImageUploader
          single
          value={String((form as Record<string, unknown>)[key] ?? '') ? [String((form as Record<string, unknown>)[key])] : []}
          onChange={(urls) => setField(key, urls[0] || '')}
        />
      )}
    </MaItem>
  );

  const title = isReapply ? t('修改资料重新提交') : isEdit ? t('修改并提交进件') : t('提交进件');
  const controlWidth = { width: 300 };

  return (
    <Modal
      title={title}
      visible={visible}
      onCancel={onClose}
      width={1000}
      bodyStyle={{ maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}
      footer={
        <Space>
          <Button onClick={onClose}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={submitting} disabled={!canWrite} onClick={() => void onSubmit()}>
            {t('提交')}
          </Button>
        </Space>
      }
    >
      <Spin spinning={preparing}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {snapshotMissing ? <Banner type="warning" closeIcon={null} description={t('原申请资料快照缺失或无效，请补全资料；无法自动重新申请')} style={{ marginBottom: 12 }} /> : null}
          {source?.retryable ? <Banner type="warning" closeIcon={null} description={t('渠道结果尚未确认，请由平台使用重试提交，不能修改资料')} style={{ marginBottom: 12 }} /> : null}
          {operationBlocked ? <Banner type="danger" closeIcon={null} description={operationBlocked} style={{ marginBottom: 12 }} /> : null}
          {uncertain ? (
            <div style={{ marginBottom: 12 }}>
              <Banner type="warning" closeIcon={null} description={t('提交结果尚未确认，请先查询申请记录，勿重复提交')} />
              <Button style={{ marginTop: 8 }} loading={submitting} onClick={() => void checkSubmission()}>
                {t('查询提交结果')}
              </Button>
            </div>
          ) : null}
          {isEdit && !isReapply && isWechat ? <Banner type="info" closeIcon={null} description={t('修改后完整提交需重新上传证件，原证件仅供预览')} style={{ marginBottom: 12 }} /> : null}

          <MaSection title={t('主体信息')}>
            <MaItem label={t('支付渠道')} required error={errors.payChannel}>
              <Select
                style={controlWidth}
                disabled={isEdit}
                optionList={[{ label: t('微信'), value: PAY_CHANNEL_WECHAT }]}
                value={form.payChannel || PAY_CHANNEL_WECHAT}
                onChange={(next) => setField('payChannel', String(next))}
              />
              <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 4 }}>
                {t('选择进件的支付分账渠道，需与平台「分账设置」中的线上分账渠道一致')}
              </div>
            </MaItem>
            <MaItem label={t('主体类型')} required error={errors.organizationType}>
              <RadioGroup value={form.organizationType} disabled={isReapply} onChange={(event) => setField('organizationType', String(event.target.value))}>
                <Radio value={ORG_ENTERPRISE}>{t('企业')}</Radio>
                <Radio value={ORG_INDIVIDUAL}>{t('个体工商户')}</Radio>
                <Radio value={ORG_PERSONAL}>{t('个人')}</Radio>
              </RadioGroup>
              <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 4 }}>
                {isPersonal
                  ? t('“个人”为根据法律法规和相关规定免于办理工商登记，无营业执照的商家。')
                  : t('“个体工商户”在营业执照上的主体类型一般为：个体工商户。')}
              </div>
            </MaItem>
            {!isReapply ? (
              <MaItem label={t('选择店铺')} required error={errors.shopId}>
                {isEdit ? (
                  <Input value={shopDisplay} disabled style={controlWidth} />
                ) : (
                  <RemoteSelect fetchOptions={fetchShopOptions} value={String(form.shopId ?? '')} onChange={onShopChange} placeholder={t('请输入店铺名称')} width={300} />
                )}
              </MaItem>
            ) : null}
            {!isPersonal ? <MaItem label={t('营业执照号')} required error={errors.businessLicenseNumber}>
              <Input value={form.businessLicenseNumber || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('businessLicenseNumber', next)} />
            </MaItem> : null}
            <MaItem label={merchantNameLabel} required error={errors.merchantName}>
              <Input value={form.merchantName || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('merchantName', next)} />
            </MaItem>
            {!isPersonal ? <MaItem label={t('法人/经营者姓名')} required error={errors.legalPerson}>
              <Input value={form.legalPerson || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('legalPerson', next)} />
            </MaItem> : null}
            {!isPersonal ? <MaItem label={t('营业执照有效期开始')} error={errors.licensePeriodBegin}>
              <DatePicker
                type="date"
                format="yyyy-MM-dd"
                style={controlWidth}
                value={form.licensePeriodBegin || undefined}
                placeholder={t('请选择日期')}
                onChange={(_date, dateStr) => setField('licensePeriodBegin', typeof dateStr === 'string' ? dateStr : '')}
              />
            </MaItem> : null}
            {!isPersonal ? <MaItem label={t('营业执照有效期结束')} error={errors.licensePeriodEnd}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <DatePicker
                  type="date"
                  format="yyyy-MM-dd"
                  style={controlWidth}
                  disabled={licenseLongTerm}
                  value={form.licensePeriodEnd && form.licensePeriodEnd !== LONG_TERM_VALUE ? form.licensePeriodEnd : undefined}
                  placeholder={t('请选择日期')}
                  onChange={(_date, dateStr) => setField('licensePeriodEnd', typeof dateStr === 'string' ? dateStr : '')}
                />
                <Checkbox
                  checked={licenseLongTerm}
                  onChange={(event) => {
                    const checked = Boolean(event.target.checked);
                    setLicenseLongTerm(checked);
                    setField('licensePeriodEnd', checked ? LONG_TERM_VALUE : '');
                  }}
                >
                  {t('长期')}
                </Checkbox>
              </div>
            </MaItem> : null}
            {!isPersonal ? renderMedia('licenseCopy', t('营业执照照片'), 1) : null}
          </MaSection>

          <MaSection title={t('法人/经营者身份信息')}>
            <MaItem label={t('身份证姓名')} required error={errors.idCardName}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Input value={form.idCardName || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('idCardName', next)} />
                {!isPersonal && form.legalPerson ? (
                  <Button theme="borderless" type="primary" size="small" onClick={() => setField('idCardName', form.legalPerson)}>
                    {t('同步法人姓名')}
                  </Button>
                ) : null}
              </div>
            </MaItem>
            <MaItem label={t('身份证号码')} required error={errors.idCardNumber}>
              <Input value={form.idCardNumber || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('idCardNumber', next)} />
            </MaItem>
            <MaItem label={t('身份证有效期开始')} required error={errors.cardPeriodBegin}>
              <DatePicker
                type="date"
                format="yyyy-MM-dd"
                style={controlWidth}
                value={form.cardPeriodBegin || undefined}
                placeholder={t('请选择日期')}
                onChange={(_date, dateStr) => setField('cardPeriodBegin', typeof dateStr === 'string' ? dateStr : '')}
              />
            </MaItem>
            <MaItem label={t('身份证有效期结束')} required={!cardLongTerm} error={errors.cardPeriodEnd}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <DatePicker
                  type="date"
                  format="yyyy-MM-dd"
                  style={controlWidth}
                  disabled={cardLongTerm}
                  value={form.cardPeriodEnd && form.cardPeriodEnd !== LONG_TERM_VALUE ? form.cardPeriodEnd : undefined}
                  placeholder={t('请选择日期')}
                  onChange={(_date, dateStr) => setField('cardPeriodEnd', typeof dateStr === 'string' ? dateStr : '')}
                />
                <Checkbox
                  checked={cardLongTerm}
                  onChange={(event) => {
                    const checked = Boolean(event.target.checked);
                    setCardLongTerm(checked);
                    setField('cardPeriodEnd', checked ? LONG_TERM_VALUE : '');
                  }}
                >
                  {t('长期')}
                </Checkbox>
              </div>
            </MaItem>
            {renderMedia('idCardCopy', t('身份证人像面'), 2)}
            {renderMedia('idCardNational', t('身份证国徽面'), 3)}
          </MaSection>

          <MaSection title={t('经营信息')}>
            <MaItem label={t('商户简称')} required error={errors.merchantShortName}>
              <Input value={form.merchantShortName || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('merchantShortName', next)} />
            </MaItem>
            <MaItem label={t('客服电话')} error={errors.servicePhone}>
              <Input value={form.servicePhone || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('servicePhone', next)} />
              <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 4 }}>{t('注：该字段仅做内部记录，不会提交到微信支付')}</div>
            </MaItem>
            <MaItem label={t('店铺Url')} required error={errors.storeUrl}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <Input value={form.storeUrl || ''} style={controlWidth} onChange={(next) => setField('storeUrl', next)} />
                <Button theme="borderless" type="primary" size="small" onClick={() => void onAutoGetShopUrl()}>
                  {t('自动获取')}
                </Button>
              </div>
            </MaItem>
          </MaSection>

          <MaSection title={t('结算信息')}>
            <MaItem label={t('结算规则ID')} error={errors.settlementId}>
              <Input value={form.settlementId || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('settlementId', next)} />
            </MaItem>
            <MaItem label={t('所属行业')} error={errors.qualificationType}>
              <Input value={form.qualificationType || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('qualificationType', next)} />
            </MaItem>
            <MaItem label={t('银行账户类型')} required error={errors.bankAccountType}>
              <RadioGroup value={form.bankAccountType} onChange={(event) => setField('bankAccountType', String(event.target.value))}>
                <Radio value={BANK_CORPORATE} disabled={isPersonal}>{t('对公')}</Radio>
                <Radio value={BANK_PERSONAL} disabled={isEnterprise}>{t('对私')}</Radio>
              </RadioGroup>
              <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 4 }}>
                {isEnterprise ? t('企业主体仅支持对公账户') : isPersonal ? t('个人主体仅支持对私账户') : ''}
              </div>
            </MaItem>
            <MaItem label={bankAccountNameLabel} required error={errors.bankAccountName}>
              <Input value={form.bankAccountName || ''} placeholder={t('请输入')} style={controlWidth} disabled={isPersonal} onChange={(next) => setField('bankAccountName', next)} />
            </MaItem>
            <MaItem label={t('银行账号')} required error={errors.bankAccountNumber}>
              <Input value={form.bankAccountNumber || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('bankAccountNumber', next)} />
            </MaItem>
            {isWechat ? (
              <WechatBankFields
                ref={bankRef}
                value={form}
                onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }) as ApplicationForm)}
                disabled={!canWrite}
                allowHistorical={allowHistorical}
              />
            ) : (
              <>
                <MaItem label={t('开户银行')} required error={errors.bankName}>
                  <Input value={form.bankName || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('bankName', next)} />
                </MaItem>
                <MaItem label={t('开户银行全称（含支行）')} error={errors.bankBranchName}>
                  <Input value={form.bankBranchName || ''} placeholder={t('选填')} style={controlWidth} onChange={(next) => setField('bankBranchName', next)} />
                </MaItem>
              </>
            )}
          </MaSection>

          <MaSection title={t('超级管理员信息')}>
            <MaItem label={t('超管类型')} required error={errors.contactType}>
              <RadioGroup value={form.contactType} onChange={(event) => setField('contactType', String(event.target.value))}>
                <Radio value={CONTACT_LEGAL}>{t('经营者/法人')}</Radio>
              </RadioGroup>
            </MaItem>
            <MaItem label={t('联系人姓名')} required error={errors.contactName}>
              <Input value={form.contactName || ''} placeholder={t('请输入')} style={controlWidth} disabled={isPersonal} onChange={(next) => setField('contactName', next)} />
            </MaItem>
            <MaItem label={t('超管身份证号')} required error={errors.contactIdNumber}>
              <Input value={form.contactIdNumber || ''} placeholder={t('请输入')} style={controlWidth} disabled={isPersonal} onChange={(next) => setField('contactIdNumber', next)} />
            </MaItem>
            <MaItem label={t('联系人手机')} required error={errors.contactPhone}>
              <Input value={form.contactPhone || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('contactPhone', next)} />
            </MaItem>
            <MaItem label={t('联系人邮箱')} error={errors.contactEmail}>
              <Input value={form.contactEmail || ''} placeholder={t('请输入')} style={controlWidth} onChange={(next) => setField('contactEmail', next)} />
            </MaItem>
          </MaSection>

          {isReapply ? (
            <MaSection title={t('重新申请')}>
              <MaItem label={t('放弃原因')} required error={errors.abandonReason}>
                <TextArea
                  rows={4}
                  maxLength={500}
                  value={abandonReason}
                  placeholder={t('请填写 1～500 字的放弃原因')}
                  onChange={(next) => setAbandonReason(next)}
                />
                <div style={{ fontSize: 12, color: 'var(--semi-color-text-2)', marginTop: 8, lineHeight: 1.6 }}>
                  {t('重新申请将放弃原记录，但不会撤销微信侧申请。主体类型、申请主体和渠道不能更改。')}
                </div>
              </MaItem>
            </MaSection>
          ) : null}
        </div>
      </Spin>
    </Modal>
  );
}

// ——————————————————————————————————————————————
// 进件详情（原版 DetailForm.vue）
// ——————————————————————————————————————————————

const DETAIL_SNAPSHOT_FIELDS = [
  'shopId', 'organizationType', 'merchantName', 'merchantShortName', 'businessLicenseNumber',
  'legalPerson', 'licensePeriodBegin', 'licensePeriodEnd', 'licenseCopy', 'idCardName',
  'idCardNumber', 'idCardCopy', 'idCardNational', 'cardPeriodBegin', 'cardPeriodEnd',
  'servicePhone', 'storeUrl', 'settlementId', 'qualificationType', 'bankAccountType',
  'bankAccountName', 'bankAccountNumber', 'bankName', 'bankBranchName', 'bankBranchId',
  'contactType', 'contactName', 'contactIdNumber', 'contactPhone', 'contactEmail',
];

function ApplicationDetailSheet({ target, onClose }: { target: { id: number | string; seq: number }; onClose: () => void }) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [detail, setDetail] = useState<MerchantApplicationItem | null>(null);
  const [fields, setFields] = useState<Record<string, string>>({});

  useEffect(() => {
    let alive = true;
    setLoading(true);
    getApplicationDetail(target.id)
      .then((result) => {
        if (!alive) return;
        setDetail(result);
        const snapshot = parseApplicationSnapshot(result.requestSnapshot);
        const next: Record<string, string> = {};
        DETAIL_SNAPSHOT_FIELDS.forEach((key) => {
          const direct = (result as unknown as Record<string, unknown>)[key];
          let value = direct !== undefined && direct !== null && direct !== '' ? String(direct) : '';
          if (!value && snapshot) {
            const snapshotValue = (snapshot as Record<string, unknown>)[key];
            if (snapshotValue !== undefined && snapshotValue !== null) value = String(snapshotValue);
          }
          next[key] = value;
        });
        setFields(next);
      })
      .catch((error) => {
        if (alive) Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [target.id, target.seq]);

  const copySignUrl = async () => {
    if (!detail?.signUrl) return;
    try {
      await navigator.clipboard.writeText(detail.signUrl);
      Toast.success({ content: t('已复制到剪贴板') });
    } catch {
      Toast.error({ content: t('复制失败') });
    }
  };

  const organizationType = fields.organizationType;
  const isEnterprise = organizationType === ORG_ENTERPRISE;
  const isPersonal = isPersonalOrg(organizationType);
  const merchantNameLabel = isEnterprise ? t('公司名称') : isPersonal ? t('店铺全称') : t('商户名称');
  const isWechat = (detail?.payChannel || PAY_CHANNEL_WECHAT) === PAY_CHANNEL_WECHAT;
  const statusText = detail ? (isAbandoned(detail) ? t('已放弃（本地）') : detail.statusDesc || statusLabelText(detail.status, t) || detail.status || '-') : '-';

  const renderCert = (role: number, url: string) =>
    isWechat ? (
      <CertificateMediaField applicationId={detail?.id} role={role} readonly />
    ) : url ? (
      <img src={url} alt={t('证件')} style={{ width: 160, height: 100, objectFit: 'contain', border: '1px solid var(--semi-color-border)', borderRadius: 4, display: 'block' }} />
    ) : (
      <Typography.Text type="tertiary">-</Typography.Text>
    );

  return (
    <SideSheet title={t('进件详情')} visible width={760} onCancel={onClose} footer={null}>
      <Spin spinning={loading}>
        {detail ? (
          <div>
            <MaSection title={t('状态信息')}>
              <MaDesc label={t('状态')}>
                <Tag color={STATUS_TAG_COLOR[detail.abandoned === 1 ? 'ABANDONED' : detail.status || ''] || 'grey'} type="light">
                  {statusText}
                </Tag>
              </MaDesc>
              {detail.abandoned === 1 ? <MaDesc label={t('放弃原因')}>{detail.abandonReason || '-'}</MaDesc> : null}
              {detail.abandoned === 1 ? <MaDesc label={t('放弃时间')}>{detail.abandonTime || '-'}</MaDesc> : null}
              {detail.sourceApplicationId != null ? <MaDesc label={t('原申请 ID')}>{detail.sourceApplicationId}</MaDesc> : null}
              {detail.retryable && detail.abandoned !== 1 ? (
                <Banner type="warning" closeIcon={null} description={t('渠道结果尚未确认，请由平台使用重试提交，不能修改资料')} style={{ marginBottom: 12 }} />
              ) : null}
              <MaDesc label={t('支付渠道')}>{formatPayChannel(detail.payChannel, t)}</MaDesc>
              <MaDesc label={t('进件编号')}>{detail.businessCode || '-'}</MaDesc>
              <MaDesc label={t('申请单号')}>{detail.applymentId || '-'}</MaDesc>
              {detail.subMchId ? <MaDesc label={t('子商户号')}>{detail.subMchId}</MaDesc> : null}
              {canSignApplication(detail) ? (
                <MaDesc label={t('签约链接')}>
                  <a href={detail.signUrl} target="_blank" rel="noopener noreferrer" style={{ wordBreak: 'break-all' }}>
                    {detail.signUrl}
                  </a>
                  <Button theme="borderless" type="primary" size="small" style={{ marginLeft: 8 }} onClick={() => void copySignUrl()}>
                    {t('复制')}
                  </Button>
                </MaDesc>
              ) : null}
              {detail.rejectReason && detail.status !== 'FINISH' ? (
                <MaDesc label={detail.reasonLabel || t('失败原因')}>
                  <Typography.Text type="danger">{detail.rejectReason}</Typography.Text>
                </MaDesc>
              ) : null}
            </MaSection>

            <MaSection title={t('主体信息')}>
              <MaDesc label={t('主体类型')}>{formatOrganizationType(organizationType, t)}</MaDesc>
              <MaDesc label={t('店铺')}>{detail.applicantName || detail.shopName || fields.shopId || '-'}</MaDesc>
              {!isPersonal ? <MaDesc label={t('营业执照号')}>{fields.businessLicenseNumber || '-'}</MaDesc> : null}
              <MaDesc label={merchantNameLabel}>{fields.merchantName || '-'}</MaDesc>
              {!isPersonal ? <MaDesc label={t('法人/经营者姓名')}>{fields.legalPerson || '-'}</MaDesc> : null}
              {!isPersonal ? <MaDesc label={t('营业执照有效期开始')}>{fields.licensePeriodBegin || '-'}</MaDesc> : null}
              {!isPersonal ? <MaDesc label={t('营业执照有效期结束')}>{fields.licensePeriodEnd || '-'}</MaDesc> : null}
              {!isPersonal ? <MaDesc label={t('营业执照照片')}>{renderCert(1, fields.licenseCopy || detail.licenseCopy || '')}</MaDesc> : null}
            </MaSection>

            <MaSection title={t('法人/经营者身份信息')}>
              <MaDesc label={t('身份证姓名')}>{fields.idCardName || '-'}</MaDesc>
              <MaDesc label={t('身份证号码')}>{fields.idCardNumber || '-'}</MaDesc>
              <MaDesc label={t('身份证有效期开始')}>{fields.cardPeriodBegin || '-'}</MaDesc>
              <MaDesc label={t('身份证有效期结束')}>{fields.cardPeriodEnd || '-'}</MaDesc>
              <MaDesc label={t('身份证人像面')}>{renderCert(2, fields.idCardCopy || detail.idCardCopy || '')}</MaDesc>
              <MaDesc label={t('身份证国徽面')}>{renderCert(3, fields.idCardNational || detail.idCardNational || '')}</MaDesc>
            </MaSection>

            <MaSection title={t('经营信息')}>
              <MaDesc label={t('商户简称')}>{fields.merchantShortName || '-'}</MaDesc>
              <MaDesc label={t('客服电话')}>{fields.servicePhone || '-'}</MaDesc>
              <MaDesc label={t('店铺Url')}>{fields.storeUrl || '-'}</MaDesc>
            </MaSection>

            <MaSection title={t('结算信息')}>
              <MaDesc label={t('结算规则ID')}>{fields.settlementId || '-'}</MaDesc>
              <MaDesc label={t('所属行业')}>{fields.qualificationType || '-'}</MaDesc>
              <MaDesc label={t('银行账户类型')}>{formatBankAccountType(fields.bankAccountType, t)}</MaDesc>
              <MaDesc label={fields.bankAccountType === BANK_CORPORATE ? t('对公账户名称') : t('银行账户名称')}>{fields.bankAccountName || '-'}</MaDesc>
              <MaDesc label={t('银行账号')}>{fields.bankAccountNumber || '-'}</MaDesc>
              <MaDesc label={t('开户银行')}>{fields.bankName || '-'}</MaDesc>
              <MaDesc label={t('开户支行')}>{fields.bankBranchName || '-'}</MaDesc>
              {isWechat ? <MaDesc label={t('联行号')}>{fields.bankBranchId || '-'}</MaDesc> : null}
            </MaSection>

            <MaSection title={t('超级管理员信息')}>
              <MaDesc label={t('超管类型')}>{formatContactType(fields.contactType, t)}</MaDesc>
              <MaDesc label={t('联系人姓名')}>{fields.contactName || '-'}</MaDesc>
              <MaDesc label={t('超管身份证号')}>{fields.contactIdNumber || '-'}</MaDesc>
              <MaDesc label={t('联系人手机')}>{fields.contactPhone || '-'}</MaDesc>
              <MaDesc label={t('联系人邮箱')}>{fields.contactEmail || '-'}</MaDesc>
            </MaSection>

            <MaSection title={t('时间信息')}>
              <MaDesc label={t('创建时间')}>{detail.createTime || '-'}</MaDesc>
              <MaDesc label={t('更新时间')}>{detail.modifyTime || '-'}</MaDesc>
            </MaSection>
          </div>
        ) : !loading ? (
          <Typography.Text type="tertiary">{t('暂无数据')}</Typography.Text>
        ) : null}
      </Spin>
    </SideSheet>
  );
}

// ——————————————————————————————————————————————
// 审核：驳回（原版 RejectForm.vue）/ 放弃申请
// ——————————————————————————————————————————————

function RejectModal({ target, onClose, onChanged, onView }: {
  target: { id: number | string; seq: number };
  onClose: () => void;
  onChanged: () => void;
  onView: (id: number | string) => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const text = reason.trim();
    if (!text) {
      Toast.warning({ content: t('请填写驳回原因') });
      return;
    }
    setBusy(true);
    try {
      const current = await getApplicationDetail(target.id);
      if (!applicationActions(current).reject) throw new Error(t('申请状态已变化，请查看最新详情'));
      await rejectApplication(target.id, text);
      Toast.success({ content: t('已拒绝') });
      onChanged();
      onView(target.id);
      onClose();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('审核拒绝')}
      visible
      width={480}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={busy} onClick={() => void submit()}>
            {t('确认拒绝')}
          </Button>
        </Space>
      }
    >
      <div>
        <div style={{ marginBottom: 8, fontSize: 14 }}>{t('驳回原因')}</div>
        <TextArea rows={4} maxLength={500} value={reason} placeholder={t('请填写驳回原因，将展示给申请方')} onChange={setReason} />
      </div>
    </Modal>
  );
}

function AbandonModal({ target, onClose, onChanged, onView }: {
  target: MerchantApplicationItem;
  onClose: () => void;
  onChanged: () => void;
  onView: (id: number | string) => void;
}) {
  const { t } = useI18n();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const text = reason.trim();
    if (!text || text.length > 500) {
      Toast.warning({ content: t('请填写 1～500 字的放弃原因') });
      return;
    }
    if (!target.id) return;
    setBusy(true);
    try {
      const latest = await getApplicationDetail(target.id);
      if (!applicationActions(latest).abandon) throw new Error(t('申请状态已变化，请查看最新详情'));
      await abandonApplication(target.id, text);
      Toast.success({ content: t('操作成功') });
      onChanged();
      onView(target.id);
      onClose();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
      onChanged();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title={t('放弃申请')}
      visible
      width={520}
      onCancel={onClose}
      footer={
        <Space>
          <Button onClick={onClose}>{t('取消')}</Button>
          <Button theme="solid" type="primary" loading={busy} onClick={() => void submit()}>
            {t('确认放弃')}
          </Button>
        </Space>
      }
    >
      <div style={{ marginBottom: 8, fontSize: 13, lineHeight: 1.7, color: 'var(--semi-color-text-1)' }}>
        {t('放弃后本系统将停止跟进该申请，该操作不会撤销微信侧申请。请填写放弃原因。')}
      </div>
      <TextArea rows={4} maxLength={500} value={reason} placeholder={t('请填写 1～500 字的放弃原因')} onChange={setReason} />
    </Modal>
  );
}

// ——————————————————————————————————————————————
// 进件管理列表（原版 ManageList.vue + ApplicationActions.vue）
// ——————————————————————————————————————————————

const APPLICATION_PAGE_SIZE = 10;

export function MerchantApplications() {
  const { t } = useI18n();
  const [applicantType, setApplicantType] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [statuses, setStatuses] = useState<string[]>([]);
  const [applied, setApplied] = useState<{ applicantType: string; shopId: string; applicantId: string; status: string; statusList: string }>({
    applicantType: '',
    shopId: '',
    applicantId: '',
    status: '',
    statusList: '',
  });
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<MerchantApplicationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<number | string | undefined>();

  const [detailTarget, setDetailTarget] = useState<{ id: number | string; seq: number } | null>(null);
  const [formTarget, setFormTarget] = useState<{ act: SubmitAct; id?: number | string } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ id: number | string; seq: number } | null>(null);
  const [abandonTarget, setAbandonTarget] = useState<MerchantApplicationItem | null>(null);

  const canSubmit = isPlatformAdmin();
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    listApplications({
      page,
      size: APPLICATION_PAGE_SIZE,
      sortField: '',
      sortOrder: '',
      ...applied,
    })
      .then((result) => {
        if (!alive) return;
        const records = result.records || [];
        const totalCount = Number(result.total || 0);
        setRows(records);
        setTotal(totalCount);
        if (!records.length && page > 1 && totalCount > 0) setPage(Math.max(1, Math.ceil(totalCount / APPLICATION_PAGE_SIZE)));
      })
      .catch((error) => {
        if (alive) Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, applied, reloadKey]);

  const search = () => {
    setPage(1);
    setApplied({
      applicantType,
      shopId: applicantType === 'VENDOR' ? '' : subjectId,
      applicantId: applicantType === 'VENDOR' ? subjectId : '',
      status: statuses.length === 1 ? statuses[0] : '',
      statusList: statuses.length > 1 ? statuses.join(',') : '',
    });
  };

  const reset = () => {
    setApplicantType('');
    setSubjectId('');
    setStatuses([]);
    setPage(1);
    setApplied({ applicantType: '', shopId: '', applicantId: '', status: '', statusList: '' });
  };

  const showDetail = useCallback((id: number | string) => {
    setDetailTarget((prev) => ({ id, seq: (prev?.seq || 0) + 1 }));
  }, []);

  const onSubmitted = useCallback(
    (row: MerchantApplicationItem) => {
      setFormTarget(null);
      reload();
      if (row?.id) showDetail(row.id);
    },
    [reload, showDetail],
  );

  const runApplicationAction = useCallback(
    async (action: 'retry' | 'approve' | 'refresh', id: number | string) => {
      setBusyId(id);
      let attempted = false;
      try {
        attempted = true;
        const latest = await getApplicationDetail(id);
        if (!applicationActions(latest)[action]) {
          Toast.warning({ content: t('申请状态已变化，请查看最新详情') });
          showDetail(id);
          return;
        }
        if (action === 'retry') {
          const result = await retryApplication(id);
          Toast.success({ content: t('操作成功') });
          reload();
          showDetail(result?.id ?? id);
        } else {
          if (action === 'approve') await approveApplication(id);
          else await refreshApplication(id);
          reload();
          showDetail(id);
        }
      } catch (error) {
        Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        if (attempted) {
          reload();
          showDetail(id);
        }
      } finally {
        setBusyId(undefined);
      }
    },
    [reload, showDetail],
  );

  const getRowActions = (row: MerchantApplicationItem): Array<{ key: string; label: string }> => {
    const flags = applicationActions(row);
    const items: Array<{ key: string; label: string }> = [{ key: 'detail', label: t('详情') }];
    if (flags.edit) items.push({ key: 'edit', label: t('修改并提交') });
    if (flags.reapply) items.push({ key: 'reapply', label: t('重新申请') });
    if (flags.retry) items.push({ key: 'retry', label: t('重试提交') });
    if (flags.abandon) items.push({ key: 'abandon', label: t('放弃申请') });
    if (flags.delete) items.push({ key: 'delete', label: t('删除记录') });
    if (flags.approve) items.push({ key: 'approve', label: t('通过并提交进件') });
    if (flags.reject) items.push({ key: 'reject', label: t('拒绝') });
    if (canSignApplication(row)) items.push({ key: 'sign', label: t('签约链接') });
    if (flags.refresh) items.push({ key: 'refresh', label: t('刷新状态') });
    return items;
  };

  const runRowAction = (key: string, row: MerchantApplicationItem) => {
    const id = row.id;
    if (!id || busyId !== undefined) return;
    if (key === 'detail') return showDetail(id);
    if (key === 'edit') return setFormTarget({ act: 'edit', id });
    if (key === 'reapply') return setFormTarget({ act: 'reapply', id });
    if (key === 'reject') return setRejectTarget({ id, seq: (rejectTarget?.seq || 0) + 1 });
    if (key === 'abandon') return setAbandonTarget(row);
    if (key === 'sign') {
      void (async () => {
        try {
          await navigator.clipboard.writeText(row.signUrl || '');
          Toast.success({ content: t('已复制签约链接') });
        } catch {
          Toast.error({ content: t('复制失败') });
        }
      })();
      return;
    }
    if (key === 'delete') {
      Modal.confirm({
        title: t('删除记录'),
        content: t('删除后该记录将不再展示，历史申请和证件仍保留。此操作不会删除微信侧申请。'),
        onOk: async () => {
          try {
            const latest = await getApplicationDetail(id);
            if (!applicationActions(latest).delete) throw new Error(t('申请状态已变化，请查看最新详情'));
            await deleteApplicationRecord(id);
            Toast.success({ content: t('操作成功') });
            reload();
          } catch (error) {
            Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
            reload();
            showDetail(id);
          }
        },
      });
      return;
    }
    if (key === 'approve') {
      Modal.confirm({
        title: t('审核通过'),
        content: t('确认审核通过并提交进件吗？'),
        onOk: () => runApplicationAction('approve', id),
      });
      return;
    }
    if (key === 'retry' || key === 'refresh') void runApplicationAction(key, id);
  };

  const statusCell = (row: MerchantApplicationItem) => {
    const abandoned = isAbandoned(row);
    const text = abandoned ? t('已放弃（本地）') : row.statusDesc || statusLabelText(row.status, t) || row.status || '-';
    const tag = <Tag color={STATUS_TAG_COLOR[abandoned ? 'ABANDONED' : row.status || ''] || 'grey'} type="light">{text}</Tag>;
    if (row.rejectReason && row.status !== 'FINISH') {
      return (
        <Tooltip content={`${row.reasonLabel || t('失败原因')}：${row.rejectReason}`}>
          <span>{tag}</span>
        </Tooltip>
      );
    }
    return tag;
  };

  type MaColumn = ColumnConfig<MerchantApplicationItem> & { fixed?: 'left' | 'right' };
  const columns: MaColumn[] = [
    {
      title: t('店铺/供应商'),
      dataIndex: 'applicantName',
      width: 180,
      fixed: 'left',
      render: (_value: unknown, row) => <span>{row.applicantName || row.shopName || row.merchantName || '-'}</span>,
    },
    {
      title: t('组织类型'),
      dataIndex: 'applicantType',
      width: 100,
      render: (value: string) => <span>{value === 'VENDOR' ? t('供应商') : t('店铺')}</span>,
    },
    {
      title: t('商户名称'),
      dataIndex: 'merchantName',
      width: 200,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: t('支付渠道'),
      dataIndex: 'payChannel',
      width: 90,
      render: (value: string) => <span>{formatPayChannel(value, t)}</span>,
    },
    {
      title: t('主体类型'),
      dataIndex: 'organizationType',
      width: 110,
      render: (value: string) => <span>{formatOrganizationType(value, t)}</span>,
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 150,
      render: (_value: unknown, row) => statusCell(row),
    },
    {
      title: t('子商户号'),
      dataIndex: 'subMchId',
      width: 150,
      render: (value: string) => <span>{value || '—'}</span>,
    },
    {
      title: t('申请时间'),
      dataIndex: 'createTime',
      width: 170,
      render: (value: string) => <span>{value || '-'}</span>,
    },
    {
      title: t('操作'),
      dataIndex: 'actions',
      width: 320,
      fixed: 'right',
      render: (_value: unknown, row) => {
        const items = getRowActions(row);
        const busy = busyId === row.id;
        const head = items.slice(0, 3);
        const tail = items.slice(3);
        return (
          <Space spacing={4}>
            {head.map((item) => (
              <Button key={item.key} theme="borderless" type="primary" size="small" disabled={busy} onClick={() => runRowAction(item.key, row)}>
                {item.label}
              </Button>
            ))}
            {tail.length > 0 ? (
              <Dropdown
                trigger="click"
                position="bottomRight"
                render={
                  <Dropdown.Menu>
                    {tail.map((item) => (
                      <Dropdown.Item key={item.key} disabled={busy} onClick={() => runRowAction(item.key, row)}>
                        {item.label}
                      </Dropdown.Item>
                    ))}
                  </Dropdown.Menu>
                }
              >
                <Button theme="borderless" type="primary" size="small" disabled={busy}>
                  {t('更多')}
                </Button>
              </Dropdown>
            ) : null}
          </Space>
        );
      },
    },
  ];

  return (
    <>
      <Card className="table-card" shadows="hover">
        <div className="table-toolbar">
          <Space wrap>
            <Select
              placeholder={t('组织类型')}
              showClear
              style={{ width: 150 }}
              optionList={[
                { label: t('店铺'), value: 'SHOP' },
                { label: t('供应商'), value: 'VENDOR' },
              ]}
              value={applicantType || undefined}
              onChange={(next) => {
                setApplicantType(String(next ?? ''));
                setSubjectId('');
              }}
            />
            {applicantType === 'VENDOR' ? (
              <RemoteSelect fetchOptions={fetchVendorOptions} value={subjectId} onChange={setSubjectId} placeholder={t('请输入供应商名称')} />
            ) : (
              <RemoteSelect fetchOptions={fetchShopOptions} value={subjectId} onChange={setSubjectId} placeholder={t('请输入店铺名称')} />
            )}
            <Select
              placeholder={t('请选择状态')}
              showClear
              multiple
              maxTagCount={2}
              style={{ width: 260 }}
              optionList={STATUS_OPTIONS.map((option) => ({ ...option, label: t(option.label) }))}
              value={statuses}
              onChange={(next) => setStatuses((next as string[]) || [])}
            />
            <Button theme="solid" type="primary" icon={<IconSearch />} onClick={search}>
              {t('搜索')}
            </Button>
            <Button onClick={reset}>{t('重置')}</Button>
          </Space>
          <Space>
            {canSubmit ? (
              <Button theme="solid" type="primary" icon={<IconPlus />} onClick={() => setFormTarget({ act: 'add' })}>
                {t('提交进件')}
              </Button>
            ) : null}
            <Button icon={<IconRefresh />} onClick={reload}>
              {t('刷新')}
            </Button>
          </Space>
        </div>
        <Table
          loading={loading}
          dataSource={rows}
          rowKey="id"
          columns={columns as any}
          scroll={{ x: 1480 }}
          pagination={{
            currentPage: page,
            pageSize: APPLICATION_PAGE_SIZE,
            total,
            onChange: (nextPage: number) => setPage(nextPage),
          }}
        />
      </Card>

      {detailTarget ? <ApplicationDetailSheet key={`${detailTarget.id}-${detailTarget.seq}`} target={detailTarget} onClose={() => setDetailTarget(null)} /> : null}
      {formTarget ? (
        <SubmitFormModal
          key={`${formTarget.act}-${formTarget.id ?? 'new'}`}
          visible
          act={formTarget.act}
          id={formTarget.id}
          onClose={() => setFormTarget(null)}
          onSubmitted={onSubmitted}
          onChanged={reload}
        />
      ) : null}
      {rejectTarget ? (
        <RejectModal
          key={`${rejectTarget.id}-${rejectTarget.seq}`}
          target={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onChanged={reload}
          onView={showDetail}
        />
      ) : null}
      {abandonTarget ? (
        <AbandonModal
          key={String(abandonTarget.id)}
          target={abandonTarget}
          onClose={() => setAbandonTarget(null)}
          onChanged={reload}
          onView={showDetail}
        />
      ) : null}
    </>
  );
}

export function SubMerchants() {
  return (
    <Simple
      api="/finance/subMerchant/list"
      label="商户名称"
      columns={[
        { title: '商户名称', dataIndex: 'merchantName' },
        { title: '子商户号', dataIndex: 'subMerchantNo' },
        { title: '支付渠道', dataIndex: 'channelText', width: 120 },
        { title: '状态', dataIndex: 'statusText', width: 100 },
        { title: '创建时间', dataIndex: 'createTime', width: 170 },
      ]}
    />
  );
}

export function ProfitSharing() {
  return (
    <Simple
      api="/finance/profitSharing/list"
      label="分账单号"
      columns={[
        { title: '分账单号', dataIndex: 'outOrderNo' },
        { title: '订单号', dataIndex: 'orderSn' },
        { title: '分账金额', dataIndex: 'amount', width: 120 },
        { title: '分账状态', dataIndex: 'statusText', width: 120 },
        { title: '创建时间', dataIndex: 'createTime', width: 170 },
      ]}
    />
  );
}

export function StatementDownload() {
  return (
    <Simple
      api="/finance/statement/getStatementStatisticsList"
      rowKey="invoiceId"
      label="日期"
      columns={[
        { title: '日期', dataIndex: 'statementDate', width: 160 },
        { title: '账户', dataIndex: 'accountType', width: 140 },
        { title: '收入', dataIndex: 'income', width: 150 },
        { title: '支出', dataIndex: 'expenditure', width: 150 },
      ]}
    />
  );
}

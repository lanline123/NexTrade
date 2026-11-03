import { useMemo, useState, type ReactNode } from 'react';
import {
  Avatar,
  Button,
  Card,
  Image,
  Modal,
  Popconfirm,
  Space,
  Spin,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { apiGet, apiPost, isDemo } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import './user-certifications.css';

/**
 * 会员认证：对应旧版 java/view/admin/src/views/user/userCertification/
 * （List.vue 列表 + Info.vue 详情审核 + src/SelectConfig.vue 状态 Tab）。
 *
 * 会员提交的个人/企业认证申请（user_company）：状态 Tab（全部/待审核/审核通过/审核未通过）
 * + 客户名称搜索 + 列表 + 详情弹窗（基础信息/企业信息两个 Tab）+ 审核（通过/不通过）+
 * 删除（仅已拒绝）+ 批量删除。
 *
 * 旧版字段映射备注（tools/audit-admin-page 对照项）：
 * - 列表列 prop companyData.corporateName / companyData.contactPhone 在本页经
 *   row.companyData?.corporateName / row.companyData?.contactPhone 读取；
 * - 旧 Info.vue 的「性别」（companyData.sex）一项在旧版即已被注释下线，
 *   且 Rust 后端 CompanyDataVO 不下发 sex，故新版不再展示。
 */

interface CompanyPhoto {
  picName?: string;
  picThumb?: string;
  picUrl?: string;
}

interface UserCompanyRow {
  id: number;
  userId?: number;
  /** 认证类型：1 个人 2 企业 */
  type?: number;
  contactName?: string;
  contactMobile?: string;
  companyName?: string;
  /** 审核状态：1 待审核 2 审核通过 3 审核不通过 */
  status?: number;
  statusText?: string;
  auditRemark?: string;
  auditTime?: string;
  addTime?: string;
  username?: string;
  isCompanyAuth?: number;
  companyData?: {
    corporateName?: string;
    companyName?: string;
    contactPhone?: string;
    documentType?: number;
    documentNumber?: string;
    residentialAddress?: string;
    birthday?: string;
    certificateValidityPeriod?: number;
    certificateValidityPeriodDate?: string[] | null;
    certificateValidityPeriodEnd?: string | null;
    frontOfPhoto?: CompanyPhoto[] | null;
    backOfPhoto?: CompanyPhoto[] | null;
  } | null;
  user?: {
    userId?: number;
    username?: string;
    mobile?: string;
    isCompanyAuth?: number;
  } | null;
}

interface UserCompanyDetail {
  id?: number;
  userId?: number;
  type?: number;
  contactName?: string;
  contactMobile?: string;
  companyName?: string;
  status?: number;
  statusText?: string;
  typeText?: string;
  auditRemark?: string;
  auditTime?: string;
  addTime?: string;
  username?: string;
  companyData?: {
    corporateName?: string;
    companyName?: string;
    contactPhone?: string;
    documentType?: number;
    documentNumber?: string;
    residentialAddress?: string;
    birthday?: string;
    certificateValidityPeriod?: number;
    certificateValidityPeriodDate?: string[] | null;
    certificateValidityPeriodEnd?: string | null;
    frontOfPhoto?: CompanyPhoto[] | null;
    backOfPhoto?: CompanyPhoto[] | null;
    /** 以下 7 项仅详情返回（列表 companyData 白名单不含） */
    licenseAddrProvinceName?: string | null;
    businessScope?: string | null;
    businessLicenseId?: string | null;
    operatingTermType?: number | null;
    operatingTermTypeDate?: string[] | null;
    operatingTermTypeEnd?: string | null;
    businessLicenseImg?: CompanyPhoto[] | null;
  } | null;
  user?: UserCompanyRow['user'];
}

const STATUS_TABS = [
  { value: 0, label: '全部' },
  { value: 1, label: '待审核' },
  { value: 2, label: '审核通过' },
  { value: 3, label: '审核未通过' },
];

/** 旧 StatusDot 配色：1 默认蓝+闪烁，2 绿+闪烁，3 红+常亮 */
const STATUS_DOT_META: Record<number, { color: string; flicker: boolean }> = {
  1: { color: '#1890ff', flicker: true },
  2: { color: '#52c41a', flicker: true },
  3: { color: '#f5222d', flicker: false },
};

const DOCUMENT_TYPE_OPTIONS = [
  { value: 1, label: '大陆身份证' },
  { value: 2, label: '护照（限境外人士）' },
  { value: 3, label: '来往内地通行证（中国香港居民）' },
  { value: 4, label: '来往内地通行证（中国澳门居民）' },
  { value: 5, label: '来往大陆通行证（中国台湾居民）' },
];

const documentTypeLabel = (
  value: number | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
) => {
  const label = DOCUMENT_TYPE_OPTIONS.find((option) => option.value === Number(value))?.label || '';
  return label ? t(label) : '';
};

const orDash = (value?: string | null) => (value ? value : '-');

/** 证件/营业期限：类型 1 为区间，否则「结束日期～ 长期」 */
const validityText = (
  periodType: number | null | undefined,
  range: string[] | null | undefined,
  end: string | null | undefined,
  t: (key: string, params?: Record<string, string | number>) => string,
) => {
  if (Number(periodType) === 1) {
    return `${range?.[0] || ''} ～ ${range?.[1] || ''}`;
  }
  return `${end || ''}～ ${t('长期')}`;
};

const firstPicUrl = (photos?: CompanyPhoto[] | null) => photos?.[0]?.picUrl || '';

function StatusDot({ status }: { status?: number }) {
  const meta = STATUS_DOT_META[Number(status)];
  if (!meta) return null;
  return (
    <span
      className={meta.flicker ? 'uc-status-dot is-flicker' : 'uc-status-dot'}
      style={{ backgroundColor: meta.color }}
    />
  );
}

function StatusText({ status, text }: { status?: number; text?: string }) {
  const { t } = useI18n();
  return (
    <span className="uc-status-text">
      <StatusDot status={status} />
      {text ? t(text) : text}
    </span>
  );
}

function CertTypeTag({ type }: { type?: number }) {
  const { t } = useI18n();
  return Number(type) === 1 ? <Tag color="grey">{t('个人')}</Tag> : <Tag color="blue">{t('企业')}</Tag>;
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="uc-detail-row">
      <label>{label}</label>
      <div className="uc-detail-value">{children}</div>
    </div>
  );
}

function PicImage({ photos }: { photos?: CompanyPhoto[] | null }) {
  const url = firstPicUrl(photos);
  if (!url) return <span>-</span>;
  return <Image src={url} width={80} height={80} style={{ objectFit: 'cover' }} />;
}

export default function UserCertifications() {
  const { t } = useI18n();
  const [statusTab, setStatusTab] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);

  // 详情 + 审核弹窗
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detail, setDetail] = useState<UserCompanyDetail | null>(null);
  const [activeKey, setActiveKey] = useState('sm');
  const [auditRemark, setAuditRemark] = useState('');
  const [auditing, setAuditing] = useState(false);

  const reload = () => setReloadKey((key) => key + 1);

  // 「全部」不传 status（后端 status=0 不过滤），其余按 Tab 值过滤
  const listQuery = useMemo<Record<string, unknown>>(
    () => ({ status: statusTab === 0 ? undefined : statusTab }),
    [statusTab],
  );

  const openDetail = (row: UserCompanyRow) => {
    setActiveKey('sm');
    setAuditRemark('');
    setDetail(null);
    setDetailLoading(!isDemo());
    setDetailOpen(true);
    if (isDemo()) {
      setDetail(row as UserCompanyDetail);
      return;
    }
    apiGet<UserCompanyDetail>('/user/userCompany/detail', { id: row.id })
      .then((result) => {
        setDetail(result);
        setAuditRemark(result?.auditRemark || '');
      })
      .catch((error) => {
        Toast.error({ content: error instanceof Error ? error.message : t('请求失败') });
        setDetailOpen(false);
      })
      .finally(() => setDetailLoading(false));
  };

  const submitAudit = async (status: number) => {
    if (!detail?.id) return;
    if (status === 3 && !auditRemark.trim()) {
      Toast.error({ content: t('请输入审核备注') });
      return;
    }
    setAuditing(true);
    try {
      await apiPost('/user/userCompany/audit', { id: detail.id, status, auditRemark });
      Toast.success({ content: t('操作成功') });
      setDetailOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setAuditing(false);
    }
  };

  const deleteRow = async (row: UserCompanyRow) => {
    try {
      await apiPost('/user/userCompany/del', { id: row.id });
      Toast.success({ content: t('删除成功') });
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
    }
  };

  const detailData: NonNullable<UserCompanyDetail['companyData']> = detail?.companyData || {};

  const columns: ColumnConfig<UserCompanyRow>[] = [
    {
      title: '申请信息',
      dataIndex: 'companyName',
      width: 250,
      render: (_: unknown, row: UserCompanyRow) => (
        <span className="uc-apply-info">
          <CertTypeTag type={row.type} />
          <span>
            {Number(row.type) === 1
              ? orDash(row.companyData?.corporateName)
              : orDash(row.companyData?.companyName)}
          </span>
        </span>
      ),
    },
    {
      title: '申请客户名称',
      dataIndex: 'username',
      width: 200,
      render: (_: unknown, row: UserCompanyRow) =>
        row.username ? (
          <Space spacing={6}>
            <Avatar size="small" alt={row.username}>
              {row.username.slice(0, 1)}
            </Avatar>
            <span>{row.username}</span>
          </Space>
        ) : (
          <span>-</span>
        ),
    },
    {
      title: '联系人姓名',
      dataIndex: 'corporateName',
      render: (_: unknown, row: UserCompanyRow) => <span>{orDash(row.companyData?.corporateName)}</span>,
    },
    {
      title: '联系人电话',
      dataIndex: 'contactPhone',
      render: (_: unknown, row: UserCompanyRow) => <span>{orDash(row.companyData?.contactPhone)}</span>,
    },
    {
      title: '申请状态',
      dataIndex: 'statusText',
      width: 130,
      render: (_: unknown, row: UserCompanyRow) => (
        <StatusText status={row.status} text={row.statusText} />
      ),
    },
    {
      title: '申请日期',
      dataIndex: 'addTime',
      width: 170,
    },
  ];

  return (
    <div className="user-certifications-page">
      <Card className="table-card uc-status-card" shadows="hover">
        <div className="uc-status-bar">
          <Tabs
            type="button"
            size="small"
            activeKey={String(statusTab)}
            onChange={(key: string) => setStatusTab(Number(key))}
            tabList={STATUS_TABS.map((tab) => ({ tab: t(tab.label), itemKey: String(tab.value) }))}
          />
          <Typography.Text type="tertiary" size="small">
            {t('审核会员提交的个人/企业认证申请，通过后该会员将标记为已企业认证。')}
          </Typography.Text>
        </div>
      </Card>

      <ListPage<UserCompanyRow>
        key={reloadKey}
        api="/user/userCompany/list"
        rowKey="id"
        pageSize={10}
        selectable
        actionWidth={140}
        query={listQuery}
        filters={[
          { field: 'username', label: '客户名称', type: 'input', placeholder: '输入客户名称' },
        ]}
        columns={columns}
        batchActions={(rows, clear) => (
          <Button
            size="small"
            onClick={() => {
              Modal.confirm({
                title: t('您确认要批量删除所选数据吗？'),
                onOk: async () => {
                  try {
                    await apiPost('/user/userCompany/batch', {
                      type: 'del',
                      ids: rows.map((row) => row.id),
                    });
                    Toast.success({ content: t('批量删除成功') });
                    clear();
                    reload();
                  } catch (error) {
                    Toast.error({ content: error instanceof Error ? error.message : t('批量删除失败') });
                  }
                },
              });
            }}
          >
            {t('批量删除')}
          </Button>
        )}
        rowActions={(row) => (
          <Space spacing={2}>
            <Button theme="borderless" size="small" onClick={() => openDetail(row)}>
              {t('详情')}
            </Button>
            {Number(row.status) === 3 ? (
              <Popconfirm title={t('您确认要删除该数据吗？')} onConfirm={() => deleteRow(row)}>
                <Button theme="borderless" type="danger" size="small">
                  {t('删除')}
                </Button>
              </Popconfirm>
            ) : null}
          </Space>
        )}
      />

      <Modal
        title={t('申请详情')}
        visible={detailOpen}
        footer={null}
        width={640}
        onCancel={() => setDetailOpen(false)}
      >
        <Spin spinning={detailLoading}>
          <Tabs
            activeKey={activeKey}
            onChange={(key: string) => setActiveKey(key)}
            tabList={[
              { tab: t('基础信息'), itemKey: 'sm' },
              ...(Number(detail?.type) === 2 ? [{ tab: t('企业信息'), itemKey: 'company' }] : []),
            ]}
          />
          {activeKey === 'company' ? (
            <div className="uc-detail">
              <DetailRow label={t('企业名称')}>{orDash(detailData.companyName)}</DetailRow>
              <DetailRow label={t('注册地址')}>{orDash(detailData.licenseAddrProvinceName)}</DetailRow>
              <DetailRow label={t('经营范围')}>{orDash(detailData.businessScope)}</DetailRow>
              <DetailRow label={t('统一社会信用代码')}>{orDash(detailData.businessLicenseId)}</DetailRow>
              <DetailRow label={t('营业期限')}>
                {validityText(
                  detailData.operatingTermType,
                  detailData.operatingTermTypeDate,
                  detailData.operatingTermTypeEnd,
                  t,
                )}
              </DetailRow>
              <DetailRow label={t('营业执照')}>
                <PicImage photos={detailData.businessLicenseImg} />
              </DetailRow>
            </div>
          ) : (
            <div className="uc-detail">
              <DetailRow label={t('认证资质')}>
                <CertTypeTag type={detail?.type} />
              </DetailRow>
              <DetailRow label={t('审核结果')}>
                <StatusText status={detail?.status} text={detail?.statusText} />
              </DetailRow>
              {detail?.auditRemark && Number(detail?.status) !== 1 ? (
                <DetailRow label={t('审核备注')}>{detail.auditRemark}</DetailRow>
              ) : null}
              <DetailRow label={t('姓名')}>{orDash(detailData.corporateName)}</DetailRow>
              <DetailRow label={t('联系人手机')}>{orDash(detailData.contactPhone)}</DetailRow>
              <DetailRow label={t('证件类型')}>{orDash(documentTypeLabel(detailData.documentType, t))}</DetailRow>
              <DetailRow label={t('证件号码')}>{orDash(detailData.documentNumber)}</DetailRow>
              <DetailRow label={t('居住地址')}>{orDash(detailData.residentialAddress)}</DetailRow>
              <DetailRow label={t('出生日期')}>{orDash(detailData.birthday)}</DetailRow>
              <DetailRow label={t('证件有效期')}>
                {validityText(
                  detailData.certificateValidityPeriod,
                  detailData.certificateValidityPeriodDate,
                  detailData.certificateValidityPeriodEnd,
                  t,
                )}
              </DetailRow>
              <DetailRow label={t('证件照正面')}>
                <PicImage photos={detailData.frontOfPhoto} />
              </DetailRow>
              <DetailRow label={t('证件照反面')}>
                <PicImage photos={detailData.backOfPhoto} />
              </DetailRow>
              {Number(detail?.status) === 1 ? (
                <div className="uc-audit">
                  <Space>
                    <Button theme="solid" type="primary" loading={auditing} onClick={() => submitAudit(2)}>
                      {t('审核通过')}
                    </Button>
                    <Button loading={auditing} onClick={() => submitAudit(3)}>
                      {t('审核不通过')}
                    </Button>
                  </Space>
                  <TextArea
                    rows={4}
                    placeholder={t('请输入审核备注（审核不通过将必填）')}
                    value={auditRemark}
                    onChange={setAuditRemark}
                  />
                </div>
              ) : null}
            </div>
          )}
        </Spin>
      </Modal>
    </div>
  );
}

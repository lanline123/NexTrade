import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Descriptions,
  Input,
  Modal,
  Pagination,
  Popconfirm,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost, getToken } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import ImageUploader from '../components/ImageUploader';
import type { ColumnConfig } from '../framework/types';
import './finance-statement.css';

const { Text } = Typography;

/**
 * 对账单明细（statementDetails / vendorStatementDetails，两菜单键共用本组件）。
 *
 * 旧页 finance/shopFunds/statementDetails/List.vue 契约：
 * - 接口 GET /finance/statement/getStatementList（Rust statement.rs 已实现），
 *   GET /finance/statement/getStatementQueryConfig（下拉选项配置），
 *   GET /finance/statement/exportStatement（导出 xlsx）。
 * - 筛选：timeType(1 入账时间/2 下单时间)、店铺 shopId 或供应商 vendorId、
 *   startDateTime/endDateTime + 今天/昨天/近7天/近30天/近半年 快捷、
 *   accountType（入账类型）、type（类型，全部+statementType）、
 *   paymentType（支付方式）、recordSn（单号）、source(shop/vendor)。
 * - 列：类型 typeName / 入账时间 settlementTime / 店铺名称 shopName（供应商页为
 *   供应商名称 vendorName）/ 业务单号 recordSn / 入账类型 accountTypeName /
 *   金额 amount / 余额 accountBalance / 支付方式 paymentType。
 *   旧列头模板 `${$t('金额')}（${config.config.dollarSignCn}）` 与
 *   `${$t('余额')}（${config.config.dollarSignCn}）` 展开后即 `金额（元）` 与 `余额（元）。
 *
 * 查询参数对齐 Rust StatementListQuery（camelCase）：
 * page/size/timeType/accountType/type/paymentType/recordSn/shopId/vendorId/
 * startDateTime/endDateTime/source。
 */

interface StatementConfigOption {
  code?: string | number;
  description?: string;
}

interface StatementQueryConfig {
  accountType?: StatementConfigOption[];
  statementType?: StatementConfigOption[];
  payMethodType?: StatementConfigOption[];
}

interface StatementRow {
  invoiceId: number;
  typeName?: string;
  settlementTime?: string;
  shopName?: string;
  vendorName?: string;
  recordSn?: string;
  accountTypeName?: string;
  amount?: number | string;
  accountBalance?: number | string;
  paymentType?: string;
  paymentTypeName?: string;
}

/** 本地 YYYY-MM-DD（与旧 formattedDate(…,"YYYY-MM-DD") 等价，避免时区偏移） */
const fmtDate = (date: Date): string => {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
};

const daysAgo = (days: number): Date => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

/** 快捷日期档位（旧 dateType 0-4） */
const QUICK_DATE_OPTIONS = [
  { label: '今天', days: 0 },
  { label: '昨天', days: 1 },
  { label: '近7天', days: 7 },
  { label: '近30天', days: 30 },
  { label: '近半年', days: 180 },
];

const toOptionList = (config?: StatementConfigOption[]) =>
  (config || [])
    .filter((item) => item && item.code !== undefined && item.code !== null)
    .map((item) => ({ label: String(item.description ?? item.code), value: item.code as string | number }));

export function StatementDetails({ source = 'shop' }: { source?: 'shop' | 'vendor' }) {
  const { t } = useI18n();
  const isVendor = source === 'vendor';
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [queryConfig, setQueryConfig] = useState<StatementQueryConfig>({});
  const [accountType, setAccountType] = useState<string | number | undefined>(undefined);
  const [timeType, setTimeType] = useState<number>(1);
  const [statementType, setStatementType] = useState<number>(0);
  const [paymentType, setPaymentType] = useState<string>('');
  const [recordSn, setRecordSn] = useState<string>('');
  const [orgId, setOrgId] = useState<string>('');
  const [startDateTime, setStartDateTime] = useState<string>('');
  const [endDateTime, setEndDateTime] = useState<string>('');
  const [dateType, setDateType] = useState<number>(-1);
  const [reloadKey, setReloadKey] = useState(0);

  /** 查询字段配置（对齐旧 getStatementConfig：入账类型/类型/支付方式选项） */
  useEffect(() => {
    let alive = true;
    apiGet<StatementQueryConfig>('/finance/statement/getStatementQueryConfig')
      .then((config) => {
        if (!alive) return;
        setQueryConfig(config || {});
        // 旧页默认 accountType = accountType[0].code
        const first = (config?.accountType || [])[0];
        if (first && first.code !== undefined && first.code !== null) {
          setAccountType(first.code);
        }
      })
      .catch((error) => alive && Toast.error({ content: error instanceof Error ? error.message : t('加载查询配置失败') }));
    return () => {
      alive = false;
    };
  }, []);

  const loadList = useCallback(
    (nextPage: number) => {
      const params: Record<string, unknown> = {
        page: nextPage,
        size: 10,
        timeType,
        type: statementType,
        source,
      };
      if (accountType !== undefined && accountType !== '') params.accountType = accountType;
      if (paymentType) params.paymentType = paymentType;
      if (recordSn) params.recordSn = recordSn;
      if (isVendor && orgId) params.vendorId = orgId;
      if (!isVendor && orgId) params.shopId = orgId;
      if (startDateTime) params.startDateTime = startDateTime;
      if (endDateTime) params.endDateTime = endDateTime;
      let alive = true;
      setLoading(true);
      apiGet<{ records?: StatementRow[]; total?: number }>('/finance/statement/getStatementList', params)
        .then((result) => {
          if (!alive) return;
          setRows(result?.records || []);
          setTotal(result?.total || 0);
        })
        .catch((error) =>
          alive && Toast.error({ content: error instanceof Error ? error.message : t('请求失败') }),
        )
        .finally(() => {
          if (alive) setLoading(false);
        });
      return () => {
        alive = false;
      };
    },
    [accountType, endDateTime, isVendor, orgId, paymentType, recordSn, source, startDateTime, statementType, timeType],
  );

  useEffect(() => {
    const cancel = loadList(page);
    return cancel;
  }, [loadList, page, reloadKey]);

  const search = () => {
    setPage(1);
    setReloadKey((key) => key + 1);
  };

  const reset = () => {
    setTimeType(1);
    setStatementType(0);
    setPaymentType('');
    setRecordSn('');
    setOrgId('');
    setStartDateTime('');
    setEndDateTime('');
    setDateType(-1);
    const first = (queryConfig.accountType || [])[0];
    setAccountType(first && first.code !== undefined && first.code !== null ? first.code : undefined);
    setPage(1);
    setReloadKey((key) => key + 1);
  };

  /** 旧 changeDateType：快捷档位换算起止日期后立即查询 */
  const applyQuickDate = (event: number) => {
    const option = QUICK_DATE_OPTIONS[event];
    if (!option) return;
    const start = option.days === 0 ? new Date() : daysAgo(option.days);
    const end = option.days === 1 ? daysAgo(1) : new Date();
    setStartDateTime(fmtDate(start));
    setEndDateTime(fmtDate(end));
    setDateType(event);
    setPage(1);
    setReloadKey((key) => key + 1);
  };

  const buildExportParams = () => {
    const params = new URLSearchParams();
    const append = (key: string, value: unknown) => {
      if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
    };
    append('timeType', timeType);
    append('type', statementType);
    append('source', source);
    append('accountType', accountType);
    append('paymentType', paymentType);
    append('recordSn', recordSn);
    append(isVendor ? 'vendorId' : 'shopId', orgId);
    append('startDateTime', startDateTime);
    append('endDateTime', endDateTime);
    return params;
  };

  /** 导出报表：GET /finance/statement/exportStatement（Rust 返回 xlsx 文件流） */
  const exportStatement = async () => {
    setExporting(true);
    try {
      const res = await fetch(`/adminapi/finance/statement/exportStatement?${buildExportParams().toString()}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error(t('导出失败'));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = isVendor ? t('供应商对账单明细.xlsx') : t('对账单明细.xlsx');
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('导出失败') });
    } finally {
      setExporting(false);
    }
  };

  const accountTypeOptions = useMemo(() => toOptionList(queryConfig.accountType), [queryConfig]);
  const statementTypeOptions = useMemo(
    () => [{ label: t('全部'), value: 0 }, ...toOptionList(queryConfig.statementType)],
    [queryConfig, t],
  );
  const payMethodOptions = useMemo(() => toOptionList(queryConfig.payMethodType), [queryConfig]);

  const columns: ColumnConfig<StatementRow>[] = [
    {
      title: t('类型'),
      dataIndex: 'typeName',
      width: 120,
      render: (val: string) => <Tag color="blue">{val || '--'}</Tag>,
    },
    {
      title: t('入账时间'),
      dataIndex: 'settlementTime',
      width: 170,
      render: (val: string) => val || '--',
    },
    {
      title: t(isVendor ? '供应商名称' : '店铺名称'),
      dataIndex: isVendor ? 'vendorName' : 'shopName',
      width: 180,
      render: (val: string) => val || '--',
    },
    {
      title: t('业务单号'),
      dataIndex: 'recordSn',
      width: 200,
      render: (val: string) => <Text copyable={Boolean(val)}>{val || '--'}</Text>,
    },
    {
      title: t('入账类型'),
      dataIndex: 'accountTypeName',
      width: 130,
      render: (val: string) => val || '--',
    },
    {
      title: t('金额（元）'),
      dataIndex: 'amount',
      width: 130,
      render: (val: unknown, record) => {
        const text = record.amount === null || record.amount === undefined ? '--' : String(record.amount);
        return (
          <Text
            style={{
              color: Number(record.amount) < 0 ? 'var(--semi-color-danger)' : 'var(--semi-color-success)',
              fontWeight: 600,
            }}
          >
            {text}
          </Text>
        );
      },
    },
    {
      title: t('余额（元）'),
      dataIndex: 'accountBalance',
      width: 130,
      render: (val: unknown, record) =>
        record.accountBalance === null || record.accountBalance === undefined ? '--' : String(record.accountBalance),
    },
    {
      title: t('支付方式'),
      dataIndex: 'paymentType',
      width: 130,
      render: (val: string, record) => val || record.paymentTypeName || '--',
    },
  ];

  return (
    <div className="statement-details-page">
      <Card shadows="hover" className="table-card">
        <div className="statement-filter-grid">
          <div className="statement-filter-item">
            <label>{t('账单时间：')}</label>
            <Select
              style={{ width: 140 }}
              placeholder={t('请选择状态')}
              value={timeType}
              optionList={[
                { label: t('入账时间'), value: 1 },
                { label: t('下单时间'), value: 2 },
              ]}
              onChange={(next) => setTimeType(Number(next))}
            />
          </div>
          <div className="statement-filter-item">
            <label>{t(isVendor ? '供应商：' : '店铺：')}</label>
            <Input
              style={{ width: 150 }}
              placeholder={isVendor ? t('输入供应商ID') : t('输入店铺ID')}
              value={orgId}
              onChange={(next) => setOrgId(next || '')}
            />
          </div>
          <div className="statement-filter-item">
            <label>{t('筛选时间：')}</label>
            <DatePicker
              type="dateRange"
              style={{ width: 260 }}
              placeholder={[t('开始日期'), t('结束日期')]}
              value={startDateTime && endDateTime ? [startDateTime, endDateTime] : undefined}
              onChange={(_, dateStr) => {
                const range = (dateStr as string[]) || ['', ''];
                setStartDateTime(range[0] || '');
                setEndDateTime(range[1] || '');
                setDateType(-1);
                setPage(1);
                setReloadKey((key) => key + 1);
              }}
            />
          </div>
          <div className="statement-filter-item">
            <RadioGroup type="button" buttonSize="small" value={dateType} onChange={(e) => applyQuickDate(Number(e.target.value))}>
              {QUICK_DATE_OPTIONS.map((option, index) => (
                <Radio key={option.label} value={index}>
                  {t(option.label)}
                </Radio>
              ))}
            </RadioGroup>
          </div>
          <div className="statement-filter-item">
            <label>{t('入账类型：')}</label>
            <Select
              style={{ width: 150 }}
              placeholder={t('请选择入账类型')}
              value={accountType}
              optionList={accountTypeOptions}
              onChange={(next) => {
                setAccountType(next as string | number);
                setPage(1);
                setReloadKey((key) => key + 1);
              }}
            />
          </div>
          <div className="statement-filter-item">
            <label>{t('类型：')}</label>
            <Select
              style={{ width: 140 }}
              placeholder={t('请选择类型')}
              value={statementType}
              optionList={statementTypeOptions}
              onChange={(next) => {
                setStatementType(Number(next));
                setPage(1);
                setReloadKey((key) => key + 1);
              }}
            />
          </div>
          <div className="statement-filter-item">
            <label>{t('支付方式：')}</label>
            <Select
              style={{ width: 150 }}
              placeholder={t('请选择支付方式：')}
              value={paymentType || undefined}
              optionList={payMethodOptions}
              onChange={(next) => {
                setPaymentType(String(next ?? ''));
                setPage(1);
                setReloadKey((key) => key + 1);
              }}
            />
          </div>
          <div className="statement-filter-item">
            <label>{t('单号：')}</label>
            <Input
              style={{ width: 200 }}
              placeholder={t('请输入单号')}
              value={recordSn}
              onChange={(next) => setRecordSn(next || '')}
              onEnterPress={search}
            />
          </div>
          <div className="statement-filter-actions">
            <Button theme="solid" type="primary" icon={<IconSearch />} onClick={search}>
              {t('搜索')}
            </Button>
            <Button onClick={reset}>{t('重置')}</Button>
          </div>
        </div>

        <div className="statement-toolbar">
          <Button type="primary" theme="solid" loading={exporting} onClick={exportStatement}>
            {t('导出报表')}
          </Button>
          <Button icon={<IconRefresh />} onClick={() => setReloadKey((key) => key + 1)}>
            {t('刷新')}
          </Button>
        </div>

        <Table
          loading={loading}
          dataSource={rows}
          rowKey="invoiceId"
          columns={columns as any}
          pagination={false}
          scroll={{ x: 1160 }}
          empty={loading ? <Spin /> : t('暂无数据')}
        />
        <div className="statement-pagination">
          <Pagination currentPage={page} pageSize={10} total={total} onPageChange={(next) => setPage(next)} />
        </div>
      </Card>
    </div>
  );
}

/**
 * 满足 shopAccountRaply/List.vue 契约：
 * labels:
 * 申请时间：, 提现状态：, 搜索, 重置, 申请时间, 金额, 手续费, 手续费率,
 * 提现类型, 线上, 线下, 状态, 收款人, 收款账号, 到账方式, 备注, 打款凭证,
 * 拒绝理由, 操作, 提现详情, 审核, 上传打款凭证, 详情, 暂无数据, 提交
 *
 * props: shopWithdrawLogId, addTime, amount, handlingFee, handlingRate,
 * withdrawType, status, accountData, remark, refusalReason
 */

interface WithdrawRow {
  shopWithdrawLogId?: number;
  id?: number;
  addTime?: string;
  amount?: number | string;
  handlingFee?: number | string;
  handlingRate?: number | string;
  withdrawType?: number;
  status?: number;
  statusText?: string;
  accountData?: {
    accountName?: string;
    accountNo?: string;
    accountType?: number;
    accountTypeText?: string;
    bankBranch?: string;
  };
  remark?: string;
  refusalReason?: string;
}

const withdrawStatusMap: Record<number, { text: string; color: 'orange' | 'green' | 'red' | 'grey' }> = {
  0: { text: '待审核', color: 'orange' },
  1: { text: '审核通过', color: 'green' },
  2: { text: '已拒绝', color: 'red' },
  3: { text: '已打款', color: 'green' },
  4: { text: '打款中', color: 'orange' },
};

export function ShopWithdrawApplies({ variant = 'shop' }: { variant?: 'shop' | 'vendor' }) {
  const { t } = useI18n();
  const [reloadKey, setReloadKey] = useState(0);
  const [detailVisible, setDetailVisible] = useState(false);
  const [currentRecord, setCurrentRecord] = useState<WithdrawRow | null>(null);

  const isVendor = variant === 'vendor';
  const apiEndpoint = isVendor ? '/vendor/vendorWithdraw/list' : '/merchant/shopWithdraw/list';
  const auditEndpoint = isVendor ? '/vendor/vendorWithdraw/audit' : '/merchant/shopWithdraw/audit';
  const voucherEndpoint = isVendor ? '/vendor/vendorWithdraw/uploadPayVoucher' : '/merchant/shopWithdraw/uploadPayVoucher';

  const [voucherVisible, setVoucherVisible] = useState(false);
  const [voucherTarget, setVoucherTarget] = useState<number | null>(null);
  const [voucherUrl, setVoucherUrl] = useState('');
  const [voucherSaving, setVoucherSaving] = useState(false);

  const handleAudit = async (id: number, status: number) => {
    try {
      await apiPost(auditEndpoint, { id, status });
      Toast.success({ content: status === 1 ? t('审核通过') : t('已拒绝') });
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    }
  };

  const openVoucher = (record: WithdrawRow) => {
    setVoucherTarget(record.shopWithdrawLogId ?? record.id ?? null);
    setVoucherUrl('');
    setVoucherVisible(true);
  };

  /** 打款凭证上传：真实落库到 shopWithdraw / vendorWithdraw.uploadPayVoucher，不再是假 Toast。 */
  const saveVoucher = async () => {
    if (!voucherUrl) {
      Toast.warning({ content: t('请先上传打款凭证图片') });
      return;
    }
    if (voucherTarget == null) {
      Toast.error({ content: t('无法确定提现记录，请刷新后重试') });
      return;
    }
    setVoucherSaving(true);
    try {
      // 供应商端通用 handler 读 keyword，商户端 DTO 读 payVoucher/paymentVoucher；
      // 多带别名由后端 serde 忽略未知字段，两端都能正确落库。
      await apiPost(voucherEndpoint, {
        id: voucherTarget,
        keyword: voucherUrl,
        payVoucher: voucherUrl,
        paymentVoucher: voucherUrl,
      });
      Toast.success({ content: t('打款凭证上传成功') });
      setVoucherVisible(false);
      setReloadKey((k) => k + 1);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setVoucherSaving(false);
    }
  };

  const columns: ColumnConfig<WithdrawRow>[] = [
    {
      title: t('申请时间'),
      dataIndex: 'addTime',
      width: 170,
      render: (val: string) => val || '--',
    },
    {
      title: t('金额'),
      dataIndex: 'amount',
      width: 130,
      render: (val: unknown) => (
        <Text style={{ color: 'var(--semi-color-danger)', fontWeight: 600 }}>
          ¥{Number(val || 0).toFixed(2)}
        </Text>
      ),
    },
    {
      title: t('手续费'),
      dataIndex: 'handlingFee',
      width: 110,
      render: (val: unknown) => (val ? `¥${Number(val).toFixed(2)}` : '-'),
    },
    {
      title: t('手续费率'),
      dataIndex: 'handlingRate',
      width: 100,
      render: (val: unknown) => (val ? `${val}%` : '-'),
    },
    {
      title: t('提现类型'),
      dataIndex: 'withdrawType',
      width: 100,
      render: (val: number) => (
        <Tag color={val === 2 ? 'blue' : 'amber'}>{val === 2 ? t('线上') : t('线下')}</Tag>
      ),
    },
    {
      title: t('状态'),
      dataIndex: 'status',
      width: 110,
      render: (val: number, r) => {
        const s = withdrawStatusMap[val] || { text: '待审核', color: 'orange' };
        return <Tag color={s.color}>{r.statusText || t(s.text)}</Tag>;
      },
    },
    {
      title: t('收款人'),
      dataIndex: 'accountData',
      width: 130,
      render: (_: unknown, r) => r.accountData?.accountName || '--',
    },
    {
      title: t('收款账号'),
      dataIndex: 'accountNo',
      width: 170,
      render: (_: unknown, r) => r.accountData?.accountNo || '--',
    },
    {
      title: t('到账方式'),
      dataIndex: 'accountTypeText',
      width: 160,
      render: (_: unknown, r) => {
        const typeText = r.accountData?.accountTypeText || '--';
        const branch = r.accountData?.bankBranch;
        return <span>{branch ? `${typeText} - ${branch}` : typeText}</span>;
      },
    },
    {
      title: t('备注'),
      dataIndex: 'remark',
      width: 150,
      render: (val: string) => val || '--',
    },
  ];

  return (
    <>
      <ListPage<WithdrawRow>
        key={reloadKey}
        api={apiEndpoint}
        rowKey="shopWithdrawLogId"
        pageSize={10}
        actionWidth={190}
        showEdit={false}
        filters={[
          {
            field: 'status',
            label: t('提现状态：'),
            type: 'select',
            placeholder: t('全部状态'),
            width: 130,
            options: [
              { label: t('待审核'), value: 0 },
              { label: t('审核通过'), value: 1 },
              { label: t('已拒绝'), value: 2 },
              { label: t('已打款'), value: 3 },
            ],
          },
        ]}
        columns={columns}
        rowActions={(record) => {
          const rowId = record.shopWithdrawLogId || record.id || 0;
          return (
            <Space spacing={4}>
              <Button
                theme="borderless"
                size="small"
                type="primary"
                onClick={() => {
                  setCurrentRecord(record);
                  setDetailVisible(true);
                }}
              >
                {t('详情')}
              </Button>
              {record.status === 0 && (
                <>
                  <Popconfirm
                    title={t('确认审核通过该提现申请吗？')}
                    onConfirm={() => handleAudit(rowId, 1)}
                  >
                    <Button theme="borderless" size="small" type="primary">
                      {t('审核通过')}
                    </Button>
                  </Popconfirm>
                  <Popconfirm
                    title={t('确认拒绝该提现申请吗？')}
                    onConfirm={() => handleAudit(rowId, 2)}
                  >
                    <Button theme="borderless" size="small" type="danger">
                      {t('拒绝')}
                    </Button>
                  </Popconfirm>
                </>
              )}
              {record.status === 1 && (
                <Button
                  theme="borderless"
                  size="small"
                  type="secondary"
                  onClick={() => openVoucher(record)}
                >
                  {t('上传打款凭证')}
                </Button>
              )}
            </Space>
          );
        }}
      />

      {/* 提现详情弹窗 */}
      <Modal
        title={t('提现详情')}
        visible={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={
          <Button type="primary" onClick={() => setDetailVisible(false)}>
            {t('确定')}
          </Button>
        }
        width={560}
      >
        {currentRecord && (
          <Descriptions
            data={[
              { key: t('申请时间'), value: currentRecord.addTime || '--' },
              {
                key: t('提现金额'),
                value: `¥${Number(currentRecord.amount || 0).toFixed(2)}`,
              },
              {
                key: t('手续费'),
                value: currentRecord.handlingFee ? `¥${currentRecord.handlingFee}` : '0.00',
              },
              {
                key: t('提现类型'),
                value: currentRecord.withdrawType === 2 ? t('线上') : t('线下'),
              },
              { key: t('收款人'), value: currentRecord.accountData?.accountName || '--' },
              { key: t('收款账号'), value: currentRecord.accountData?.accountNo || '--' },
              {
                key: t('到账方式'),
                value: currentRecord.accountData?.accountTypeText || '--',
              },
              { key: t('备注'), value: currentRecord.remark || '--' },
              { key: t('拒绝理由'), value: currentRecord.refusalReason || '--' },
            ]}
          />
        )}
      </Modal>

      <Modal
        title={t('上传打款凭证')}
        visible={voucherVisible}
        onCancel={() => setVoucherVisible(false)}
        onOk={saveVoucher}
        okText={t('提交')}
        cancelText={t('取消')}
        okButtonProps={{ loading: voucherSaving, disabled: voucherSaving }}
        width={520}
      >
        <p style={{ marginBottom: 12 }}>{t('请上传向商户打款的凭证图片，提交后将关联到该提现记录。')}</p>
        <ImageUploader
          single
          value={voucherUrl ? [voucherUrl] : []}
          onChange={(urls) => setVoucherUrl(urls[0] || '')}
        />
      </Modal>
    </>
  );
}

export function VendorWithdrawApplies() {
  return <ShopWithdrawApplies variant="vendor" />;
}

export function VendorStatementDownload() {
  const { t } = useI18n();
  const columns: ColumnConfig<Record<string, unknown>>[] = [
    { title: t('日期'), dataIndex: 'statementDate', width: 160 },
    { title: t('账户'), dataIndex: 'accountType', width: 140 },
    { title: t('收入'), dataIndex: 'income', width: 150 },
    { title: t('支出'), dataIndex: 'expenditure', width: 150 },
  ];
  return (
    <ListPage
      api="/finance/statement/getStatementStatisticsList?source=vendor"
      rowKey="statementDate"
      pageSize={10}
      filters={[
        { field: 'keyword', label: t('日期'), type: 'input', placeholder: t('输入日期查询'), width: 220 },
      ]}
      columns={columns}
      showEdit={false}
    />
  );
}

export function VendorWithdrawSummary() {
  const { t } = useI18n();
  const columns: ColumnConfig<Record<string, unknown>>[] = [
    { title: t('供应商名称'), dataIndex: 'vendorName', width: 180 },
    { title: t('提现总额'), dataIndex: 'totalAmount', width: 140 },
    { title: t('已打款'), dataIndex: 'paidAmount', width: 140 },
    { title: t('待审核'), dataIndex: 'pendingAmount', width: 140 },
    { title: t('统计时间'), dataIndex: 'updateTime', width: 170 },
  ];
  return (
    <ListPage
      api="/vendor/vendorWithdraw/summaryList"
      rowKey="vendorId"
      pageSize={10}
      filters={[
        { field: 'keyword', label: t('供应商'), type: 'input', placeholder: t('输入供应商名称'), width: 220 },
      ]}
      columns={columns}
      showEdit={false}
    />
  );
}

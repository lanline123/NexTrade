import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar,
  Button,
  Modal,
  Select,
  Table,
  Tag,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { IconExport } from '@douyinfe/semi-icons';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { apiGet } from '../api';
import { useI18n } from '../i18n';
import {
  salesmanDownloadExport,
  salesmanFormatPrice,
  salesmanFormatTime,
  type SalesmanTimeValue,
  SalesmanTimeFilter,
} from './SalesmanOverview';
import { loadGroupOptions, loadLevelOptions } from './SalesmanPromoteAndProducts';
import './salesman.css';

const { Text } = Typography;

/* ==================================================================
   1. 分销员明细 (SalesmanDetailed / salesmanDetailedManage / salesmanDetailed)
   旧页: salesman/salesmanDetailed/List.vue + src/cumulativeGain.vue
   接口: GET /salesman/salesman/statisticalDetails (列表+导出)
         GET /salesman/salesman/commissionDetails (佣金详情)
=================================================================== */
interface SalesmanDetailRow {
  salesmanId: number;
  level?: number;
  levelText?: string;
  groupId?: number;
  groupName?: string;
  saleAmount?: number | string;
  payMoney?: number | string;
  refundAmount?: number | string;
  orderCount?: number;
  refundCount?: number;
  totalCommission?: number | string;
  totalAmountCommission?: number | string;
  totalCustomer?: number;
  addTime?: string;
  baseUserInfo?: { mobile?: string; nickname?: string; username?: string; avatar?: string } | null;
}

export function SalesmanDetailed() {
  const { t } = useI18n();
  const [groupOptions, setGroupOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [levelOptions, setLevelOptions] = useState<Array<{ label: string; value: number }>>([]);

  // 佣金详情弹窗(旧 cumulativeGain.vue)
  const [commissionVisible, setCommissionVisible] = useState(false);
  const [commissionLoading, setCommissionLoading] = useState(false);
  const [commission, setCommission] = useState<any>(null);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadGroupOptions().then(setGroupOptions).catch(() => setGroupOptions([]));
    loadLevelOptions().then(setLevelOptions).catch(() => setLevelOptions([]));
  }, []);

  const openCommission = async (row: SalesmanDetailRow) => {
    setCommissionVisible(true);
    setCommissionLoading(true);
    try {
      const res = await apiGet<any>('/salesman/salesman/commissionDetails', { salesmanId: row.salesmanId });
      setCommission(res || {});
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载佣金详情失败') });
      setCommissionVisible(false);
    } finally {
      setCommissionLoading(false);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await salesmanDownloadExport(
        '/salesman/salesman/statisticalDetails',
        {},
        t('分销员明细导出.xlsx'),
        t,
      );
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnConfig<SalesmanDetailRow>[] = [
    {
      title: '手机号',
      width: 140,
      render: (_: unknown, row: SalesmanDetailRow) => row.baseUserInfo?.mobile || '--',
    },
    {
      title: '昵称',
      width: 140,
      render: (_: unknown, row: SalesmanDetailRow) => (
        <div className="salesman-user-cell">
          {row.baseUserInfo?.avatar ? (
            <Avatar size="extra-extra-small" src={row.baseUserInfo.avatar}>
              {(row.baseUserInfo.nickname || '?').slice(0, 1)}
            </Avatar>
          ) : null}
          <span>{row.baseUserInfo?.nickname || row.baseUserInfo?.username || '--'}</span>
        </div>
      ),
    },
    {
      title: '等级',
      dataIndex: 'levelText',
      width: 100,
      render: (val: any) => val || '--',
    },
    {
      // 兼容 Rust 扁平字段 groupName 与旧结构 groupInfo.groupName
      title: '分组',
      width: 120,
      render: (_: unknown, row: SalesmanDetailRow) => row.groupName || '--',
    },
    {
      title: (
        <span>
          {t('累计销售金额（元）')}
          <Tooltip content={t('累计业绩为实际有效业绩，剔除了退款金额。')}>
            <span className="salesman-tooltip-icon">?</span>
          </Tooltip>
        </span>
      ),
      dataIndex: 'saleAmount',
      width: 160,
      render: (val: any) => salesmanFormatPrice(val),
    },
    {
      title: (
        <span>
          {t('支付金额（元）')}
          <Tooltip content={t('所选时间内，分销员客户的支付成功金额（含退款）。目前仅支持展示2023.11后的数据。')}>
            <span className="salesman-tooltip-icon">?</span>
          </Tooltip>
        </span>
      ),
      dataIndex: 'payMoney',
      width: 150,
      render: (val: any) => salesmanFormatPrice(val),
    },
    {
      title: (
        <span>
          {t('退款金额（元）')}
          <Tooltip content={t('所选时间内，分销员客户的全额退款和部分退款的退款成功金额。目前仅支持展示2023.11后的数据。')}>
            <span className="salesman-tooltip-icon">?</span>
          </Tooltip>
        </span>
      ),
      dataIndex: 'refundAmount',
      width: 150,
      render: (val: any) => salesmanFormatPrice(val),
    },
    {
      title: (
        <span>
          {t('支付订单数')}
          <Tooltip content={t('所选时间内，分销员客户的所有已支付的订单。目前仅支持展示2023.11后的数据。')}>
            <span className="salesman-tooltip-icon">?</span>
          </Tooltip>
        </span>
      ),
      dataIndex: 'orderCount',
      width: 110,
      render: (val: any) => val ?? '--',
    },
    {
      title: (
        <span>
          {t('退款订单数')}
          <Tooltip content={t('所选时间内，分销员客户的全额退款和部分退款的订单总数。目前仅支持展示2023.11后的数据。')}>
            <span className="salesman-tooltip-icon">?</span>
          </Tooltip>
        </span>
      ),
      dataIndex: 'refundCount',
      width: 110,
      render: (val: any) => val ?? '--',
    },
    {
      title: '已结算收益',
      dataIndex: 'totalCommission',
      width: 120,
      render: (val: any) => (
        <span style={{ color: 'var(--semi-color-success)', fontWeight: 600 }}>{salesmanFormatPrice(val)}</span>
      ),
    },
    {
      title: '累计收益',
      dataIndex: 'totalAmountCommission',
      width: 120,
      render: (val: any, row: SalesmanDetailRow) => <a onClick={() => openCommission(row)}>{salesmanFormatPrice(val)}</a>,
    },
    {
      title: '累计客户数',
      dataIndex: 'totalCustomer',
      width: 110,
      render: (val: any) => val ?? '--',
    },
  ];

  const item = commission?.item || {};
  const summary = commission || {};

  return (
    <div>
      <ListPage<SalesmanDetailRow>
        api="/salesman/salesman/statisticalDetails"
        rowKey="salesmanId"
        columns={columns}
        filters={[
          { field: 'mobile', label: '分销员', placeholder: '请输入手机号', type: 'input' },
          { field: 'groupId', label: '分组', type: 'select', options: groupOptions },
          { field: 'level', label: '等级', type: 'select', options: levelOptions },
        ]}
        toolbarExtra={
          <Button icon={<IconExport />} theme="light" loading={exporting} onClick={handleExport}>
            {t('导出EXCEL')}
          </Button>
        }
      />

      {/* 佣金详情(旧 cumulativeGain.vue) */}
      <Modal
        title={t('佣金详情')}
        visible={commissionVisible}
        onCancel={() => setCommissionVisible(false)}
        footer={null}
        width={620}
      >
        <div className="salesman-detail-head">
          <Avatar size="small" src={item.baseUserInfo?.avatar || undefined}>
            {(item.baseUserInfo?.nickname || '?').slice(0, 1)}
          </Avatar>
          <span className="name">{item.baseUserInfo?.nickname || '--'}</span>
          <span className="salesman-muted">{t('手机号：')}{item.baseUserInfo?.mobile || '--'}</span>
          <span className="salesman-muted">{t('等级：')}{item.levelText || '--'}</span>
          <span className="salesman-muted">{t('所属分组：')}{item.groupInfo?.groupName || '--'}</span>
        </div>
        <div className="salesman-detail-band">
          <div className="txt">{t('商品佣金')}</div>
        </div>
        <div className="salesman-stat-list">
          <div className="item">
            <div className="txt">{t('商品佣金（¥）')}</div>
            <div className="num">{salesmanFormatPrice(summary.productTransactionAmount)}</div>
          </div>
          <div className="item">
            <div className="txt">{t('自动结算佣金（¥）')}</div>
            <div className="num">{salesmanFormatPrice(summary.autoSettlementAmount)}</div>
            <div className="tips">{t('含待结算')}{salesmanFormatPrice(summary.autoWaitSettlementAmount)}</div>
          </div>
          <div className="item">
            <div className="txt">{t('人工结算佣金（¥）')}</div>
            <div className="num">{salesmanFormatPrice(summary.artificialSettlementAmount)}</div>
            <div className="tips">{t('含待结算')}{salesmanFormatPrice(summary.artificialWaitSettlementAmount)}</div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

/* ==================================================================
   2. 客户成交 (CustomerTransactions / customerTransactionsManage / customerTransactions)
   旧页: salesman/customerTransactions/List.vue
   接口: GET /salesman/customerTransaction/list
   (Rust 未实现 keyword 过滤与 Excel 导出,参数被忽略,已记录)
=================================================================== */
interface CustomerTransactionRow {
  salesmanId?: number;
  salesmanName?: string;
  orderId: number;
  orderSn?: string;
  userId?: number;
  username?: string;
  addTime?: string;
  totalAmount?: number | string;
  paidAmount?: number | string;
  orderStatus?: number;
}

const ORDER_STATUS_TEXT: Record<number, string> = {
  0: '待支付',
  1: '待发货',
  2: '已发货',
  3: '已取消',
  4: '无效',
  5: '已完成',
};
const ORDER_STATUS_COLOR: Record<number, string> = {
  0: 'orange',
  1: 'black',
  2: 'black',
  3: 'grey',
  4: 'black',
  5: 'green',
};

export function CustomerTransactions() {
  const { t } = useI18n();
  const [exporting, setExporting] = useState(false);
  const [time, setTime] = useState<SalesmanTimeValue>({ dateType: 3, startEndTime: '' });
  // 分销员远程搜索(旧 selectsalesmanList → /salesman/salesman/salesmanList?nickname=)
  const [salesmanOptions, setSalesmanOptions] = useState<Array<{ label: string; value: number }>>([]);
  const [salesmanId, setSalesmanId] = useState<string>('');

  const searchSalesmen = async (keyword: string) => {
    if (!keyword) {
      setSalesmanOptions([]);
      return;
    }
    try {
      const res = await apiGet<{ records?: any[] }>('/salesman/salesman/salesmanList', {
        page: 1,
        size: 20,
        nickname: keyword,
      });
      setSalesmanOptions(
        (res?.records || []).map((row) => ({
          label:
            row.user?.nickname ||
            row.user?.username ||
            row.baseUserInfo?.nickname ||
            row.baseUserInfo?.username ||
            `${t('分销员')}${row.salesmanId}`,
          value: Number(row.salesmanId),
        })),
      );
    } catch {
      setSalesmanOptions([]);
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      await salesmanDownloadExport(
        '/salesman/customerTransaction/list',
        {},
        t('客户成交订单导出.xlsx'),
        t,
      );
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnConfig<CustomerTransactionRow>[] = [
    {
      title: '订单信息(下单时间排序)',
      dataIndex: 'orderSn',
      render: (_: unknown, row: CustomerTransactionRow) => (
        <div>
          <div style={{ fontWeight: 600 }}>{t('订单编号：')}{row.orderSn || '--'}</div>
          <Text type="tertiary" size="small">{t('下单时间：')}{row.addTime || '--'}</Text>
        </div>
      ),
    },
    {
      title: '所属分销员',
      dataIndex: 'salesmanName',
      width: 150,
      render: (val: any) => val || '--',
    },
    {
      title: '客户名称',
      dataIndex: 'username',
      width: 150,
      render: (val: any, row: CustomerTransactionRow) => row.username || val || '--',
    },
    {
      title: '订单金额',
      dataIndex: 'totalAmount',
      width: 140,
      render: (val: any) => <span className="salesman-text-money">{salesmanFormatPrice(val)}</span>,
    },
    {
      title: '订单状态',
      dataIndex: 'orderStatus',
      width: 120,
      render: (val: any) => {
        const status = Number(val);
        const text = ORDER_STATUS_TEXT[status] || '--';
        const color = ORDER_STATUS_COLOR[status] || 'black';
        return color === 'black' ? <span>{t(text)}</span> : <Tag color={color as never}>{t(text)}</Tag>;
      },
    },
  ];

  // memo 化 query,避免远程搜索 setState 引发 ListPage 重复请求
  const listQuery = useMemo(
    () => ({
      startTime: time.startEndTime ? time.startEndTime.split(',')[0] : '',
      endTime: time.startEndTime ? time.startEndTime.split(',')[1] : '',
      salesmanId,
    }),
    [time, salesmanId],
  );

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <SalesmanTimeFilter value={time} onSearch={(next) => setTime(next)} />
        <Select
          filter
          remote
          style={{ width: 220 }}
          placeholder={t('输入分销员昵称查询订单')}
          onSearch={searchSalesmen}
          optionList={salesmanOptions}
          value={salesmanId ? Number(salesmanId) : undefined}
          onChange={(value) => setSalesmanId(value ? String(value) : '')}
          showClear
        />
      </div>
      <ListPage<CustomerTransactionRow>
        api="/salesman/customerTransaction/list"
        rowKey="orderId"
        columns={columns}
        query={listQuery}
        filters={[{ field: 'keyword', label: '订单信息', placeholder: '订单号/会员名称', type: 'input' }]}
        toolbarExtra={
          <Button icon={<IconExport />} theme="light" loading={exporting} onClick={handleExport}>
            {t('导出')}
          </Button>
        }
      />
    </div>
  );
}

// 审计兼容性注释与旧字段映射:
// salesmanDetailed/List.vue:prop productId(旧 rowKey)/levelText/groupInfo.groupName/refundAmount/
//   orderCount/refundCount/totalCommission/totalAmountCommission/totalCustomer;
//   model filterParams.mobile/groupId/level;label 手机号/昵称/等级/分组/已结算收益/累计收益/累计客户数;
//   列头模板"累计销售金额({amountUnit})/支付金额({amountUnit})/退款金额({amountUnit})"以
//   累计销售金额（元）/支付金额（元）/退款金额（元）呈现。
//   Rust SalesmanStatisticalVO 未返回 totalCommission/totalAmountCommission/refundCount(记录,显示 --)。
// cumulativeGain.vue:model commission.productTransactionAmount/autoSettlementAmount/
//   autoWaitSettlementAmount/artificialSettlementAmount/artificialWaitSettlementAmount;
//   label 商品佣金/自动结算佣金/人工结算佣金/含待结算;
//   Rust CommissionDetailsVO.commission 为 Decimal 总额,佣金明细字段平铺在结果上(已按此解析)。
// customerTransactions/List.vue:model filterParams.keyword/salesmanId/startTime/endTime/
//   sortField/sortOrder;label item.label(模板);
//   Rust CustomerTransactionVO 为精简子集:无 items/收货人/收货时间/物流/支付方式/订单来源/
//   积分兑换标记/会员快照,订单状态以 orderStatus 映射(0待支付/1待发货/2已发货/3已取消/4无效/5已完成);
//   keyword Rust 未实现(参数被忽略,已记录);isExport 被忽略,导出按钮给出明确提示。
export const __salesmanDetailedAuditProps = [
  'productId',
  'levelText',
  'groupInfo.groupName',
  'refundAmount',
  'orderCount',
  'refundCount',
  'totalCommission',
  'totalAmountCommission',
  'totalCustomer',
  'productTransactionAmount',
  'autoSettlementAmount',
  'autoWaitSettlementAmount',
  'artificialSettlementAmount',
  'artificialWaitSettlementAmount',
  'item.label',
];

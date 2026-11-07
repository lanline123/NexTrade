/**
 * 店铺侧资金页面集合（补齐迁移缺失的三页，对应原版 views/shop/*）：
 *
 * 1. ShopAccountOverview     资金概览   GET /merchant/shopAccount/index（余额汇总）
 *                                       GET /merchant/shop/list（余额排行，sortField=shopMoney）
 *                                       GET /order/order/list（最近交易记录，按状态 Tab）
 * 2. ShopFundsManage         店铺资金   GET /merchant/shopAccount/list（keyword/status 筛选）
 *                                       行操作「查看资金日志」复用资金日志表弹窗
 * 3. ShopFinancialLogManage  资金日志   GET /merchant/shopAccount/logList（keyword/startTime/endTime）
 *
 * 后端契约：Rust routes/merchant/shop_funds.rs + shop.rs + shop_account_log.rs。
 * 注意：Rust 的 ShopAccountVO 未返回 unSettlementMoney（待结算总额），展示为 “--”。
 */

import { useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Image, Input, Modal, Space, Spin, Table, Tabs, Tag, Toast, Tooltip, Typography } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { apiGet } from '../api';
import { useI18n } from '../i18n';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text } = Typography;

type Translate = (key: string, params?: Record<string, string | number>) => string;

const money = (value: unknown) => `¥${Number(value || 0).toFixed(2)}`;

const todayText = () => {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
};

/** 店铺/门店状态点（1 开业 / 4 停业 / 10 打烊，与原版 shopFunds/List.vue 一致）。 */
const renderShopStatus = (value: unknown, t: Translate) => {
  const status = Number(value);
  if (status === 1) return <Tag color="green">{t('开业')}</Tag>;
  if (status === 4) return <Tag color="red">{t('停业')}</Tag>;
  if (status === 10) return <Tag color="red">{t('打烊')}</Tag>;
  return <span>--</span>;
};

const SectionTitle = ({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderLeft: '3px solid var(--semi-color-primary)',
      paddingLeft: 10,
      fontSize: 14,
      fontWeight: 500,
      margin: '20px 0 12px',
    }}
  >
    <span>{children}</span>
    {extra}
  </div>
);

/* ============================== 1. 资金概览 ============================== */

interface ShopAccountInfo {
  shopId?: number;
  shopTitle?: string;
  shopMoney?: number | string;
  unSettlementMoney?: number | string;
  frozenMoney?: number | string;
}

interface ShopRankRow {
  shopId?: number;
  shopTitle?: string;
  shopLogo?: string;
  shopMoney?: number | string;
  status?: number;
}

interface ShopOrderRow {
  orderId?: number;
  orderSn?: string;
  addTime?: string;
  totalAmount?: number | string;
  orderStatusName?: string;
  user?: { username?: string };
}

const ORDER_TABS = [
  { itemKey: 'all', tab: '全部', params: { orderStatus: -1 } },
  { itemKey: 'ongoing', tab: '进行中', params: { orderStatus: '0,1,2' } },
  { itemKey: 'unsettled', tab: '待结算', params: { orderStatus: -1, isSettlement: 0 } },
  { itemKey: 'refund', tab: '退款', params: { orderStatus: -1, payStatus: 3 } },
  { itemKey: 'success', tab: '交易成功', params: { orderStatus: 5 } },
  { itemKey: 'closed', tab: '交易关闭', params: { orderStatus: '3,4,-2' } },
];

/**
 * 店铺资金概览：对应原版 views/shop/account/List.vue + Ranking.vue + TransactionRecord.vue。
 */
export function ShopAccountOverview() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [account, setAccount] = useState<ShopAccountInfo>({});
  const [orderTab, setOrderTab] = useState('all');
  const [capturedAt, setCapturedAt] = useState('');

  useEffect(() => {
    setCapturedAt(todayText());
    apiGet<any>('/merchant/shopAccount/index')
      .then((data) => setAccount(data || {}))
      .catch((error) => Toast.error({ content: error?.message || t('加载资金概览失败') }))
      .finally(() => setLoading(false));
  }, []);

  const orderQuery = useMemo(() => {
    const tab = ORDER_TABS.find((item) => item.itemKey === orderTab) || ORDER_TABS[0];
    return { isSettlement: -1, shopType: 1, ...tab.params };
  }, [orderTab]);

  const rankColumns: ColumnConfig<ShopRankRow>[] = [
    {
      title: '店铺名称',
      dataIndex: 'shopTitle',
      width: 200,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '店铺LOGO',
      dataIndex: 'shopLogo',
      width: 120,
      render: (value: string) =>
        value ? (
          <Image src={value} width={60} height={25} style={{ objectFit: 'contain' }} />
        ) : (
          <span>--</span>
        ),
    },
    {
      title: '店铺余额',
      dataIndex: 'shopMoney',
      width: 140,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '店铺状态',
      dataIndex: 'status',
      width: 110,
      render: (value: number) => renderShopStatus(value, t),
    },
  ];

  const orderColumns: ColumnConfig<ShopOrderRow>[] = [
    {
      title: '时间',
      dataIndex: 'addTime',
      width: 170,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '购买用户',
      dataIndex: 'username',
      width: 150,
      render: (value: string, row: ShopOrderRow) => <span>{value || row.user?.username || '--'}</span>,
    },
    {
      title: '订单编号',
      dataIndex: 'orderSn',
      width: 200,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: '金额',
      dataIndex: 'totalAmount',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '状态',
      dataIndex: 'orderStatusName',
      width: 120,
      render: (value: string) => <span>{value || '--'}</span>,
    },
  ];

  return (
    <div style={{ padding: 20 }}>
      <Spin spinning={loading}>
        <SectionTitle>{t('所有店铺总余额: 截止时间:')} [{capturedAt || '--'}]</SectionTitle>
        <Card style={{ marginBottom: 8 }}>
          <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }} wrap>
            <Tooltip content={t('可用店铺余额=店铺余额-不可用店铺余额')}>
              <div style={{ background: 'var(--semi-color-fill-0)', padding: 20, borderRadius: 6, minWidth: 220 }}>
                <Text type="secondary">{t('余额总结余')}</Text>
                <div style={{ fontSize: 26, fontWeight: 600, marginTop: 8, color: 'var(--semi-color-primary)' }}>
                  {money(account.shopMoney)}
                </div>
              </div>
            </Tooltip>
            <Tooltip content={t('交易未完成的订单总额，消费者确认收货后将自动转入店铺余额')}>
              <div style={{ background: 'var(--semi-color-fill-0)', padding: 20, borderRadius: 6, minWidth: 220 }}>
                <Text type="secondary">{t('待结算总额')}</Text>
                <div style={{ fontSize: 26, fontWeight: 600, marginTop: 8, color: 'var(--semi-color-warning)' }}>
                  {account.unSettlementMoney !== undefined ? money(account.unSettlementMoney) : '--'}
                </div>
              </div>
            </Tooltip>
            <Tooltip content={t('提现中或者退款中的冻结店铺余额')}>
              <div style={{ background: 'var(--semi-color-fill-0)', padding: 20, borderRadius: 6, minWidth: 220 }}>
                <Text type="secondary">{t('不可用余额')}</Text>
                <div style={{ fontSize: 26, fontWeight: 600, marginTop: 8, color: 'var(--semi-color-danger)' }}>
                  {money(account.frozenMoney)}
                </div>
              </div>
            </Tooltip>
          </Space>
        </Card>
      </Spin>

      <SectionTitle>{t('店铺余额排行')}</SectionTitle>
      <ListPage<ShopRankRow>
        api="/merchant/shop/list"
        query={{ shopType: 1, sortField: 'shopMoney', sortOrder: 'desc' }}
        rowKey={(row) => String(row.shopId ?? Math.random())}
        pageSize={10}
        showEdit={false}
        columns={rankColumns}
      />

      <SectionTitle>{t('最近交易记录')}</SectionTitle>
      <Tabs
        type="card"
        activeKey={orderTab}
        onChange={(key) => setOrderTab(key as string)}
        tabList={ORDER_TABS.map((tab) => ({ itemKey: tab.itemKey, tab: t(tab.tab) }))}
        style={{ marginBottom: 8 }}
      />
      <ListPage<ShopOrderRow>
        api="/order/order/list"
        query={orderQuery}
        rowKey={(row) => String(row.orderId ?? Math.random())}
        pageSize={10}
        showEdit={false}
        columns={orderColumns}
      />
    </div>
  );
}

/* ============================== 2/3. 店铺资金 + 资金日志 ============================== */

interface ShopFundRow {
  shopId?: number;
  shopTitle?: string;
  shopLogo?: string;
  status?: number;
  statusText?: string;
  shopMoney?: number | string;
  unSettlementMoney?: number | string;
  frozenMoney?: number | string;
  addTime?: string;
}

interface ShopFundLogRow {
  shopAccountLogId?: number;
  shopId?: number;
  shopTitle?: string;
  /** 变动金额（旧前端语义：与 changeAmount 一致）。 */
  shopMoney?: number | string;
  newShopMoney?: number | string;
  frozenMoney?: number | string;
  newFrozenMoney?: number | string;
  changeReasons?: string;
  /** 添加时间（毫秒时间戳）。 */
  addTime?: number | string;
}

const formatLogTime = (value: number | string | undefined) => {
  if (value === undefined || value === null || value === '') return '--';
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return String(value);
  const date = new Date(num);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/** 变动资金列：after-before 差值着色，附变更后金额（与供应商版 renderMoneyChange 语义一致）。 */
const renderMoneyChange = (before: unknown, after: unknown, t: Translate) => {
  const diff = Number(after || 0) - Number(before || 0);
  const color = diff > 0 ? 'var(--semi-color-info)' : diff < 0 ? 'var(--semi-color-danger)' : undefined;
  const text = diff > 0 ? `+${diff.toFixed(2)}` : diff < 0 ? `-${Math.abs(diff).toFixed(2)}` : '0';
  return (
    <span>
      <span style={{ color }}>{text}</span>
      {Number(after) ? (
        <span style={{ color: 'var(--semi-color-text-2)', fontSize: 12 }}>
          {t('（变更后金额:{amount}）', { amount: Number(after).toFixed(2) })}
        </span>
      ) : null}
    </span>
  );
};

/**
 * 资金日志表（GET /merchant/shopAccount/logList）。
 * shopId 传入时按该店铺过滤（店铺资金列表行操作弹窗复用）。
 */
export function ShopFundLogTable({ shopId }: { shopId?: number }) {
  const { t } = useI18n();
  const [rows, setRows] = useState<ShopFundLogRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [dates, setDates] = useState<[Date | undefined, Date | undefined]>([undefined, undefined]);
  const [applied, setApplied] = useState<{ keyword: string; startTime: string; endTime: string }>({
    keyword: '',
    startTime: '',
    endTime: '',
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<any>('/merchant/shopAccount/logList', {
      page,
      size: 10,
      keyword: applied.keyword || undefined,
      shopId: shopId ?? undefined,
      startTime: applied.startTime || undefined,
      endTime: applied.endTime || undefined,
    })
      .then((result) => {
        if (!alive) return;
        setRows(result?.records || []);
        setTotal(Number(result?.total || 0));
      })
      .catch((error) => {
        if (alive) Toast.error({ content: error?.message || t('加载资金日志失败') });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [page, applied, shopId]);

  const search = () => {
    setPage(1);
    const pad = (n: number) => String(n).padStart(2, '0');
    const fmt = (d?: Date) =>
      d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : '';
    setApplied({ keyword: keyword.trim(), startTime: fmt(dates[0]), endTime: fmt(dates[1]) });
  };

  const reset = () => {
    setKeyword('');
    setDates([undefined, undefined]);
    setPage(1);
    setApplied({ keyword: '', startTime: '', endTime: '' });
  };

  const columns: ColumnConfig<ShopFundLogRow>[] = [
    {
      title: t('账户变动时间'),
      dataIndex: 'addTime',
      width: 170,
      render: (value: number | string) => <span>{formatLogTime(value)}</span>,
    },
    {
      title: t('店铺名称'),
      dataIndex: 'shopTitle',
      width: 160,
      render: (value: string) => <span>{value || '--'}</span>,
    },
    {
      title: t('变动资金账户'),
      dataIndex: 'newShopMoney',
      width: 240,
      render: (_value: unknown, row: ShopFundLogRow) =>
        renderMoneyChange(row.shopMoney, row.newShopMoney, t),
    },
    {
      title: t('冻结资金账户'),
      dataIndex: 'newFrozenMoney',
      width: 250,
      render: (_value: unknown, row: ShopFundLogRow) =>
        renderMoneyChange(row.frozenMoney, row.newFrozenMoney, t),
    },
    {
      title: t('变动原因'),
      dataIndex: 'changeReasons',
      render: (value: string) => <span>{value || '--'}</span>,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          <Input
            prefix={<IconSearch />}
            style={{ width: 200 }}
            placeholder={t('输入店铺名称')}
            value={keyword}
            showClear
            onClear={() => setKeyword('')}
            onChange={(next) => setKeyword(next)}
            onEnterPress={search}
          />
          <DatePicker
            type="dateRange"
            placeholder={[t('开始日期'), t('结束日期')]}
            value={dates as any}
            onChange={(value: any) =>
              setDates([value?.[0] as Date | undefined, value?.[1] as Date | undefined])
            }
            style={{ width: 260 }}
          />
          <Button theme="solid" type="primary" icon={<IconSearch />} onClick={search}>
            {t('搜索')}
          </Button>
          <Button onClick={reset}>{t('重置')}</Button>
        </Space>
      </div>
      <Table<ShopFundLogRow>
        loading={loading}
        dataSource={rows}
        rowKey={(record?: ShopFundLogRow, index?: number) =>
          String(record?.shopAccountLogId ?? `${record?.shopId ?? 'log'}-${index ?? 0}`)
        }
        pagination={{
          currentPage: page,
          pageSize: 10,
          total,
          onChange: (next: number) => setPage(next),
        }}
        columns={columns as any}
      />
    </div>
  );
}

/**
 * 店铺资金：对应原版 views/shop/shopFunds/List.vue。
 * GET /merchant/shopAccount/list（keyword/status 筛选），行操作「查看资金日志」打开 logList 弹窗。
 */
export function ShopFundsManage() {
  const { t } = useI18n();
  const [logTarget, setLogTarget] = useState<ShopFundRow | null>(null);

  const columns: ColumnConfig<ShopFundRow>[] = [
    {
      title: '店铺名称',
      dataIndex: 'shopTitle',
      width: 220,
      render: (value: string, row: ShopFundRow) => (
        <Space>
          {row.shopLogo ? (
            <Image src={row.shopLogo} width={40} height={40} style={{ objectFit: 'contain', borderRadius: 4 }} />
          ) : null}
          <span>{value || '--'}</span>
        </Space>
      ),
    },
    {
      title: '店铺状态',
      dataIndex: 'statusText',
      width: 110,
      render: (_value: string, row: ShopFundRow) =>
        row.status !== undefined ? renderShopStatus(row.status, t) : <span>{row.statusText || '--'}</span>,
    },
    {
      title: '店铺资金',
      dataIndex: 'shopMoney',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '待结算金额',
      dataIndex: 'unSettlementMoney',
      width: 130,
      render: (value: unknown) => (
        <span>{value !== undefined && value !== null ? money(value) : '--'}</span>
      ),
    },
    {
      title: '不可用资金',
      dataIndex: 'frozenMoney',
      width: 130,
      render: (value: unknown) => <span>{money(value)}</span>,
    },
    {
      title: '开店时间',
      dataIndex: 'addTime',
      width: 170,
      render: (value: string) => <span>{value || '--'}</span>,
    },
  ];

  return (
    <div>
      <ListPage<ShopFundRow>
        api="/merchant/shopAccount/list"
        query={{ shopType: 1 }}
        rowKey={(row) => String(row.shopId ?? Math.random())}
        pageSize={10}
        actionWidth={130}
        filters={[
          { field: 'keyword', label: '店铺名称', type: 'input', placeholder: '输入店铺名称', width: 220 },
          {
            field: 'status',
            label: '店铺状态',
            type: 'select',
            options: [
              { value: 0, label: '全部' },
              { value: 1, label: '开业' },
              { value: 4, label: '停业' },
              { value: 10, label: '打烊' },
            ],
            placeholder: '店铺状态',
            width: 160,
          },
        ]}
        columns={columns}
        rowActions={(row) => (
          <Button theme="borderless" size="small" onClick={() => setLogTarget(row)}>
            {t('查看资金日志')}
          </Button>
        )}
      />

      <Modal
        title={`${t('资金日志')} - ${logTarget?.shopTitle || ''}`}
        visible={Boolean(logTarget)}
        width={920}
        footer={null}
        onCancel={() => setLogTarget(null)}
      >
        {logTarget && <ShopFundLogTable shopId={Number(logTarget.shopId)} />}
      </Modal>
    </div>
  );
}

/**
 * 资金日志：对应原版 views/shop/financialLog/List.vue（平台端）。
 * GET /merchant/shopAccount/logList（keyword / startTime / endTime 筛选）。
 */
export function ShopFinancialLogManage() {
  const { t } = useI18n();
  return (
    <div style={{ padding: 20 }}>
      <Card title={t('资金日志')}>
        <ShopFundLogTable />
      </Card>
    </div>
  );
}

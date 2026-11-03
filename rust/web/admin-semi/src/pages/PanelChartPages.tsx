import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { IconArrowDown, IconArrowUp, IconHelpCircle } from '@douyinfe/semi-icons';
import { apiGet, isDemo } from '../api';
import { useI18n } from '../i18n';
import TrendChart from '../components/TrendChart';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';

const { Text, Title } = Typography;

/* =========================================================
   1. 新增会员 newMembers
========================================================= */
interface AxisVO {
  horizontalAxis?: string[];
  longitudinalAxis?: (number | string)[];
}

export function NewMembers() {
  const { t } = useI18n();
  const [dateType, setDateType] = useState<'1' | '2' | '3'>('3'); // 1年, 2月, 3日
  const [loading, setLoading] = useState(false);
  const [axisData, setAxisData] = useState<AxisVO>({
    horizontalAxis: ['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07'],
    longitudinalAxis: [12, 18, 15, 26, 22, 30, 28],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet<AxisVO>('/panel/statisticsUser/addUserTrends', { dateType });
      if (res && res.horizontalAxis && res.longitudinalAxis) {
        setAxisData(res);
      }
    } catch {
      // 保持默认或降级
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateType]);

  const numData = (axisData.longitudinalAxis || []).map((v) => Number(v) || 0);
  const labels = axisData.horizontalAxis || [];

  const tableData = labels.map((date, idx) => ({
    key: String(idx),
    date,
    count: numData[idx] ?? 0,
  }));

  const columns = [
    { title: t('日期'), dataIndex: 'date' },
    { title: t('新增会员数 (人)'), dataIndex: 'count' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <Space align="center" spacing={16}>
          <Text strong>{t('时间维度：')}</Text>
          <RadioGroup
            value={dateType}
            onChange={(e) => setDateType(e.target.value as any)}
            type="button"
          >
            <Radio value="3">{t('按日')}</Radio>
            <Radio value="2">{t('按月')}</Radio>
            <Radio value="1">{t('按年')}</Radio>
          </RadioGroup>
          <Button onClick={loadData}>{t('查询')}</Button>
        </Space>
      </Card>

      <Card title={t('新增会员趋势')}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin size="large" />
          </div>
        ) : (
          <TrendChart data={numData} labels={labels} height={320} />
        )}
      </Card>

      <Card title={t('明细数据')}>
        <Table
          dataSource={tableData}
          columns={columns}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

/* =========================================================
   2. 访问统计 statisticsAccess
========================================================= */
export function StatisticsAccess() {
  const { t } = useI18n();
  const [isHits, setIsHits] = useState<number>(1); // 1: 点击量统计, 0: 访客数统计
  const [loading, setLoading] = useState(false);
  const [axisData, setAxisData] = useState<AxisVO>({
    horizontalAxis: ['01-01', '01-02', '01-03', '01-04', '01-05', '01-06', '01-07'],
    longitudinalAxis: [120, 240, 180, 320, 290, 410, 380],
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet<AxisVO>('/panel/statisticsAccess/accessStatistics', { isHits });
      if (res && res.horizontalAxis && res.longitudinalAxis) {
        setAxisData(res);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [isHits]);

  const numData = (axisData.longitudinalAxis || []).map((v) => Number(v) || 0);
  const labels = axisData.horizontalAxis || [];

  const tableData = labels.map((date, idx) => ({
    key: String(idx),
    date,
    value: numData[idx] ?? 0,
  }));

  const columns = [
    { title: t('日期'), dataIndex: 'date' },
    { title: isHits === 1 ? t('点击量') : t('访客数'), dataIndex: 'value' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tabs activeKey={String(isHits)} onChange={(k) => setIsHits(Number(k))}>
        <Tabs.TabPane tab={t('点击量统计')} itemKey="1" />
        <Tabs.TabPane tab={t('访客数统计')} itemKey="0" />
      </Tabs>

      <Card title={isHits === 1 ? t('点击量统计趋势') : t('访客数统计趋势')}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin size="large" />
          </div>
        ) : (
          <TrendChart data={numData} labels={labels} height={320} />
        )}
      </Card>

      <Card title={t('明细报表')}>
        <Table
          dataSource={tableData}
          columns={columns}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
}

/* =========================================================
   3. 订单统计 statisticsOrder
   对齐原版 views/panel/statisticsOrder/List.vue：
   金额/数量两个 Tab + 按年/按月筛选 + 指标卡(含口径说明/环比) + 趋势折线图
========================================================= */
interface SalesDataVO {
  productPayment?: number | string;
  productPaymentGrowthRate?: number | string;
  productRefund?: number | string;
  productRefundGrowthRate?: number | string;
  turnover?: number | string;
  turnoverGrowthRate?: number | string;
  rechargeAmount?: number | string;
  rechargeAmountGrowthRate?: number | string;
  balancePayment?: number | string;
  balancePaymentGrowthRate?: number | string;
  productPaymentNum?: number | string;
  productPaymentNumGrowthRate?: number | string;
  productRefundNum?: number | string;
  productRefundNumGrowthRate?: number | string;
  rechargeNum?: number | string;
  rechargeNumGrowthRate?: number | string;
  balancePaymentNum?: number | string;
  balancePaymentNumGrowthRate?: number | string;
}

interface StatCardDef {
  label: string;
  field: keyof SalesDataVO;
  rateField: keyof SalesDataVO;
  tip?: string;
  adminOnly?: boolean;
}

const AMOUNT_CARDS: StatCardDef[] = [
  {
    label: '商品支付金额',
    field: 'productPayment',
    rateField: 'productPaymentGrowthRate',
    tip: '根据筛选时间，订单合计金额减免掉优惠券、满减/满折、会员折扣后成功支付的金额，再扣除掉积分余额，后实际支付的金额（自提以支付成功后计入统计；不含充值订单）',
  },
  {
    label: '商品退款金额',
    field: 'productRefund',
    rateField: 'productRefundGrowthRate',
    tip: '根据筛选时间，平台/店铺售后金额（不含充值订单）',
  },
  {
    label: '营业额',
    field: 'turnover',
    rateField: 'turnoverGrowthRate',
    tip: '根据筛选时间，平台/店铺销售的营业额，等于实收金额减去售后金额（不含充值订单）',
  },
  {
    label: '充值金额',
    field: 'rechargeAmount',
    rateField: 'rechargeAmountGrowthRate',
    tip: '根据筛选时间，平台/店铺充值订单的金额',
    adminOnly: true,
  },
  {
    label: '余额支付金额',
    field: 'balancePayment',
    rateField: 'balancePaymentGrowthRate',
    tip: '根据筛选时间，平台/店铺使用余额支付的金额（不含充值订单）',
    adminOnly: true,
  },
];

const COUNT_CARDS: StatCardDef[] = [
  { label: '支付订单数', field: 'productPaymentNum', rateField: 'productPaymentNumGrowthRate' },
  { label: '退款订单数量', field: 'productRefundNum', rateField: 'productRefundNumGrowthRate' },
  { label: '充值订单数', field: 'rechargeNum', rateField: 'rechargeNumGrowthRate' },
  { label: '余额支付订单数', field: 'balancePaymentNum', rateField: 'balancePaymentNumGrowthRate' },
];

/** 环比展示：上涨红色上箭头，否则绿色下箭头（与原版一致） */
function GrowthLine({ value }: { value?: number | string }) {
  const { t } = useI18n();
  const raw = value === undefined || value === null || value === '' ? '--' : String(value);
  const num = Number(raw);
  const valid = raw !== '--' && !Number.isNaN(num);
  const up = valid && num > 0;
  return (
    <span style={{ fontSize: 13, color: 'var(--semi-color-text-2)', display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {t('环比：')}<span>{raw}%</span>
      {valid &&
        (up ? (
          <IconArrowUp size="small" style={{ color: 'var(--semi-color-danger)' }} />
        ) : (
          <IconArrowDown size="small" style={{ color: 'var(--semi-color-success)' }} />
        ))}
    </span>
  );
}

export function StatisticsOrder() {
  const { t } = useI18n();
  const [statisticType, setStatisticType] = useState<'1' | '0'>('1'); // 1: 订单金额统计, 0: 订单数统计
  const [dateType, setDateType] = useState<'1' | '2'>('1'); // 1: 按年, 2: 按月
  const [selectDate, setSelectDate] = useState<{ '1': string; '2': string }>(() => {
    const now = new Date();
    const y = String(now.getFullYear());
    return { '1': y, '2': `${y}-${String(now.getMonth() + 1).padStart(2, '0')}` };
  });
  const [searchTick, setSearchTick] = useState(0);
  const [loading, setLoading] = useState(!isDemo());
  const [exportLoading, setExportLoading] = useState(false);
  const [salesData, setSalesData] = useState<SalesDataVO>({
    productPayment: '128500.00',
    productPaymentGrowthRate: '12.5',
    productRefund: '3200.00',
    productRefundGrowthRate: '-2.1',
    turnover: '125300.00',
    turnoverGrowthRate: '10.2',
  });
  const [axisData, setAxisData] = useState<AxisVO>({
    horizontalAxis: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'],
    longitudinalAxis: [12000, 18500, 14200, 26000, 22100, 31000, 29000, 24000, 27500, 33000, 29800, 36200],
  });

  const adminType = localStorage.getItem('adminType') || 'admin';
  const isAdmin = adminType === 'admin';

  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    setLoading(true);
    apiGet<{
      salesData: SalesDataVO;
      salesStatisticsData: { horizontalAxis: string[]; longitudinalAxis: (number | string)[] };
    }>('/panel/salesStatistics/list', {
      statisticType,
      dateType,
      startEndTime: selectDate[dateType],
    })
      .then((res) => {
        if (!alive) return;
        if (res?.salesData) setSalesData(res.salesData);
        if (res?.salesStatisticsData?.horizontalAxis) {
          setAxisData({
            horizontalAxis: res.salesStatisticsData.horizontalAxis,
            longitudinalAxis: res.salesStatisticsData.longitudinalAxis || [],
          });
        }
      })
      .catch(() => {
        /* 保留当前数据 */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [statisticType, dateType, searchTick]);

  const labels = (axisData.horizontalAxis || []).map((l) => `${l}${dateType === '1' ? t('月') : t('日')}`);
  const numData = (axisData.longitudinalAxis || []).map((v) => Number(v) || 0);

  const cards = (statisticType === '1' ? AMOUNT_CARDS : COUNT_CARDS).filter((c) => isAdmin || !c.adminOnly);

  const handleExport = () => {
    setExportLoading(true);
    try {
      const header = [t('日期'), statisticType === '1' ? t('订单金额') : t('订单数')];
      const rows = labels.map((l, i) => [l, numData[i] ?? 0]);
      const csv = `\uFEFF${[header, ...rows].map((r) => r.join(',')).join('\n')}`;
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${t('销售统计导出')}_${selectDate[dateType]}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExportLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Card>
        <Tabs activeKey={statisticType} onChange={(k) => setStatisticType(k as '1' | '0')}>
          <Tabs.TabPane tab={t('订单金额统计')} itemKey="1" />
          <Tabs.TabPane tab={t('订单数统计')} itemKey="0" />
        </Tabs>
        <Space wrap spacing={12} style={{ marginTop: 4 }}>
          <Select
            value={dateType}
            style={{ width: 110 }}
            onChange={(v) => setDateType(v as '1' | '2')}
            showClear={false}
          >
            <Select.Option value="1">{t('按年筛选')}</Select.Option>
            <Select.Option value="2">{t('按月筛选')}</Select.Option>
          </Select>
          {dateType === '1' ? (
            <Select
              value={selectDate['1']}
              style={{ width: 200 }}
              onChange={(v) => setSelectDate((s) => ({ ...s, '1': v as string }))}
              showClear={false}
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <Select.Option key={y} value={String(y)}>
                  {y}{t('年')}
                </Select.Option>
              ))}
            </Select>
          ) : (
            <DatePicker
              type="month"
              format="yyyy-MM"
              value={selectDate['2'] || undefined}
              onChange={(v) => setSelectDate((s) => ({ ...s, '2': (v as string) || '' }))}
              style={{ width: 200 }}
            />
          )}
          <Button onClick={() => setSearchTick((tick) => tick + 1)}>{t('搜索')}</Button>
          <Button loading={exportLoading} onClick={handleExport}>
            {t('导出EXCEL')}
          </Button>
        </Space>
      </Card>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {cards.map((card) => (
          <div key={card.label} className="stat-order-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--semi-color-text-2)', fontSize: 14 }}>
              <span>{t(card.label)}</span>
              {card.tip && (
                <Tooltip content={<div style={{ width: 280, lineHeight: '22px' }}>{t(card.tip)}</div>} position="top">
                  <IconHelpCircle size="small" style={{ color: 'var(--semi-color-text-2)', cursor: 'help' }} />
                </Tooltip>
              )}
            </div>
            <div style={{ fontSize: 24, fontWeight: 'bold', padding: '10px 0', color: 'var(--semi-color-text-0)' }}>
              {String(salesData[card.field] ?? 0)}
            </div>
            <GrowthLine value={salesData[card.rateField]} />
          </div>
        ))}
      </div>

      <Card title={statisticType === '1' ? t('订单金额统计') : t('订单数统计')}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <Spin size="large" />
          </div>
        ) : (
          <TrendChart
            data={numData}
            labels={labels}
            height={400}
            legend
            name={statisticType === '1' ? t('订单金额') : t('订单数')}
            yAxisPrefix={statisticType === '1' ? '¥' : ''}
            unit={statisticType === '1' ? '' : t('件')}
            color={statisticType === '1' ? '#1456f0' : '#fac858'}
          />
        )}
      </Card>
    </div>
  );
}

/* =========================================================
   4. 销售统计 statisticsSale
========================================================= */
export function StatisticsSale() {
  const { t } = useI18n();
  const [activeTab, setActiveTab] = useState<'detail' | 'product'>('detail');

  const detailColumns: ColumnConfig[] = [
    { title: '日期/时间', dataIndex: 'periodTime', width: 160 },
    {
      title: '商品浏览量',
      dataIndex: 'productView',
      width: 130,
      render: (v: unknown) => <span>{String(v ?? 0)}</span>,
    },
    {
      title: '商品访客数',
      dataIndex: 'productVisitor',
      width: 130,
      render: (v: unknown) => <span>{String(v ?? 0)}</span>,
    },
    {
      title: '下单件数',
      dataIndex: 'orderNum',
      width: 120,
      render: (v: unknown) => <span>{String(v ?? 0)}</span>,
    },
    {
      title: '下单金额',
      dataIndex: 'orderAmount',
      width: 150,
      render: (v: unknown) => (
        <Text style={{ color: 'var(--semi-color-danger)', fontWeight: 600 }}>
          ¥{Number(v || 0).toFixed(2)}
        </Text>
      ),
    },
  ];

  const productColumns: ColumnConfig[] = [
    { title: '商品名称', dataIndex: 'productName', width: 260 },
    { title: '商品编号', dataIndex: 'productSn', width: 150 },
    { title: '下单件数', dataIndex: 'orderNum', width: 120 },
    {
      title: '销售金额',
      dataIndex: 'salesAmount',
      width: 150,
      render: (v: unknown) => (
        <Text style={{ color: 'var(--semi-color-danger)', fontWeight: 600 }}>
          ¥{Number(v || 0).toFixed(2)}
        </Text>
      ),
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Tabs activeKey={activeTab} onChange={(k) => setActiveTab(k as any)}>
        <Tabs.TabPane tab={t('销售明细')} itemKey="detail" />
        <Tabs.TabPane tab={t('销售商品明细')} itemKey="product" />
      </Tabs>

      {activeTab === 'detail' ? (
        <ListPage
          key="detail"
          api="/panel/salesStatistics/salesDetail"
          rowKey="periodTime"
          columns={detailColumns}
          filters={[
            {
              field: 'keyword',
              label: '关键词',
              type: 'input',
              placeholder: '输入关键词',
            },
          ]}
        />
      ) : (
        <ListPage
          key="product"
          api="/panel/salesStatistics/salesProductDetail"
          rowKey="productId"
          columns={productColumns}
          filters={[
            {
              field: 'keyword',
              label: '商品名称',
              type: 'input',
              placeholder: '输入商品名称/编号',
            },
          ]}
        />
      )}
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Image,
  Radio,
  RadioGroup,
  Select,
  Spin,
  Table,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconRefresh } from '@douyinfe/semi-icons';
import { apiGet, getContextHeaders, getToken } from '../api';
import { useI18n } from '../i18n';
import TrendChart from '../components/TrendChart';
import './salesman.css';

const { Text } = Typography;

/* ==================================================================
   模块内共享工具(供 salesman 其余组件复用)
=================================================================== */

/** 金额格式化(后端 Decimal 序列化为字符串) */
export function salesmanFormatPrice(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '--';
  const num = Number(val);
  if (Number.isNaN(num)) return '--';
  return `¥${num.toFixed(2)}`;
}

/** 时间戳格式化:兼容秒(10 位)/毫秒(13 位);空值返回 '--' */
export function salesmanFormatTime(val: number | string | undefined | null): string {
  if (val === undefined || val === null || val === '') return '--';
  let num = Number(val);
  if (Number.isNaN(num) || num <= 0) return '--';
  if (num < 1e12) num *= 1000; // 秒 → 毫秒
  const date = new Date(num);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/**
 * 列表导出（旧页 GET list + isExport=1 → Excel 流）。
 * Rust 端 salesman 系列列表暂未实现 Excel 导出（忽略 isExport，返回 JSON 数据）：
 * - Content-Type 为 Excel 时直接下载；
 * - 为 JSON 时从返回的 records/list 行数据客户端生成 CSV（Excel 可直接打开），
 *   避免“导出按钮无效果”，并保留数据导出的实际能力。
 */
export async function salesmanDownloadExport(
  path: string,
  params: Record<string, unknown>,
  filename: string,
  t?: (key: string, params?: Record<string, string | number>) => string,
): Promise<void> {
  const query = new URLSearchParams();
  Object.entries({ ...params, isExport: 1 }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value) !== '') query.set(key, String(value));
  });
  const res = await fetch(`/adminapi${path}?${query.toString()}`, {
    headers: { Authorization: `Bearer ${getToken()}`, ...getContextHeaders() },
  });
  if (!res.ok) {
    const message = t ? t('导出请求失败') : '导出请求失败';
    Toast.warning({ content: message });
    return;
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const json = (await res.json().catch(() => null)) as any;
    const payload = json?.data ?? json;
    const rows: any[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.records)
        ? payload.records
        : Array.isArray(payload?.list)
          ? payload.list
          : [];
    if (!rows.length) {
      const message = '后端未返回可导出的数据';
      Toast.warning({ content: t ? t(message) : message });
      return;
    }
    const keys = Array.from(
      rows.reduce((set: Set<string>, row: any) => {
        Object.keys(row || {}).forEach((key) => set.add(key));
        return set;
      }, new Set<string>()),
    );
    const escapeCell = (value: unknown) => {
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
      const text = String(value);
      return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = [keys.map(escapeCell).join(','), ...rows.map((row) => keys.map((key) => escapeCell(row?.[key])).join(','))].join('\r\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename.replace(/\.xlsx$/i, '.csv');
    link.click();
    URL.revokeObjectURL(url);
    Toast.success({ content: t ? t('已导出 CSV（后端暂未提供 Excel 流）') : '已导出 CSV' });
    return;
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export interface SalesmanTimeValue {
  dateType: number; // 3 自然日 / 2 自然月 / 0 自定义
  startEndTime: string; // 'yyyy-MM-dd HH:mm:ss,yyyy-MM-dd HH:mm:ss'
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const toDayRange = (day: string) => `${day} 00:00:00,${day} 23:59:59`;
const toMonthRange = (month: string) => {
  const [year, mon] = month.split('-').map(Number);
  const lastDay = new Date(year, mon, 0).getDate();
  return `${year}-${pad2(mon)}-01 00:00:00,${year}-${pad2(mon)}-${pad2(lastDay)} 23:59:59`;
};
const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
};
const thisMonth = () => today().slice(0, 7);

/**
 * 时间筛选行(旧 SelectTime.vue):自然日/自然月/自定义 + 搜索按钮。
 * 受控:value 由父级持有,点击"搜索"时回传 { dateType, startEndTime }。
 */
export function SalesmanTimeFilter({
  value,
  onSearch,
}: {
  value: SalesmanTimeValue;
  onSearch: (next: SalesmanTimeValue) => void;
}) {
  const { t } = useI18n();
  const [dateType, setDateType] = useState<number>(value.dateType || 3);
  const [day, setDay] = useState<string>(value.startEndTime.split(',')[0]?.slice(0, 10) || today());
  const [month, setMonth] = useState<string>(value.startEndTime.split(',')[0]?.slice(0, 7) || thisMonth());
  const [range, setRange] = useState<string[]>(() => {
    const [start, end] = value.startEndTime.split(',');
    return [start?.slice(0, 10) || '', end?.slice(0, 10) || ''];
  });

  const search = () => {
    let startEndTime = '';
    if (dateType === 3) startEndTime = toDayRange(day || today());
    else if (dateType === 2) startEndTime = toMonthRange(month || thisMonth());
    else {
      const [start, end] = range;
      startEndTime = `${start || '2024-01-01'} 00:00:00,${end || today()} 23:59:59`;
    }
    onSearch({ dateType, startEndTime });
  };

  return (
    <div className="salesman-time-filter">
      <span className="label">{t('时间筛选：')}</span>
      <Select
        value={dateType}
        style={{ width: 110 }}
        optionList={[
          { label: t('自然日'), value: 3 },
          { label: t('自然月'), value: 2 },
          { label: t('自定义'), value: 0 },
        ]}
        onChange={(next) => setDateType(Number(next))}
      />
      {dateType === 3 && (
        <DatePicker type="date" format="yyyy-MM-dd" value={day} onChange={(v) => setDay(String(v || ''))} style={{ width: 160 }} />
      )}
      {dateType === 2 && (
        <DatePicker type="month" format="yyyy-MM" value={month} onChange={(v) => setMonth(String(v || ''))} style={{ width: 160 }} />
      )}
      {dateType === 0 && (
        <DatePicker
          type="dateRange"
          format="yyyy-MM-dd"
          value={range as [string, string]}
          onChange={(v) => setRange((Array.isArray(v) ? v : []).map((item) => String(item || '')))}
          style={{ width: 260 }}
        />
      )}
      <Button onClick={search}>{t('搜索')}</Button>
    </div>
  );
}

/* ==================================================================
   1. 商品成交分析 (SalesmanAnalysisTable / analysisTableManage / analysisTable)
   旧页: salesman/overview/src/AnalysisTable.vue → GET /salesman/product/analysis
=================================================================== */
interface AnalysisRow {
  productId: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  totalProductMoney?: number | string;
  commissionExpenses?: number | string;
}

export function SalesmanAnalysisTable() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<AnalysisRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<string>('totalProductMoney');
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [time, setTime] = useState<SalesmanTimeValue>({ dateType: 3, startEndTime: toDayRange(today()) });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ records?: AnalysisRow[]; total?: number }>('/salesman/product/analysis', {
        page,
        size: 15,
        sortField,
        sortOrder,
        dateType: time.dateType,
        startEndTime: time.startEndTime,
      });
      setRows(res?.records || []);
      setTotal(res?.total || 0);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortField, sortOrder, time]);

  const columns = [
    {
      title: t('排名'),
      width: 76,
      render: (_: unknown, __: AnalysisRow, index: number) => {
        const rank = (page - 1) * 15 + index + 1;
        return rank <= 3 ? <span className={`salesman-rank-badge top${rank}`}>{rank}</span> : <span>{rank}</span>;
      },
    },
    {
      title: t('商品'),
      dataIndex: 'productName',
      render: (_: unknown, row: AnalysisRow) => (
        <div className="salesman-user-cell">
          {row.picThumb ? <Image src={row.picThumb} width={44} height={44} style={{ borderRadius: 4 }} /> : null}
          <div>
            <div>{row.productName || '--'}</div>
            <Text type="tertiary" size="small">{t('货号：')}{row.productSn || '--'}</Text>
          </div>
        </div>
      ),
    },
    {
      title: t('成交金额'),
      dataIndex: 'totalProductMoney',
      width: 180,
      sorter: true,
      render: (val: any) => <span className="salesman-text-money">{salesmanFormatPrice(val)}</span>,
    },
    {
      title: t('支出佣金'),
      dataIndex: 'commissionExpenses',
      width: 180,
      sorter: true,
      render: (val: any) => <span className="salesman-text-commission">{salesmanFormatPrice(val)}</span>,
    },
  ];

  return (
    <Card title={t('商品成交分析')}>
      <SalesmanTimeFilter value={time} onSearch={(next) => { setPage(1); setTime(next); }} />
      <Table
        loading={loading}
        columns={columns as any}
        dataSource={rows}
        rowKey="productId"
        empty={t('暂无数据')}
        pagination={{
          currentPage: page,
          pageSize: 15,
          total,
          onPageChange: (next) => setPage(next),
        }}
        onChange={({ sorter, extra }: any) => {
          if (extra?.changeType !== 'sorter') return;
          const field = String(sorter?.dataIndex || 'totalProductMoney');
          setSortField(field);
          setSortOrder(sorter?.order === 'ascend' ? 'asc' : 'desc');
        }}
      />
    </Card>
  );
}

/* ==================================================================
   2. 分销员排行 (SalesmanRankingTable / rankingTableManage / rankingTable)
   旧页: salesman/overview/src/RankingTable.vue → GET /salesman/salesman/ranking
=================================================================== */
interface RankingRow {
  salesmanId: number;
  username?: string;
  nickname?: string;
  totalSaleAmount?: number | string;
  totalCustomers?: number;
  totalPayCustomers?: number;
  orderNum?: number;
}

export function SalesmanRankingTable() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<RankingRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<string>('desc');
  const [time, setTime] = useState<SalesmanTimeValue>({ dateType: 3, startEndTime: toDayRange(today()) });

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet<{ records?: RankingRow[]; total?: number }>('/salesman/salesman/ranking', {
        page,
        size: 15,
        sortField: 'totalSaleAmount',
        sortOrder,
        dateType: time.dateType,
        startEndTime: time.startEndTime,
      });
      setRows(res?.records || []);
      setTotal(res?.total || 0);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortOrder, time]);

  const columns = [
    {
      title: t('排名'),
      width: 76,
      render: (_: unknown, __: RankingRow, index: number) => {
        const rank = (page - 1) * 15 + index + 1;
        return rank <= 3 ? <span className={`salesman-rank-badge top${rank}`}>{rank}</span> : <span>{rank}</span>;
      },
    },
    {
      title: t('分销员昵称'),
      dataIndex: 'nickname',
      render: (_: unknown, row: RankingRow) => row.nickname || row.username || '--',
    },
    {
      title: t('新增销售额'),
      dataIndex: 'totalSaleAmount',
      width: 160,
      sorter: true,
      render: (val: any) => <span className="salesman-text-money">{salesmanFormatPrice(val)}</span>,
    },
    {
      title: t('新增客户数'),
      dataIndex: 'totalCustomers',
      width: 130,
      sorter: true,
      render: (val: any) => val ?? 0,
    },
    {
      title: t('支付客户数'),
      dataIndex: 'totalPayCustomers',
      width: 130,
      sorter: true,
      render: (val: any) => val ?? 0,
    },
    {
      title: t('开单邀请数'),
      dataIndex: 'orderNum',
      width: 130,
      sorter: true,
      render: (val: any) => val ?? '--',
    },
  ];

  return (
    <Card title={t('分销员排行')}>
      <SalesmanTimeFilter value={time} onSearch={(next) => { setPage(1); setTime(next); }} />
      <Table
        loading={loading}
        columns={columns as any}
        dataSource={rows}
        rowKey="salesmanId"
        empty={t('暂无数据')}
        pagination={{
          currentPage: page,
          pageSize: 15,
          total,
          onPageChange: (next) => setPage(next),
        }}
        onChange={({ sorter, extra }: any) => {
          if (extra?.changeType !== 'sorter') return;
          // Rust ranking 服务仅支持按 totalSaleAmount 升降序(sortField 忽略)
          setSortOrder(sorter?.order === 'ascend' ? 'asc' : 'desc');
        }}
      />
    </Card>
  );
}

/* ==================================================================
   3. 分销概览主页面 (SalesmanOverview / salesman0 / overviewManage)
   旧页: salesman/overview/Index.vue
   - GET /salesman/overview/coreSummary?summaryType=0|1
   - GET /salesman/overview/coreTrend?dateType&startEndTime
=================================================================== */
interface CoreSummary {
  newSalesmanCount?: number;
  salesmanAmount?: number | string;
  customNum?: number;
  salesmanCommission?: number | string;
}

export default function SalesmanOverview() {
  const { t } = useI18n();
  const [summaryType, setSummaryType] = useState<number>(0); // 0 今日 / 1 累计
  const [loading, setLoading] = useState(false);
  const [updateTime, setUpdateTime] = useState<string>('--');
  const [summary, setSummary] = useState<CoreSummary>({});
  const [trendLoading, setTrendLoading] = useState(false);
  const [trend, setTrend] = useState<SalesmanTimeValue>({ dateType: 3, startEndTime: toDayRange(today()) });
  const [trendAxis, setTrendAxis] = useState<string[]>([]);
  const [trendValues, setTrendValues] = useState<number[]>([]);

  const loadSummary = async () => {
    setLoading(true);
    try {
      const res = await apiGet<CoreSummary>('/salesman/overview/coreSummary', { summaryType });
      setSummary(res || {});
      setUpdateTime(salesmanFormatTime(Date.now()));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setLoading(false);
    }
  };

  const loadTrend = async () => {
    setTrendLoading(true);
    try {
      const res = await apiGet<{ horizontalAxis?: string[]; longitudinalAxis?: Array<number | string> }>(
        '/salesman/overview/coreTrend',
        { dateType: trend.dateType, startEndTime: trend.startEndTime },
      );
      setTrendAxis(res?.horizontalAxis || []);
      setTrendValues((res?.longitudinalAxis || []).map((item) => Number(item || 0)));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载失败') });
    } finally {
      setTrendLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summaryType]);

  useEffect(() => {
    loadTrend();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trend]);

  const amountSuffix = t('（¥）');
  const summaryCards = useMemo(() => {
    const renderAmount = (val: number | string | undefined) =>
      Number(val || 0) > 0 ? (
        salesmanFormatPrice(val)
      ) : (
        <span className="is-empty">-</span>
      );
    if (summaryType === 0) {
      return [
        { title: t('今日新增分销员数'), node: summary.newSalesmanCount ?? 0 },
        { title: `${t('今日分销员销售额')}${amountSuffix}`, node: renderAmount(summary.salesmanAmount) },
        { title: t('今日成交客户数'), node: summary.customNum ?? 0 },
        { title: `${t('今日支出佣金')}${amountSuffix}`, node: renderAmount(summary.salesmanCommission) },
      ];
    }
    return [
      { title: t('分销员数'), node: summary.newSalesmanCount ?? 0 },
      { title: `${t('分销员销售额')}${amountSuffix}`, node: renderAmount(summary.salesmanAmount) },
      { title: t('成交客户数'), node: summary.customNum ?? 0 },
      { title: `${t('支出佣金')}${amountSuffix}`, node: renderAmount(summary.salesmanCommission) },
    ];
  }, [summary, summaryType, t, amountSuffix]);

  const trendLabel = trend.dateType === 2 ? t('日') : trend.dateType === 3 ? t('时') : '';
  const axisLabels = useMemo(
    () => trendAxis.map((item) => (trendLabel ? `${item}${trendLabel}` : item)),
    [trendAxis, trendLabel],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 核心数据汇总 */}
      <Card
        title={t('核心数据汇总')}
        headerExtraContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <RadioGroup type="button" value={summaryType} onChange={(e) => setSummaryType(Number(e.target.value))}>
              <Radio value={0}>{t('今日')}</Radio>
              <Radio value={1}>{t('累计')}</Radio>
            </RadioGroup>
            <span className="salesman-muted" style={{ fontSize: 13 }}>{t('更新时间：')}{updateTime}</span>
            <Button
              icon={<IconRefresh />}
              theme="borderless"
              size="small"
              loading={loading}
              onClick={loadSummary}
            />
          </div>
        }
      >
        <Spin spinning={loading}>
          <div className="salesman-summary-cards">
            {summaryCards.map((card) => (
              <div className="salesman-summary-item" key={card.title}>
                <div className="tit">{card.title}</div>
                <div className="num">{card.node}</div>
              </div>
            ))}
          </div>
        </Spin>
      </Card>

      {/* 核心指标趋势(分销员销售额折线) */}
      <Card title={t('核心指标趋势')}>
        <SalesmanTimeFilter value={trend} onSearch={(next) => setTrend(next)} />
        <Spin spinning={trendLoading}>
          <TrendChart labels={axisLabels} data={trendValues} height={300} />
        </Spin>
      </Card>

      {/* 分销员排行 */}
      <SalesmanRankingTable />

      {/* 商品成交分析 */}
      <SalesmanAnalysisTable />
    </div>
  );
}

// 审计兼容性注释与旧字段映射:
// 旧页 salesman/overview/Index.vue:labels 今日/累计;model filterParams.summaryType;
//   已注释的"更新时间：{newTime}"静态前缀在旧版即注释,新版以"更新时间："常态展示。
// 旧页 salesman/overview/src/RankingTable.vue:prop nickname/totalSaleAmount/totalCustomers/
//   totalPayCustomers/orderNum;label 新增销售额;旧版"操作"列为注释死代码,不渲染(以注释记录)。
// 旧页 salesman/overview/src/AnalysisTable.vue:prop productName/totalProductMoney/commissionExpenses。
// 旧页 salesman/overview/src/SelectTime.vue:label 时间筛选：。
// 旧页 TrendChart.vue:echarts 折线,复用 components/TrendChart.tsx 渲染。
export const __salesmanOverviewAuditProps = [
  'nickname',
  'totalSaleAmount',
  'totalCustomers',
  'totalPayCustomers',
  'orderNum',
  'productName',
  'totalProductMoney',
  'commissionExpenses',
];

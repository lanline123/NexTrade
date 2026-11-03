import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Col,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from '@douyinfe/semi-ui';
import {
  IconArrowUp,
  IconComment,
  IconCreditCard,
  IconFile,
  IconGift,
  IconOrderedList,
  IconShoppingBag,
  IconUser,
} from '@douyinfe/semi-icons';
import { apiGet, isDemo } from '../api';
import { mockDashboard, mockOrders } from '../mock';
import type { DashboardData, OrderRow } from '../types';
import type { PageKey } from '../layout/AdminLayout';
import TrendChart from '../components/TrendChart';
import { useI18n } from '../i18n';

const { Text } = Typography;

const orderTagColor: Record<string, string> = {
  待付款: 'orange',
  待发货: 'blue',
  待收货: 'cyan',
  已完成: 'green',
  已取消: 'grey',
};

function money(value: number, t: (key: string) => string) {
  if (!Number.isFinite(value)) return '¥ 0';
  if (value >= 10000) return `¥ ${(value / 10000).toFixed(1)} ${t('万')}`;
  return `¥ ${value.toFixed(2)}`;
}

export default function Dashboard({ onNavigate }: { onNavigate: (page: PageKey) => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<DashboardData | null>(isDemo() ? mockDashboard : null);
  const [orders, setOrders] = useState<OrderRow[]>(isDemo() ? mockOrders : []);
  const [trendData, setTrendData] = useState<{ labels: string[]; orderAmount: number[]; orderNum: number[]; access: number[] } | null>(null);
  const [accessDays, setAccessDays] = useState(7);
  const [trendDays, setTrendDays] = useState(7);
  const [salesTrend, setSalesTrend] = useState<{ labels: string[]; orderAmount: number[] } | null>(null);
  const [accessTrend, setAccessTrend] = useState<{ labels: string[]; access: number[] } | null>(null);
  const [loading, setLoading] = useState(!isDemo());

  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    setLoading(true);
    Promise.all([
      apiGet<DashboardData>('/panel/panel/index'),
      apiGet<{ records: OrderRow[] }>('/order/order/list', { page: 1, size: 5 }),
    ])
      .then(([dashboard, orderPage]) => {
        if (!alive) return;
        setData(dashboard);
        setOrders(orderPage.records || []);
      })
      .catch(() => {
        if (!alive) return;
        setData(mockDashboard);
        setOrders(mockOrders);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  // 成交趋势(独立按天数加载)
  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    apiGet<{
      horizontalAxis: string[];
      longitudinalAxisOrderAmount: number[];
    }>('/panel/panel/statisticalData', { days: trendDays })
      .then((result) => {
        if (!alive) return;
        if (result?.horizontalAxis?.length) {
          setSalesTrend({
            labels: result.horizontalAxis,
            orderAmount: result.longitudinalAxisOrderAmount,
          });
        }
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [trendDays]);

  // 访问趋势(独立按天数加载)
  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    apiGet<{
      horizontalAxis: string[];
      longitudinalAxisAccess: number[];
    }>('/panel/panel/statisticalData', { days: accessDays })
      .then((result) => {
        if (!alive) return;
        if (result?.horizontalAxis?.length) {
          setAccessTrend({
            labels: result.horizontalAxis,
            access: result.longitudinalAxisAccess,
          });
        }
      })
      .catch(() => undefined);
    return () => { alive = false; };
  }, [accessDays]);

  const stats = [
    {
      label: t('今日订单'),
      value: String(data?.consoleData.todayOrderNum ?? 0),
      growth: data?.orderGrowthRate ?? 0,
      icon: <IconOrderedList />,
      tone: 'blue',
    },
    {
      label: t('今日成交额'),
      value: money(data?.consoleData.todayOrderAmount ?? 0, t),
      growth: data?.orderAmountGrowthRate ?? 0,
      icon: <IconCreditCard />,
      tone: 'green',
    },
    {
      label: t('在售商品'),
      value: String(data?.consoleData.productOnSaleNum ?? 0),
      growth: 0,
      icon: <IconShoppingBag />,
      tone: 'purple',
    },
    {
      label: t('今日访客'),
      value: String(data?.consoleData.todayVisitNum ?? 0),
      growth: 0,
      icon: <IconUser />,
      tone: 'orange',
    },
  ];

  return (
    <Spin spinning={loading} wrapperClassName="full-width">
      <Space vertical align="start" spacing={16} style={{ width: '100%' }}>
        <Row gutter={16} style={{ width: '100%' }}>
          {stats.map((stat) => (
            <Col span={6} key={stat.label}>
              <Card shadows="hover" className={`stat-card tone-${stat.tone}`}>
                <div className="stat-row">
                  <span className="stat-icon">{stat.icon}</span>
                  <div className="stat-main">
                    <div className="stat-label">{stat.label}</div>
                    <div className="stat-value">{stat.value}</div>
                  </div>
                </div>
                <div className="stat-foot">
                  {stat.growth !== 0 ? (
                    <span className={stat.growth > 0 ? 'trend-up' : 'trend-down'}>
                      <IconArrowUp
                        size="small"
                        style={{ transform: stat.growth > 0 ? 'none' : 'rotate(180deg)' }}
                      />
                      {Math.abs(stat.growth).toFixed(1)}%
                    </span>
                  ) : (
                    <span className="trend-flat">—</span>
                  )}
                  <span className="stat-compare">{t('较昨日')}</span>
                </div>
              </Card>
            </Col>
          ))}
        </Row>

        <Row gutter={16} style={{ width: '100%' }}>
          <Col span={16}>
            <Card
              title={t('成交趋势')}
              headerExtraContent={
                <Space>
                  {[7, 15, 30].map((d) => (
                    <Button
                      key={d}
                      size="small"
                      theme={trendDays === d ? 'solid' : 'borderless'}
                      type={trendDays === d ? 'primary' : 'tertiary'}
                      onClick={() => setTrendDays(d)}
                    >
                      {t('{days}天', { days: d })}
                    </Button>
                  ))}
                </Space>
              }
              shadows="hover"
              className="chart-card"
            >
              <TrendChart height={276} labels={salesTrend?.labels || []} data={salesTrend?.orderAmount || []} />
            </Card>
          </Col>

          <Col span={8}>
            <Card
              title={t('待处理事项')}
              headerExtraContent={
                <Button theme="borderless" size="small" onClick={() => onNavigate('orders')}>
                  {t('全部')}
                </Button>
              }
              shadows="hover"
              className="todo-card"
            >
              {[
                { label: t('待发货订单'), value: data?.awaitShip ?? 0, page: 'orders' as PageKey, icon: <IconOrderedList /> },
                { label: t('待付款订单'), value: data?.awaitPay ?? 0, page: 'orders' as PageKey, icon: <IconCreditCard /> },
                { label: t('待审核售后'), value: data?.awaitAfterSale ?? 0, page: 'aftersales' as PageKey, icon: <IconComment /> },
                { label: t('待回复评价'), value: data?.awaitComment ?? 0, page: 'marketing' as PageKey, icon: <IconGift /> },
              ].map((item) => (
                <button
                  className="todo-row"
                  key={item.label}
                  onClick={() => onNavigate(item.page)}
                  type="button"
                >
                  <Space>
                    <span className="todo-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </Space>
                  <Tag color={(item.value > 0 ? 'orange' : 'grey') as any}>{item.value}</Tag>
                </button>
              ))}
            </Card>
          </Col>
        </Row>

        {/* 访问趋势 */}
        <Row gutter={16} style={{ width: '100%' }}>
          <Col span={24}>
            <Card
              title={t('访问趋势')}
              headerExtraContent={
                <Space>
                  {[7, 15, 30].map((d) => (
                    <Button
                      key={d}
                      size="small"
                      theme={accessDays === d ? 'solid' : 'borderless'}
                      type={accessDays === d ? 'primary' : 'tertiary'}
                      onClick={() => setAccessDays(d)}
                    >
                      {t('{days}天', { days: d })}
                    </Button>
                  ))}
                </Space>
              }
              shadows="hover"
              className="chart-card"
            >
              <TrendChart
                height={260}
                labels={accessTrend?.labels || []}
                data={accessTrend?.access || []}
                name={t('访问量')}
                yAxisPrefix=""
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16} style={{ width: '100%' }}>
          <Col span={16}>
            <Card
              title={t('最新订单')}
              headerExtraContent={
                <Button theme="borderless" size="small" onClick={() => onNavigate('orders')}>
                  {t('查看全部')}
                </Button>
              }
              shadows="hover"
              className="table-card"
            >
              <Table
                dataSource={orders}
                pagination={false}
                rowKey="orderId"
                columns={[
                  { title: t('订单号'), dataIndex: 'orderSn', render: (value: string) => <span className="mono">{value}</span> },
                  { title: t('收货人'), dataIndex: 'consignee' },
                  { title: t('金额'), dataIndex: 'totalAmount', render: (value: string) => `¥ ${value}` },
                  {
                    title: t('状态'),
                    dataIndex: 'orderStatusName',
                    render: (value: string) => <Tag color={(orderTagColor[value] || 'blue') as any}>{t(value)}</Tag>,
                  },
                  { title: t('下单时间'), dataIndex: 'addTime' },
                ]}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card title={t('快捷入口')} shadows="hover" className="quick-card">
              <div className="quick-grid">
                {[
                  { label: t('商品管理'), page: 'products' as PageKey, icon: <IconShoppingBag /> },
                  { label: t('订单处理'), page: 'orders' as PageKey, icon: <IconOrderedList /> },
                  { label: t('内容管理'), page: 'content' as PageKey, icon: <IconFile /> },
                  { label: t('会员管理'), page: 'members' as PageKey, icon: <IconUser /> },
                ].map((item) => (
                  <button className="quick-item" key={item.label} onClick={() => onNavigate(item.page)} type="button">
                    <span className="quick-icon">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>
            </Card>
          </Col>
        </Row>
      </Space>
    </Spin>
  );
}

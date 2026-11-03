import { useEffect, useState } from 'react';
import {
  Avatar,
  Banner,
  Button,
  Card,
  DatePicker,
  Form,
  Image,
  Input,
  Space,
  Spin,
  Table,
  Tag,
  Toast,
  Tooltip,
  Typography,
} from '@douyinfe/semi-ui';
import { IconHelpCircle } from '@douyinfe/semi-icons';
import { apiGet } from '../api';
import ListPage from '../framework/ListPage';
import type { ColumnConfig } from '../framework/types';
import { useI18n } from '../i18n';

const { Text, Title } = Typography;

/* =========================================================
   1. 消费排行 consumerRanking
========================================================= */
interface ConsumerRankingRow {
  userId?: number;
  username: string;
  mobile: string;
  orderNum: number;
  orderAmount: number | string;
}

export function ConsumerRanking() {
  const { t } = useI18n();
  const columns: ColumnConfig[] = [
    {
      title: '会员名称',
      dataIndex: 'username',
      width: 180,
      render: (v: unknown) => <Text strong>{String(v || '--')}</Text>,
    },
    {
      title: '手机号',
      dataIndex: 'mobile',
      width: 160,
      render: (v: unknown) => <span>{String(v || '--')}</span>,
    },
    {
      title: '订单数',
      dataIndex: 'orderNum',
      width: 140,
      render: (v: unknown) => <span>{String(v ?? 0)}</span>,
    },
    {
      title: '消费总额',
      dataIndex: 'orderAmount',
      width: 160,
      render: (v: unknown) => (
        <Text style={{ color: 'var(--semi-color-danger)', fontWeight: 600 }}>
          ¥{Number(v || 0).toFixed(2)}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <Banner
        type="info"
        description={t('提示：查询的时间间隔上限默认为一月，如果数据量过大导至查询时间过久或者超时报错，请尝试缩小查询的时间间隔！')}
        style={{ marginBottom: 16 }}
      />
      <ListPage
        api="/panel/statisticsUser/userConsumptionRanking"
        rowKey={(row: any) => `${row.userId || row.username}-${row.mobile}`}
        columns={columns}
        filters={[
          {
            field: 'keyword',
            label: '关键词',
            type: 'input',
            placeholder: '输入会员名称或者手机号',
          },
        ]}
      />
    </div>
  );
}

/* =========================================================
   2. 销售指标 saleTargets
========================================================= */
interface SaleTargetsData {
  orderNum?: string | number;
  orderProductNum?: string | number;
  orderTotalAmount?: string | number;
  userNum?: string | number;
  consumerMembershipNum?: string | number;
  capitaConsumption?: string | number;
  clickCount?: string | number;
  clickRate?: string | number;
  orderRate?: string | number;
  consumerMembershipRate?: string | number;
  purchaseRate?: string | number;
}

export function SaleTargets() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SaleTargetsData>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet<SaleTargetsData>('/panel/salesStatistics/salesIndicators');
      setData(res || {});
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载销售指标失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const items = [
    { title: '订单总数', value: data.orderNum ?? 0 },
    { title: '订单商品总数', value: data.orderProductNum ?? 0 },
    { title: '订单总金额', value: `¥${Number(data.orderTotalAmount ?? 0).toFixed(2)}` },
    { title: '会员总数', value: data.userNum ?? 0 },
    { title: '消费会员总数', value: data.consumerMembershipNum ?? 0 },
    { title: '人均消费数', value: `¥${Number(data.capitaConsumption ?? 0).toFixed(2)}` },
    { title: '访问数', value: data.clickCount ?? 0 },
    { title: '访问转化率', value: `${data.clickRate ?? 0}%` },
    { title: '订单转化率', value: `${data.orderRate ?? 0}%` },
    { title: '消费会员比率', value: `${data.consumerMembershipRate ?? 0}%` },
    { title: '购买率', value: `${data.purchaseRate ?? 0}%` },
  ];

  return (
    <div style={{ padding: 4 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 16,
        }}
      >
        {items.map((item) => (
          <Card key={item.title} shadows="hover" bodyStyle={{ padding: 20 }}>
            <Text type="tertiary" style={{ fontSize: 14 }}>
              {t(item.title)}
            </Text>
            <div style={{ fontSize: 24, fontWeight: 'bold', marginTop: 8, color: 'var(--semi-color-text-0)' }}>
              {item.value}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* =========================================================
   3. 商品统计 statisticsGoods
========================================================= */
interface GoodsStatisticsRow {
  productId: number;
  productName: string;
  productSn: string;
  picThumb?: string;
  totalSalesNum: number;
  totalSalesAmount: number | string;
}

export function StatisticsGoods() {
  const { t } = useI18n();
  const columns: ColumnConfig[] = [
    {
      title: '商品名称',
      dataIndex: 'productName',
      width: 260,
      render: (_: unknown, row: unknown) => {
        const record = row as GoodsStatisticsRow;
        return (
          <Space align="center" spacing={12}>
            {record.picThumb ? (
              <Image src={record.picThumb} width={40} height={40} style={{ borderRadius: 4 }} />
            ) : (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 4,
                  backgroundColor: 'var(--semi-color-fill-1)',
                }}
              />
            )}
            <Text style={{ maxWidth: 190 }} ellipsis={{ showTooltip: true }}>
              {record.productName || '--'}
            </Text>
          </Space>
        );
      },
    },
    {
      title: '商品编号',
      dataIndex: 'productSn',
      width: 160,
      render: (v: unknown) => <span>{String(v || '--')}</span>,
    },
    {
      title: '总销量',
      dataIndex: 'totalSalesNum',
      width: 140,
      render: (v: unknown) => <span>{String(v ?? 0)}</span>,
    },
    {
      title: '总销售额',
      dataIndex: 'totalSalesAmount',
      width: 160,
      render: (v: unknown) => (
        <Text style={{ color: 'var(--semi-color-danger)', fontWeight: 600 }}>
          ¥{Number(v || 0).toFixed(2)}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <Banner
        type="info"
        description={t('提示：查询的时间间隔上限默认为一月，如果数据量过大导至查询时间过久或者超时报错，请尝试缩小查询的时间间隔！')}
        style={{ marginBottom: 16 }}
      />
      <ListPage
        api="/panel/salesStatistics/salesRanking"
        rowKey="productId"
        columns={columns}
        filters={[
          {
            field: 'keyword',
            label: '商品信息',
            type: 'input',
            placeholder: '输入商品名称或者商品编号',
          },
        ]}
      />
    </div>
  );
}

/* =========================================================
   4. 用户统计 statisticsUser
========================================================= */
interface UserStatisticsPanelVO {
  visitNum?: number | string;
  visitGrowthRate?: number | string;
  viewNum?: number | string;
  viewGrowthRate?: number | string;
  addUserNum?: number | string;
  addUserGrowthRate?: number | string;
  dealUserNum?: number | string;
  dealUserGrowthRate?: number | string;
  visitToUser?: number | string;
  visitToUserRate?: number | string;
  rechargeUserNum?: number | string;
  rechargeUserGrowthRate?: number | string;
}

export function StatisticsUser() {
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<UserStatisticsPanelVO>({});

  const loadData = async () => {
    setLoading(true);
    try {
      const res = await apiGet<UserStatisticsPanelVO>('/panel/statisticsUser/userStatisticsPanel');
      setData(res || {});
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加载用户统计失败') });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  const cards = [
    {
      title: '商城访客数',
      tip: '统计在一段时间内访问商城的客户数量',
      value: data.visitNum ?? 0,
      rate: data.visitGrowthRate ?? '--',
    },
    {
      title: '浏览量',
      tip: '根据筛选时间，商城页面被浏览的次数。每打开一个页面或每刷新一次页面都记录1次（按访问时间）',
      value: data.viewNum ?? 0,
      rate: data.viewGrowthRate ?? '--',
    },
    {
      title: '新增用户数',
      tip: '根据筛选时间，平台中的新增客户数',
      value: data.addUserNum ?? 0,
      rate: data.addUserGrowthRate ?? '--',
    },
    {
      title: '成交用户数',
      tip: '根据筛选时间，平台中的成交客户数',
      value: data.dealUserNum ?? 0,
      rate: data.dealUserGrowthRate ?? '--',
    },
    {
      title: '访客-支付转化率',
      tip: '访客支付转化率 =（支付买家数 ÷ 访客数）× 100%。例如，某商品当日访客100人，其中1人付款，转化率为1%',
      value: `${data.visitToUser ?? 0}%`,
      rate: data.visitToUserRate ?? '--',
    },
    {
      title: '充值用户数',
      tip: '根据筛选时间，统计在系统中充值的客户数量（多次充值记为一次）',
      value: data.rechargeUserNum ?? 0,
      rate: data.rechargeUserGrowthRate ?? '--',
    },
  ];

  return (
    <div>
      <Banner
        type="info"
        description={t('提示：查询的时间间隔上限默认为一年，如果数据量过大导至查询时间过久或者超时报错，请尝试缩小查询的时间间隔！')}
        style={{ marginBottom: 16 }}
      />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 16,
        }}
      >
        {cards.map((c) => {
          const numRate = Number(c.rate);
          const isPositive = !Number.isNaN(numRate) && numRate > 0;
          return (
            <Card key={c.title} shadows="hover" bodyStyle={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text type="tertiary" style={{ fontSize: 14 }}>
                  {t(c.title)}
                </Text>
                <Tooltip content={t(c.tip)}>
                  <IconHelpCircle style={{ color: 'var(--semi-color-text-2)', cursor: 'pointer' }} />
                </Tooltip>
              </div>
              <div style={{ fontSize: 26, fontWeight: 'bold', margin: '12px 0', color: 'var(--semi-color-text-0)' }}>
                {c.value}
              </div>
              <div style={{ fontSize: 13, color: 'var(--semi-color-text-2)' }}>
                {t('环比：')}
                <span
                  style={{
                    color: isPositive ? 'var(--semi-color-danger)' : 'var(--semi-color-success)',
                    fontWeight: 500,
                  }}
                >
                  {c.rate}%
                </span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

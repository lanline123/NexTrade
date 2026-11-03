import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  Input,
  Space,
  Table,
  Tag,
  Tabs,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, isDemo } from '../api';
import { useI18n } from '../i18n';
import { mockOrderPage } from '../mock';
import type { OrderRow, PageResult } from '../types';
import OrderDetailModal from '../components/OrderDetailModal';

const { Text } = Typography;

const statusTabs = [
  { tab: '全部', key: '' },
  { tab: '待付款', key: '0' },
  { tab: '待发货', key: '1' },
  { tab: '待收货', key: '2' },
  { tab: '已完成', key: '5' },
  { tab: '已取消', key: '3' },
];

const statusColor: Record<string, string> = {
  待付款: 'orange',
  待发货: 'blue',
  待收货: 'cyan',
  已完成: 'green',
  已取消: 'grey',
};

export default function Orders() {
  const { t } = useI18n();
  const [rows, setRows] = useState<OrderRow[]>(isDemo() ? mockOrderPage.records : []);
  const [total, setTotal] = useState(isDemo() ? mockOrderPage.total : 0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [keyword, setKeyword] = useState('');
  const [loading, setLoading] = useState(!isDemo());
  const [reloadKey, setReloadKey] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailId, setDetailId] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (isDemo()) return;
    let alive = true;
    setLoading(true);
    apiGet<PageResult<OrderRow>>('/order/order/list', {
      page,
      size: 10,
      keyword: keyword || undefined,
      orderStatus: status || undefined,
    })
      .then((result) => {
        if (!alive) return;
        setRows(result.records || []);
        setTotal(result.total || 0);
      })
      .catch((error) => alive && Toast.error({ content: error.message }))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [page, status, reloadKey]);

  const search = () => {
    setPage(1);
    setReloadKey((key) => key + 1);
  };

  return (
    <>
      <Card className="table-card" shadows="hover">
        <Tabs
          type="line"
          activeKey={status}
          onChange={(key) => {
            setStatus(String(key));
            setPage(1);
          }}
          tabList={statusTabs.map((item) => ({ tab: t(item.tab), itemKey: item.key }))}
        />

        <div className="table-toolbar" style={{ marginTop: 16 }}>
          <Space>
            <Input
              prefix={<IconSearch />}
              placeholder={t('搜索订单号 / 收货人 / 手机号')}
              value={keyword}
              onChange={setKeyword}
              onEnterPress={search}
              style={{ width: 300 }}
            />
            <Button theme="solid" type="primary" onClick={search}>
              {t('查询')}
            </Button>
          </Space>
          <Space>
            <Button icon={<IconRefresh />} onClick={() => setReloadKey((key) => key + 1)}>
              {t('刷新')}
            </Button>
            <Button>{t('导出订单')}</Button>
          </Space>
        </div>

        <Table
          loading={loading}
          dataSource={rows}
          rowKey="orderId"
          pagination={{
            currentPage: page,
            pageSize: 10,
            total,
            onChange: (nextPage: number) => setPage(nextPage),
          }}
          columns={[
            {
              title: t('订单号'),
              dataIndex: 'orderSn',
              render: (value: string) => <span className="mono">{value}</span>,
            },
            {
              title: t('收货人'),
              dataIndex: 'consignee',
              render: (value: string, record: OrderRow) => (
                <div>
                  <div>{value || '-'}</div>
                  <Text type="tertiary" size="small">
                    {record.mobile || '-'}
                  </Text>
                </div>
              ),
            },
            {
              title: t('订单金额'),
              dataIndex: 'totalAmount',
              width: 140,
              render: (value: string) => <span className="money">¥ {Number(value || 0).toLocaleString()}</span>,
            },
            {
              title: t('支付状态'),
              dataIndex: 'payStatusName',
              width: 110,
              render: (value: string) => <Tag color={value === '已付款' ? 'green' : 'orange'}>{value ? t(value) : '-'}</Tag>,
            },
            {
              title: t('订单状态'),
              dataIndex: 'orderStatusName',
              width: 110,
              render: (value: string) => <Tag color={(statusColor[value] || 'blue') as any}>{value ? t(value) : '-'}</Tag>,
            },
            { title: t('下单时间'), dataIndex: 'addTime', width: 180 },
            {
              title: t('操作'),
              width: 120,
              render: (_: unknown, record: OrderRow) => (
                <Button
                  theme="borderless"
                  size="small"
                  onClick={() => {
                    setDetailId(record.orderId);
                    setDetailOpen(true);
                  }}
                >
                  {t('查看详情')}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <OrderDetailModal
        visible={detailOpen}
        orderId={detailId}
        onCancel={() => setDetailOpen(false)}
        onChanged={() => setReloadKey((key) => key + 1)}
      />
    </>
  );
}

import { useEffect, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Input,
  Modal,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost, isDemo } from '../api';
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

type OrderFilters = {
  keyword: string;
  outTradeNo: string;
  address: string;
  email: string;
  mobile: string;
  payStatus: number | undefined;
  shippingStatus: number | undefined;
  addTime: string[];
};

const emptyFilters: OrderFilters = {
  keyword: '',
  outTradeNo: '',
  address: '',
  email: '',
  mobile: '',
  payStatus: undefined,
  shippingStatus: undefined,
  addTime: [],
};

export default function Orders({ onNavigate }: { onNavigate?: (page: string) => void } = {}) {
  const { t } = useI18n();
  const [rows, setRows] = useState<OrderRow[]>(isDemo() ? mockOrderPage.records : []);
  const [total, setTotal] = useState(isDemo() ? mockOrderPage.total : 0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [filters, setFilters] = useState<OrderFilters>(emptyFilters);
  const [applied, setApplied] = useState<OrderFilters>(emptyFilters);
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
      orderStatus: status || undefined,
      keyword: applied.keyword || undefined,
      outTradeNo: applied.outTradeNo || undefined,
      address: applied.address || undefined,
      email: applied.email || undefined,
      mobile: applied.mobile || undefined,
      payStatus: applied.payStatus,
      shippingStatus: applied.shippingStatus,
      addStartTime: applied.addTime?.[0] || undefined,
      addEndTime: applied.addTime?.[1] || undefined,
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
  }, [page, status, applied, reloadKey]);

  const search = () => {
    setPage(1);
    setApplied({ ...filters });
  };

  const reset = () => {
    setFilters(emptyFilters);
    setApplied(emptyFilters);
    setPage(1);
  };

  const reload = () => setReloadKey((key) => key + 1);

  const remindDeliver = (row: OrderRow) => {
    Modal.confirm({
      title: t('确认催发货该订单吗？'),
      okText: t('确定'),
      cancelText: t('取消'),
      onOk: async () => {
        try {
          await apiPost(`/order/order/remindDeliver?id=${row.orderId}`);
          Toast.success({ content: t('催发货已通知供应商') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };

  const confirmReceipt = (row: OrderRow) => {
    const finished = row.shippingTypeId === 3;
    Modal.confirm({
      title: finished ? t('确认该订单已完成配送吗？') : t('确认订单已收货吗？'),
      okText: t('确定'),
      cancelText: t('取消'),
      onOk: async () => {
        try {
          await apiPost('/order/order/confirmReceipt', { id: row.orderId });
          Toast.success({ content: t('操作成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
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

        <div className="table-toolbar" style={{ marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
          <Space wrap>
            <Input
              prefix={<IconSearch />}
              placeholder={t('搜索订单号 / 收货人 / 商品名称')}
              value={filters.keyword}
              onChange={(next) => setFilters((current) => ({ ...current, keyword: next }))}
              onEnterPress={search}
              style={{ width: 240 }}
            />
            <Input
              placeholder={t('请输入交易单号')}
              value={filters.outTradeNo}
              onChange={(next) => setFilters((current) => ({ ...current, outTradeNo: next }))}
              style={{ width: 160 }}
            />
            <Input
              placeholder={t('详细地址')}
              value={filters.address}
              onChange={(next) => setFilters((current) => ({ ...current, address: next }))}
              style={{ width: 150 }}
            />
            <Input
              placeholder={t('手机号')}
              value={filters.mobile}
              onChange={(next) => setFilters((current) => ({ ...current, mobile: next }))}
              style={{ width: 140 }}
            />
            <Input
              placeholder="Email"
              value={filters.email}
              onChange={(next) => setFilters((current) => ({ ...current, email: next }))}
              style={{ width: 150 }}
            />
            <Select
              placeholder={t('支付状态')}
              value={filters.payStatus}
              optionList={[
                { label: t('全部'), value: -1 },
                { label: t('未付款'), value: 0 },
                { label: t('已付款'), value: 1 },
              ]}
              onChange={(next) =>
                setFilters((current) => ({
                  ...current,
                  payStatus: Number(next) === -1 ? undefined : Number(next),
                }))
              }
              style={{ width: 130 }}
            />
            <Select
              placeholder={t('发货状态')}
              value={filters.shippingStatus}
              optionList={[
                { label: t('全部'), value: -1 },
                { label: t('未发货'), value: 0 },
                { label: t('部分发货'), value: 1 },
                { label: t('已发货'), value: 2 },
              ]}
              onChange={(next) =>
                setFilters((current) => ({
                  ...current,
                  shippingStatus: Number(next) === -1 ? undefined : Number(next),
                }))
              }
              style={{ width: 130 }}
            />
            <DatePicker
              type="dateRange"
              value={filters.addTime as never}
              onChange={(next) =>
                setFilters((current) => ({ ...current, addTime: (next as string[]) || [] }))
              }
              style={{ width: 250 }}
            />
            <Button theme="solid" type="primary" icon={<IconSearch />} onClick={search}>
              {t('搜索')}
            </Button>
            <Button onClick={reset}>{t('重置')}</Button>
          </Space>
          <Space>
            <Button icon={<IconRefresh />} onClick={reload}>
              {t('刷新')}
            </Button>
            <Button
              onClick={() => {
                if (onNavigate) onNavigate('orderExportManage');
                else window.location.href = `${window.location.origin}/?page=orderExportManage`;
              }}
            >
              {t('导出订单')}
            </Button>
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
              width: 250,
              render: (_: unknown, record: OrderRow) => (
                <Space>
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
                  {record.orderStatus === 1 && (
                    <Button theme="borderless" size="small" onClick={() => remindDeliver(record)}>
                      {t('催发货')}
                    </Button>
                  )}
                  {record.orderStatus === 2 && !record.isPickup && (
                    <Button theme="borderless" size="small" onClick={() => confirmReceipt(record)}>
                      {record.shippingTypeId === 3 ? t('完成配送') : t('确认收货')}
                    </Button>
                  )}
                </Space>
              ),
            },
          ]}
        />
      </Card>

      <OrderDetailModal
        visible={detailOpen}
        orderId={detailId}
        onCancel={() => setDetailOpen(false)}
        onChanged={reload}
      />
    </>
  );
}

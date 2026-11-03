import { useEffect, useState, type ReactNode } from 'react';
import {
  Badge,
  Button,
  Card,
  Checkbox,
  DatePicker,
  Input,
  Modal,
  Radio,
  RadioGroup,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  TextArea,
  Toast,
  Typography,
} from '@douyinfe/semi-ui';
import { IconRefresh, IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost, getToken, apiUpload } from '../api';
import { useI18n } from '../i18n';
import OrderDetailModal from '../components/OrderDetailModal';

const { Text } = Typography;

interface DeliverOrderItem {
  itemId: number;
  productId: number;
  productName: string;
  picThumb?: string;
  price: string | number;
  quantity: number;
  productType?: number;
}

interface DeliverOrderRow {
  orderId: number;
  orderSn: string;
  outTradeNo?: string;
  addTime: string;
  totalAmount: string | number;
  shippingFee?: string | number;
  taxRateAmount?: string | number;
  mark?: number;
  parentOrderId?: number;
  orderSource?: string;
  isExchangeOrder?: number;
  isPickup?: number;
  shippingTypeId?: number;
  payTypeId?: number;
  shippingTypeName?: string;
  logisticsName?: string;
  orderStatus: number;
  orderStatusName?: string;
  afterSalesIng?: number;
  user?: { username?: string };
  consignee?: string;
  mobile?: string;
  userAddress?: string;
  items: DeliverOrderItem[];
  availableActions?: {
    cancelOrder?: number;
    delOrder?: number;
    deliver?: number;
    confirmReceipt?: number;
  };
}

interface LogisticsRow {
  logisticsId: number;
  logisticsName?: string;
  companyName?: string;
}

const TABS = [
  { value: 1, label: '待发货', countField: 'confirmedCount' },
  { value: 2, label: '已发货', countField: 'processingCount' },
  { value: 5, label: '已完成', countField: 'completedCount' },
];

/** 订单全量状态 Tab（积分订单/周期购订单等列表变体使用），计数字段与后端 statusCount 对应。 */
const FULL_TABS = [
  { value: -1, label: '全部', countField: 'allCount' },
  { value: 0, label: '待支付', countField: 'pendingCount' },
  { value: 1, label: '待发货', countField: 'confirmedCount' },
  { value: 2, label: '已发货', countField: 'processingCount' },
  { value: 3, label: '已取消', countField: 'cancelledCount' },
  { value: 4, label: '无效', countField: 'invalidCount' },
  { value: 5, label: '已完成', countField: 'completedCount' },
  { value: -2, label: '已删除', countField: 'deletedCount' },
];

export type DeliverOrdersVariant = 'deliver' | 'exchange' | 'cycle';

const MARK_COLORS: Record<number, 'red' | 'orange' | 'yellow' | 'blue' | 'purple'> = {
  1: 'red',
  2: 'orange',
  3: 'yellow',
  4: 'blue',
  5: 'purple',
};

const money = (value: unknown) => `¥${Number(value || 0).toFixed(2)}`;

const maskName = (value: string) =>
  value ? `${value.slice(0, 1)}*${value.length > 2 ? value.slice(-1) : ''}` : '--';

const maskAddress = (value: string) => (value ? `${value.slice(0, 16)}...` : '--');

function maskMobile(mobile?: string) {
  const text = String(mobile || '');
  return text.length >= 7 ? `${text.slice(0, 3)}****${text.slice(-4)}` : text || '--';
}

/** 发货管理：对应旧版 order/order/Deliverlist.vue，状态 Tab 固定为 待发货/已发货/已完成。
 * variant='exchange' 积分订单（isExchangeOrder=1，全状态 Tab）；variant='cycle' 周期购订单（isCycleOrder=1）。 */
export default function DeliverOrders({
  variant = 'deliver',
}: {
  variant?: DeliverOrdersVariant;
}) {
  const { t } = useI18n();
  const tabs = variant === 'deliver' ? TABS : FULL_TABS;
  const variantQuery =
    variant === 'exchange' ? { isExchangeOrder: 1 } : variant === 'cycle' ? { isCycleOrder: 1 } : {};
  const [activeTab, setActiveTab] = useState(tabs[0].value);
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [rows, setRows] = useState<DeliverOrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [filters, setFilters] = useState<Record<string, any>>({
    keyword: '',
    outTradeNo: '',
    address: '',
    email: '',
    mobile: '',
    mark: -1,
    shippingStatus: '',
    payStatus: '',
    addTime: [] as string[],
  });
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [detailId, setDetailId] = useState<number | undefined>();
  const [detailOpen, setDetailOpen] = useState(false);
  const [markTarget, setMarkTarget] = useState<{ ids: number[] } | null>(null);
  const [markForm, setMarkForm] = useState<{ mark: number; adminNote: string }>({ mark: 0, adminNote: '' });
  const [deliverTarget, setDeliverTarget] = useState<DeliverOrderRow | null>(null);
  const [deliverForm, setDeliverForm] = useState<{
    shippingMethod: number;
    logisticsId: number | undefined;
    trackingNo: string;
    billRemark: string;
  }>({ shippingMethod: 1, logisticsId: undefined, trackingNo: '', billRemark: '' });
  const [logisticsOptions, setLogisticsOptions] = useState<LogisticsRow[]>([]);
  const [batchShipOpen, setBatchShipOpen] = useState(false);
  const [batchShipForm, setBatchShipForm] = useState<{
    logisticsId: number | undefined;
    trackingNo: string;
  }>({ logisticsId: undefined, trackingNo: '' });
  const [excelOpen, setExcelOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const activeFilters = { ...filters };
  if (Number(activeFilters.mark) === -1) delete activeFilters.mark;
  const dateRange = Array.isArray(filters.addTime) ? filters.addTime : [];
  const listQuery = {
    sortField: 'orderId',
    sortOrder: 'desc',
    addStartTime: dateRange[0] || '',
    addEndTime: dateRange[1] || '',
    ...activeFilters,
    addTime: undefined,
  };

  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiGet<{ records: DeliverOrderRow[]; total: number }>('/order/order/list', {
      page,
      size: 10,
      orderStatus: activeTab,
      ...variantQuery,
      ...listQuery,
    })
      .then((result) => {
        if (!alive) return;
        setRows(result.records || []);
        setTotal(result.total || 0);
        setSelectedIds([]);
      })
      .catch((error) => alive && Toast.error({ content: error.message }))
      .finally(() => alive && setLoading(false));
    apiGet<Record<string, number>>('/order/order/statusCount', {
      orderStatus: activeTab,
      ...variantQuery,
      ...listQuery,
    })
      .then((result) => {
        if (!alive) return;
        const next: Record<number, number> = {};
        tabs.forEach((tab) => {
          next[tab.value] = Number(result?.[tab.countField as keyof typeof result]) || 0;
        });
        setCounts(next);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, page, reloadKey]);

  useEffect(() => {
    apiGet<{ records: LogisticsRow[] }>('/setting/logisticsCompany/list', { page: 1, size: 200 })
      .then((result) => setLogisticsOptions(result.records || []))
      .catch(() => undefined);
  }, []);

  const search = () => {
    setPage(1);
    setReloadKey((key) => key + 1);
  };

  const reset = () => {
    setFilters({ keyword: '', outTradeNo: '', address: '', email: '', mobile: '', mark: -1, addTime: [] });
    setPage(1);
    setReloadKey((key) => key + 1);
  };

  const toggleSelect = (orderId: number, checked: boolean) => {
    setSelectedIds((current) =>
      checked ? [...current, orderId] : current.filter((id) => id !== orderId),
    );
  };

  const allSelectable = rows.map((row) => row.orderId);
  const allSelected = allSelectable.length > 0 && allSelectable.every((id) => selectedIds.includes(id));

  const reload = () => setReloadKey((key) => key + 1);

  const submitMark = async () => {
    if (!markTarget) return;
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { ...markForm };
      if (markTarget.ids.length === 1) payload.id = markTarget.ids[0];
      else payload.ids = markTarget.ids.join(',');
      await apiPost('/order/order/setAdminNote', payload);
      Toast.success({ content: t('操作成功') });
      setMarkTarget(null);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
    } finally {
      setSaving(false);
    }
  };

  const openDeliver = async (row: DeliverOrderRow) => {
    setDeliverTarget(row);
    setDeliverForm({ shippingMethod: 1, logisticsId: undefined, trackingNo: '', billRemark: '' });
  };

  const submitDeliver = async () => {
    if (!deliverTarget) return;
    setSaving(true);
    try {
      await apiPost('/order/order/deliver', {
        id: deliverTarget.orderId,
        deliverData: (deliverTarget.items || []).map((item) => ({
          itemId: item.itemId,
          toDeliveryQuantity: item.quantity,
        })),
        shippingMethod: deliverForm.shippingMethod,
        logisticsId: deliverForm.logisticsId || 0,
        trackingNo: deliverForm.trackingNo,
        billRemark: deliverForm.billRemark,
      });
      Toast.success({ content: t('发货成功') });
      setDeliverTarget(null);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('发货失败') });
    } finally {
      setSaving(false);
    }
  };

  const submitBatchShip = async () => {
    setSaving(true);
    try {
      for (const row of rows.filter((item) => selectedIds.includes(item.orderId))) {
        await apiPost('/order/order/deliver', {
          id: row.orderId,
          deliverData: (row.items || []).map((item) => ({
            itemId: item.itemId,
            toDeliveryQuantity: item.quantity,
          })),
          shippingMethod: 1,
          logisticsId: batchShipForm.logisticsId || 0,
          trackingNo: batchShipForm.trackingNo,
        });
      }
      Toast.success({ content: t('批量发货成功') });
      setBatchShipOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('批量发货失败') });
    } finally {
      setSaving(false);
    }
  };

  const importExcel = async (file: File | undefined) => {
    if (!file) return;
    try {
      const result = await apiUpload<{ failCount?: number }>('/order/order/batchDeliverImport', file);
      Toast.success({
        content: result?.failCount ? t('导入完成，失败 {count} 条', { count: result.failCount }) : t('导入成功'),
      });
      setExcelOpen(false);
      reload();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('导入失败') });
    }
  };

  const downloadTemplate = async () => {
    try {
      const res = await fetch('/adminapi/order/order/downloadDeliverTemplate', {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = '批量发货模板.xlsx';
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      Toast.error({ content: t('模板下载失败') });
    }
  };

  const operate = async (
    row: DeliverOrderRow,
    action: 'cancelOrder' | 'delOrder' | 'confirmReceipt',
    title: string,
    content?: ReactNode,
  ) => {
    Modal.confirm({
      title,
      content,
      onOk: async () => {
        try {
          await apiPost(`/order/order/${action}`, { id: row.orderId });
          Toast.success({ content: t('操作成功') });
          reload();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };

  const renderOrderCard = (row: DeliverOrderRow): ReactNode => {
    const canShip =
      !row.isPickup && row.availableActions?.deliver && row.shippingTypeId !== 3;
    const consigneeBlock = row.isPickup ? (
      <div className="order-card-muted">{t('自提订单')}</div>
    ) : (
      <>
        <div className="order-card-muted">
          {t('收货人：')}<span className="order-card-strong">{maskName(String(row.consignee || ''))}</span>
        </div>
        <div className="order-card-muted">
          {t('手机号：')}<span className="order-card-strong">{maskMobile(row.mobile)}</span>
        </div>
        <div className="order-card-muted">
          {t('收货地址：')}<span className="order-card-strong">{maskAddress(String(row.userAddress || ''))}</span>
        </div>
      </>
    );
    return (
      <Card className="deliver-order-card" key={row.orderId} shadows="hover">
        <div className="deliver-order-head">
          <Checkbox
            checked={selectedIds.includes(row.orderId)}
            onChange={(event) => toggleSelect(row.orderId, Boolean(event.target.checked))}
          />
          {row.mark ? (
            <Tag color={MARK_COLORS[row.mark] || 'blue'}>{t('标记{mark}', { mark: row.mark })}</Tag>
          ) : null}
          <span className="deliver-order-sn">{t('订单编号：')}{row.orderSn}</span>
          {row.outTradeNo ? (
            <>
              <span className="deliver-order-divider" />
              <span className="deliver-order-sn">{t('交易单号：')}{row.outTradeNo}</span>
            </>
          ) : null}
          <span className="deliver-order-divider" />
          <span className="deliver-order-sn">{t('下单时间：')}{row.addTime}</span>
          {row.isExchangeOrder ? <Tag color="red">{t('积分兑换')}</Tag> : null}
          {row.orderSource ? <Tag color="cyan">{row.orderSource}</Tag> : null}
          <div className="deliver-order-head-actions">
            <Button
              theme="borderless"
              size="small"
              onClick={() => {
                setDetailId(row.orderId);
                setDetailOpen(true);
              }}
            >
              {t('查看详情')}
            </Button>
            <Button
              theme="borderless"
              size="small"
              onClick={() => {
                setMarkForm({ mark: row.mark || 0, adminNote: '' });
                setMarkTarget({ ids: [row.orderId] });
              }}
            >
              {t('标记')}
            </Button>
          </div>
        </div>
        <div className="deliver-order-body">
          <Table
            size="small"
            pagination={false}
            rowKey="itemId"
            dataSource={row.items || []}
            columns={[
              {
                title: t('商品信息'),
                dataIndex: 'productName',
                render: (_: unknown, item: DeliverOrderItem) => (
                  <div className="deliver-order-product">
                    {item.picThumb ? (
                      <img src={item.picThumb} alt="" width={36} height={36} />
                    ) : null}
                    <span>{item.productName}</span>
                  </div>
                ),
              },
              {
                title: t('单价/数量'),
                dataIndex: 'price',
                width: 140,
                render: (_: unknown, item: DeliverOrderItem) => (
                  <div className="deliver-order-right">
                    <div>{money(item.price)}</div>
                    <Text type="tertiary" size="small">
                      × {item.quantity}
                    </Text>
                  </div>
                ),
              },
            ]}
          />
          <div className="deliver-order-info">
            <div className="deliver-order-cell">
              <div className="deliver-order-right">
                <div className="order-card-strong">{money(row.totalAmount)}</div>
                <Text type="tertiary" size="small">
                  {t('含运费：')}{money(row.shippingFee)}
                </Text>
                <Text type="tertiary" size="small">
                  {t('税费：')}{money(row.taxRateAmount)}
                </Text>
              </div>
            </div>
            <div className="deliver-order-cell">
              <div className="order-card-strong">{row.user?.username || '--'}</div>
            </div>
            <div className="deliver-order-cell">{consigneeBlock}</div>
            <div className="deliver-order-cell">
              <div>{row.payTypeId === 1 ? t('在线支付') : row.payTypeId === 2 ? t('货到付款') : t('线下支付')}</div>
              {row.logisticsName ? (
                <Text type="tertiary" size="small">
                  {row.shippingTypeName || ''} {row.logisticsName}
                </Text>
              ) : null}
            </div>
            <div className="deliver-order-cell">
              <span>{row.orderStatusName || '-'}</span>
              {row.afterSalesIng ? <Tag color="orange">{t('售后中')}</Tag> : null}
            </div>
            <div className="deliver-order-cell deliver-order-actions">
              {row.availableActions?.cancelOrder ? (
                <Button
                  theme="borderless"
                  size="small"
                  onClick={() =>
                    operate(row, 'cancelOrder', t('取消订单'), t('取消后订单将不可恢复，确认取消该订单？'))
                  }
                >
                  {t('取消订单')}
                </Button>
              ) : null}
              {row.availableActions?.delOrder ? (
                <Button
                  theme="borderless"
                  size="small"
                  onClick={() =>
                    operate(row, 'delOrder', t('确认删除订单吗？'), t('被删除的订单可以通过筛选查找并恢复'))
                  }
                >
                  {t('删除订单')}
                </Button>
              ) : null}
              {canShip ? (
                <Button type="danger" theme="borderless" size="small" onClick={() => openDeliver(row)}>
                  {t('去发货')}
                </Button>
              ) : null}
              {!row.isPickup && row.availableActions?.confirmReceipt ? (
                <Button
                  theme="borderless"
                  size="small"
                  onClick={() => operate(row, 'confirmReceipt', t('确认订单已收货吗？'))}
                >
                  {t('确认收货')}
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    );
  };

  return (
    <div className="deliver-orders">
      <Card shadows="hover">
        <Space wrap>
          <Input
            prefix={<IconSearch />}
            placeholder={t('订单号/收货人姓名/商品名称')}
            value={filters.keyword}
            onChange={(next) => setFilters((c) => ({ ...c, keyword: next }))}
            onEnterPress={search}
            style={{ width: 240 }}
          />
          <Input
            placeholder={t('请输入交易单号')}
            value={filters.outTradeNo}
            onChange={(next) => setFilters((c) => ({ ...c, outTradeNo: next }))}
            style={{ width: 180 }}
          />
          <Input
            placeholder={t('详细地址')}
            value={filters.address}
            onChange={(next) => setFilters((c) => ({ ...c, address: next }))}
            style={{ width: 160 }}
          />
          <Input
            placeholder="Email"
            value={filters.email}
            onChange={(next) => setFilters((c) => ({ ...c, email: next }))}
            style={{ width: 160 }}
          />
          <Input
            placeholder={t('手机号')}
            value={filters.mobile}
            onChange={(next) => setFilters((c) => ({ ...c, mobile: next }))}
            style={{ width: 150 }}
          />
          <Select
            value={filters.mark}
            optionList={[
              { label: t('全部标记'), value: -1 },
              { label: t('标记1'), value: 1 },
              { label: t('标记2'), value: 2 },
              { label: t('标记3'), value: 3 },
              { label: t('标记4'), value: 4 },
              { label: t('标记5'), value: 5 },
            ]}
            onChange={(next) => setFilters((c) => ({ ...c, mark: next }))}
            style={{ width: 130 }}
          />
          <DatePicker
            type="dateRange"
            value={dateRange as never}
            onChange={(next) => setFilters((c) => ({ ...c, addTime: (next as string[]) || [] }))}
            style={{ width: 260 }}
          />
          <Button theme="solid" type="primary" icon={<IconSearch />} onClick={search}>
            {t('搜索')}
          </Button>
          <Button onClick={reset}>{t('重置')}</Button>
          <Button icon={<IconRefresh />} onClick={reload}>
            {t('刷新')}
          </Button>
        </Space>

        <div className="deliver-orders-toolbar">
          <Tabs
            type="button"
            activeKey={String(activeTab)}
            onChange={(key: string) => {
              setActiveTab(Number(key));
              setPage(1);
            }}
            tabList={tabs.map((tab) => ({
              tab: (
                <Badge count={counts[tab.value]} type="danger" overflowCount={999}>
                  {t(tab.label)}
                </Badge>
              ),
              itemKey: String(tab.value),
            }))}
          />
          <Space>
            <Button disabled={!selectedIds.length} onClick={() => {
              setMarkForm({ mark: 0, adminNote: '' });
              setMarkTarget({ ids: selectedIds });
            }}>
              {t('批量标记')}
            </Button>
            <Button disabled={!selectedIds.length || activeTab !== 1} onClick={() => setBatchShipOpen(true)}>
              {t('批量发货')}
            </Button>
            <Button disabled={!selectedIds.length || activeTab !== 1} onClick={() => setExcelOpen(true)}>
              {t('Excel批量发货')}
            </Button>
            <Button disabled={!selectedIds.length} onClick={() => setExcelOpen(false)}>
              {t('批量打印')}
            </Button>
            {selectedIds.length > 0 && (
              <span>
                {t('已选择：')}<b>{selectedIds.length}</b> {t('项')}
              </span>
            )}
          </Space>
        </div>

        <Spin spinning={loading}>
          {rows.map((row) => renderOrderCard(row))}
          {rows.length === 0 && !loading ? <div className="deliver-orders-empty">{t('暂无数据')}</div> : null}
        </Spin>

        <div className="deliver-orders-pagination">
          <Space>
            <Button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              {t('上一页')}
            </Button>
            <span>
              {t('第 {page} / {pages} 页，共 {total} 条', { page, pages: Math.max(1, Math.ceil(total / 10)), total })}
            </span>
            <Button disabled={page >= Math.ceil(total / 10)} onClick={() => setPage((p) => p + 1)}>
              {t('下一页')}
            </Button>
          </Space>
        </div>
      </Card>

      <OrderDetailModal
        visible={detailOpen}
        orderId={detailId}
        onCancel={() => setDetailOpen(false)}
        onChanged={reload}
      />

      <Modal
        title={t('添加标记')}
        visible={Boolean(markTarget)}
        confirmLoading={saving}
        onOk={submitMark}
        onCancel={() => setMarkTarget(null)}
      >
        <div className="deliver-order-form">
          <label>{t('标记')}</label>
          <RadioGroup
            value={markForm.mark}
            onChange={(event) => setMarkForm((c) => ({ ...c, mark: Number(event.target.value) }))}
          >
            <Radio value={0}>{t('无标记')}</Radio>
            {[1, 2, 3, 4, 5].map((value) => (
              <Radio key={value} value={value}>
                {t('标记{mark}', { mark: value })}
              </Radio>
            ))}
          </RadioGroup>
          <label>{t('备注')}</label>
          <TextArea
            value={markForm.adminNote}
            onChange={(next) => setMarkForm((c) => ({ ...c, adminNote: next }))}
            placeholder={t('商家备注')}
          />
        </div>
      </Modal>

      <Modal
        title={deliverTarget ? `${t('订单发货')} ${deliverTarget.orderSn}` : t('订单发货')}
        visible={Boolean(deliverTarget)}
        confirmLoading={saving}
        onOk={submitDeliver}
        onCancel={() => setDeliverTarget(null)}
        width={620}
      >
        <div className="deliver-order-form">
          <label>{t('配送方式')}</label>
          <RadioGroup
            value={deliverForm.shippingMethod}
            onChange={(event) =>
              setDeliverForm((c) => ({ ...c, shippingMethod: Number(event.target.value) }))
            }
          >
            <Radio value={1}>{t('快递物流')}</Radio>
            <Radio value={3}>{t('无需物流')}</Radio>
          </RadioGroup>
          <label>{t('物流公司')}</label>
          <Select
            style={{ width: 300 }}
            disabled={deliverForm.shippingMethod === 3}
            value={deliverForm.logisticsId}
            optionList={logisticsOptions.map((item) => ({
              label: item.logisticsName || item.companyName || String(item.logisticsId),
              value: item.logisticsId,
            }))}
            onChange={(next) => setDeliverForm((c) => ({ ...c, logisticsId: Number(next) }))}
            placeholder={t('请选择物流公司')}
          />
          <label>{t('运单号')}</label>
          <Input
            value={deliverForm.trackingNo}
            onChange={(next) => setDeliverForm((c) => ({ ...c, trackingNo: next }))}
            placeholder={t('请输入运单号')}
          />
          <label>{t('发货备注')}</label>
          <TextArea
            value={deliverForm.billRemark}
            onChange={(next) => setDeliverForm((c) => ({ ...c, billRemark: next }))}
          />
        </div>
      </Modal>

      <Modal
        title={t('订单批量发货')}
        visible={batchShipOpen}
        confirmLoading={saving}
        onOk={submitBatchShip}
        onCancel={() => setBatchShipOpen(false)}
      >
        <div className="deliver-order-form">
          <p className="deliver-order-muted">{t('所选 {count} 个订单将统一使用以下物流信息发货。', { count: selectedIds.length })}</p>
          <label>{t('物流公司')}</label>
          <Select
            style={{ width: 300 }}
            value={batchShipForm.logisticsId}
            optionList={logisticsOptions.map((item) => ({
              label: item.logisticsName || item.companyName || String(item.logisticsId),
              value: item.logisticsId,
            }))}
            onChange={(next) => setBatchShipForm((c) => ({ ...c, logisticsId: Number(next) }))}
            placeholder={t('请选择物流公司')}
          />
          <label>{t('运单号')}</label>
          <Input
            value={batchShipForm.trackingNo}
            onChange={(next) => setBatchShipForm((c) => ({ ...c, trackingNo: next }))}
            placeholder={t('请输入运单号')}
          />
        </div>
      </Modal>

      <Modal title={t('Excel批量发货')} visible={excelOpen} onCancel={() => setExcelOpen(false)} footer={null}>
        <div className="deliver-order-form">
          <Space>
            <label className="semi-upload-file" style={{ cursor: 'pointer' }}>
              <input
                type="file"
                accept=".xlsx,.xls"
                style={{ display: 'none' }}
                onChange={(event) => {
                  importExcel(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
              <Button theme="solid" type="primary">
                {t('选择 Excel 文件')}
              </Button>
            </label>
            <Button onClick={downloadTemplate}>{t('下载导入模板')}</Button>
          </Space>
          <p className="deliver-order-muted">{t('按模板填写订单号与物流信息后导入，导入结果以提示为准。')}</p>
        </div>
      </Modal>
    </div>
  );
}

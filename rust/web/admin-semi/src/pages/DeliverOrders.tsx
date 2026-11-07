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
  /** 逐单编辑的物流信息（orderId → {logisticsId, trackingNo}），对齐旧版 BatchShip 逐单编辑。 */
  const [batchPerOrder, setBatchPerOrder] = useState<Record<number, { logisticsId?: number; trackingNo: string }>>({});
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
        const perOrder = batchPerOrder[row.orderId] || {};
        await apiPost('/order/order/deliver', {
          id: row.orderId,
          deliverData: (row.items || []).map((item) => ({
            itemId: item.itemId,
            toDeliveryQuantity: item.quantity,
          })),
          shippingMethod: 1,
          logisticsId: perOrder.logisticsId || batchShipForm.logisticsId || 0,
          trackingNo: perOrder.trackingNo || batchShipForm.trackingNo,
        });
      }
      Toast.success({ content: t('批量发货成功') });
      setBatchShipOpen(false);
      setBatchPerOrder({});
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

  /**
   * 批量打印配送单。旧版跳转 `/print/orderPrint?ids=`，该打印设计器尚未迁移；
   * 这里用浏览器原生打印输出所选订单的配送单，保留可用能力，不再是一个点了没反应的空按钮。
   */
  const printSelected = () => {
    const selected = rows.filter((row) => selectedIds.includes(row.orderId));
    if (!selected.length) {
      Toast.warning({ content: t('请先选择要打印的订单') });
      return;
    }
    const win = window.open('', '_blank', 'width=1024,height=768');
    if (!win) {
      Toast.error({ content: t('浏览器拦截了打印窗口，请允许弹出窗口后重试') });
      return;
    }
    const esc = (value: unknown) =>
      String(value ?? '').replace(
        /[&<>"']/g,
        (char) =>
          ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] || char,
      );
    const money = (value: unknown) => `¥${Number(value || 0).toFixed(2)}`;
    const tickets = selected
      .map((row) => {
        const goods = (row.items || [])
          .map(
            (item) =>
              `<tr><td>${esc(item.productName)}</td><td>${esc(item.price)}</td><td>${esc(
                item.quantity,
              )}</td><td>${money(Number(item.price || 0) * Number(item.quantity || 0))}</td></tr>`,
          )
          .join('');
        return `<section class="ticket">
          <h2>${esc(t('配送单'))}</h2>
          <table class="meta">
            <tr><th>${esc(t('订单号'))}</th><td>${esc(row.orderSn)}</td><th>${esc(t('下单时间'))}</th><td>${esc(row.addTime)}</td></tr>
            <tr><th>${esc(t('交易单号'))}</th><td>${esc(row.outTradeNo || '-')}</td><th>${esc(t('订单状态'))}</th><td>${esc(row.orderStatusName || '-')}</td></tr>
            <tr><th>${esc(t('收货人'))}</th><td>${esc(row.consignee || '-')}</td><th>${esc(t('手机号'))}</th><td>${esc(row.mobile || '-')}</td></tr>
            <tr><th>${esc(t('收货地址'))}</th><td colspan="3">${esc(row.userAddress || '-')}</td></tr>
            <tr><th>${esc(t('配送方式'))}</th><td>${esc(row.shippingTypeName || row.logisticsName || '-')}</td><th>${esc(t('订单金额'))}</th><td>${money(row.totalAmount)}</td></tr>
          </table>
          <h3>${esc(t('商品明细'))}</h3>
          <table class="goods"><thead><tr><th>${esc(t('商品名称'))}</th><th>${esc(t('单价'))}</th><th>${esc(t('数量'))}</th><th>${esc(t('小计'))}</th></tr></thead><tbody>${
            goods || `<tr><td colspan="4">${esc(t('暂无商品明细'))}</td></tr>`
          }</tbody></table>
        </section>`;
      })
      .join('<div class="pagebreak"></div>');
    win.document.write(`<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><title>${esc(
      t('批量打印配送单'),
    )}</title><style>
      *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Microsoft YaHei",sans-serif;color:#111;margin:24px}
      .ticket{max-width:820px;margin:0 auto 24px}h2{text-align:center;margin:0 0 16px;font-size:20px}h3{font-size:14px;margin:16px 0 8px}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #999;padding:6px 8px;text-align:left}
      .meta th{width:110px;background:#f5f5f5;white-space:nowrap}.goods th{background:#f5f5f5}
      .pagebreak{page-break-after:always;break-after:page}
      @media print{body{margin:0}.ticket{margin:0 auto}.pagebreak{page-break-after:always}}
    </style></head><body>${tickets}</body></html>`);
    win.document.close();
    window.setTimeout(() => win.print(), 400);
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
            <Button disabled={!selectedIds.length} onClick={printSelected}>
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
        width={680}
      >
        <div className="deliver-order-form">
          <p className="deliver-order-muted">{t('支持逐单编辑物流信息，也可先设置统一物流信息后一键应用到全部。', { count: selectedIds.length })}</p>
          <label>{t('统一物流公司')}</label>
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
          <label>{t('统一运单号')}</label>
          <Input
            value={batchShipForm.trackingNo}
            onChange={(next) => setBatchShipForm((c) => ({ ...c, trackingNo: next }))}
            placeholder={t('请输入运单号')}
          />
          <Button
            style={{ marginTop: 8 }}
            onClick={() => {
              setBatchPerOrder(() => {
                const next: Record<number, { logisticsId?: number; trackingNo: string }> = {};
                rows
                  .filter((item) => selectedIds.includes(item.orderId))
                  .forEach((item) => {
                    next[item.orderId] = { logisticsId: batchShipForm.logisticsId, trackingNo: batchShipForm.trackingNo };
                  });
                return next;
              });
              Toast.success({ content: t('已应用到全部所选订单') });
            }}
          >
            {t('应用到全部')}
          </Button>

          <div style={{ marginTop: 12 }}>
            {rows
              .filter((item) => selectedIds.includes(item.orderId))
              .map((row) => {
                const perOrder = batchPerOrder[row.orderId] || { logisticsId: batchShipForm.logisticsId, trackingNo: batchShipForm.trackingNo };
                return (
                  <div key={row.orderId} style={{ borderTop: '1px solid var(--semi-color-border)', padding: '10px 0' }}>
                    <div style={{ fontWeight: 500, marginBottom: 6 }}>
                      <span className="mono">{row.orderSn}</span>
                    </div>
                    <Space wrap>
                      <Select
                        style={{ width: 240 }}
                        value={perOrder.logisticsId}
                        optionList={logisticsOptions.map((item) => ({
                          label: item.logisticsName || item.companyName || String(item.logisticsId),
                          value: item.logisticsId,
                        }))}
                        onChange={(next) =>
                          setBatchPerOrder((current) => ({
                            ...current,
                            [row.orderId]: { ...perOrder, logisticsId: Number(next) },
                          }))
                        }
                        placeholder={t('请选择物流公司')}
                      />
                      <Input
                        style={{ width: 240 }}
                        value={perOrder.trackingNo}
                        onChange={(next) =>
                          setBatchPerOrder((current) => ({
                            ...current,
                            [row.orderId]: { ...perOrder, trackingNo: next },
                          }))
                        }
                        placeholder={t('请输入运单号')}
                      />
                    </Space>
                  </div>
                );
              })}
          </div>
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

'use client';

/**
 * 订单详情（PC 会员中心）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/order/Info.vue
 * 以及 src/{OrderInfoHeader,OrderStatusSteps,OrderDeliveryInfo,OrderProductTable}.vue
 *
 * 后端 `GET /api/user/order/detail` 返回「订单字段平铺 + items」（见
 * rust/crates/api/public/src/lib.rs::order_detail），不是 { item } 包裹结构。
 *
 * 覆盖：
 * - 状态头（状态名/状态提示/订单号/下单时间/支付截止）+ 订单状态步骤（下单→付款→发货→收货→完成）
 * - 操作：去支付、取消订单（原因配置）、确认收货、申请售后、删除订单、再次购买、评价、查看物流
 * - 收货信息、商品清单（货号/规格/数量/单价）、金额明细（商品/运费/优惠券/积分/优惠/余额/服务费/应付）
 * - 买家留言、发票信息、订单留言/咨询入口
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

interface OrderItem {
  itemId?: number;
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  picUrl?: string;
  productPicThumb?: string;
  skuValue?: string;
  skuData?: string;
  price?: number | string;
  quantity?: number;
  productType?: number;
}

interface OrderDetail {
  orderId?: number;
  orderSn?: string;
  orderStatus?: number;
  orderStatusName?: string;
  orderStatusTip?: string;
  payStatusName?: string;
  shippingStatusName?: string;
  addTime?: string;
  payTime?: string;
  payEndTime?: string;
  shippingTime?: string;
  receivedTime?: string;
  consignee?: string;
  mobile?: string;
  userAddress?: string;
  address?: string;
  shippingTypeName?: string;
  trackingNo?: string;
  logisticsName?: string;
  buyerNote?: string;
  items?: OrderItem[];
  productAmount?: number;
  shippingFee?: number;
  couponAmount?: number;
  pointsAmount?: number;
  discountAmount?: number;
  balance?: number;
  serviceFee?: number;
  totalAmount?: number;
  paidAmount?: number;
  unpaidAmount?: number;
  onlinePaidAmount?: number;
  offlinePaidAmount?: number;
  creditAmount?: number;
  invoiceData?: Record<string, any>;
  shop?: Record<string, any>;
  availableActions?: Record<string, boolean>;
}

interface ReasonConfig {
  afterSalesReasonEnabled?: number;
  cancelOrderReasonList?: string[];
}

interface ShippingResult {
  logisticCode?: string;
  state?: string;
  stateEx?: string;
  traces?: Array<{ acceptTime?: string; acceptStation?: string; action?: string; location?: string }>;
}

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function actionEnabled(actions: Record<string, boolean> | undefined, ...keys: string[]): boolean {
  if (!actions) return false;
  return keys.some((key) => Boolean(actions[key]));
}

const STEPS = ['下单', '付款', '发货', '收货', '完成'];

export default function OrderDetailClient({ orderId }: { orderId: number }) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [reasonConfig, setReasonConfig] = useState<ReasonConfig | null>(null);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [shippingVisible, setShippingVisible] = useState(false);
  const [shipping, setShipping] = useState<ShippingResult | null>(null);

  const load = () => {
    if (!orderId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiGet<OrderDetail | { item?: OrderDetail }>('user/order/detail', { id: orderId })
      .then((result) => {
        const raw = (result || {}) as OrderDetail & { item?: OrderDetail };
        setDetail(raw.item ? raw.item : raw);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
        setDetail(null);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    apiGet<ReasonConfig>('user/order/reasonConfig')
      .then((config) => setReasonConfig(config || null))
      .catch(() => setReasonConfig(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const confirm = () => {
    Modal.confirm({
      title: '确认要收货吗',
      cancelText: '取消',
      okText: '确定',
      onOk: async () => {
        try {
          await apiPost('user/order/confirmReceipt', { id: orderId });
          Toast.success({ content: '已确认收货' });
          load();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '操作失败' });
        }
      },
    });
  };

  const openCancel = () => {
    setCancelReason('');
    setCancelVisible(true);
  };

  const submitCancel = async () => {
    const reasons = reasonConfig?.cancelOrderReasonList || [];
    if (Number(reasonConfig?.afterSalesReasonEnabled ?? 0) === 1 && reasons.length && !cancelReason) {
      Toast.error({ content: '请选择取消原因' });
      return;
    }
    try {
      await apiPost('user/order/cancelOrder', { id: orderId, description: cancelReason || '用户主动取消' });
      Toast.success({ content: '订单已取消' });
      setCancelVisible(false);
      load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '取消失败' });
    }
  };

  const deleteOrder = () => {
    Modal.confirm({
      title: '删除订单',
      content: '删除后订单记录将不可恢复，确认删除？',
      onOk: async () => {
        try {
          await apiPost('user/order/delOrder', { id: orderId });
          Toast.success({ content: '订单已删除' });
          window.location.replace('/member/order/list');
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
        }
      },
    });
  };

  const buyAgain = async () => {
    try {
      await apiPost('user/order/buyAgain', { id: orderId });
      Toast.success({ content: '已加入购物车' });
      window.location.href = '/cart';
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '操作失败' });
    }
  };

  const openShipping = async () => {
    try {
      const result = await apiGet<ShippingResult>('user/order/shippingInfo', { id: orderId });
      setShipping(result || null);
      setShippingVisible(true);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '物流信息加载失败' });
    }
  };

  if (loading) return <Card className="cart-state">订单详情加载中...</Card>;
  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>登录后查看订单</h2>
        <Link href={`/login?redirect=/member/order/detail?id=${orderId}`}>
          <Button theme="solid" type="primary" size="large">去登录</Button>
        </Link>
      </Card>
    );
  }
  if (!detail) return <Card className="cart-state">订单不存在</Card>;

  const actions = detail.availableActions;
  const items = detail.items || [];
  const orderStatus = Number(detail.orderStatus ?? -1);
  const activeStep = orderStatus <= 0 ? 1 : orderStatus === 1 ? 2 : orderStatus === 2 ? 3 : orderStatus >= 5 ? 5 : orderStatus === 3 ? 0 : 0;

  return (
    <div className="member-order-detail">
      <Card className="member-card">
        <div className="member-order-detail__head">
          <div>
            <span className="member-order__status">{detail.orderStatusName || '订单'}</span>
            <h2>订单号：{detail.orderSn}</h2>
            <p>下单时间：{detail.addTime || '-'}</p>
            {detail.orderStatusTip ? <p className="member-order-detail__tip">{detail.orderStatusTip}</p> : null}
            {detail.payEndTime && actionEnabled(actions, 'toPay') ? <p>支付截止：{detail.payEndTime}</p> : null}
            {detail.payTime ? <p>支付时间：{detail.payTime}</p> : null}
            {detail.shippingTime ? <p>发货时间：{detail.shippingTime}</p> : null}
          </div>
          <div className="member-order-detail__actions">
            {actionEnabled(actions, 'toPay') ? (
              <Link href={`/order/pay?id=${detail.orderId || orderId}`}><Button theme="solid" type="primary">去支付</Button></Link>
            ) : null}
            {actionEnabled(actions, 'confirmReceipt') ? <Button onClick={confirm}>确认收货</Button> : null}
            {actionEnabled(actions, 'toAftersales', 'toAfterSales') ? (
              <Link href={`/member/aftersales/apply?orderId=${detail.orderId || orderId}`}><Button>申请售后</Button></Link>
            ) : null}
            {actionEnabled(actions, 'toComment') ? (
              <Link href={`/member/comment/info?orderId=${detail.orderId || orderId}`}><Button>评价</Button></Link>
            ) : null}
            {actionEnabled(actions, 'cancelOrder') ? <Button type="danger" onClick={openCancel}>取消订单</Button> : null}
            {actionEnabled(actions, 'delOrder') ? <Button onClick={deleteOrder}>删除订单</Button> : null}
            {actionEnabled(actions, 'rebuy') ? <Button onClick={buyAgain}>再次购买</Button> : null}
            {detail.trackingNo || detail.logisticsName ? <Button onClick={openShipping}>查看物流</Button> : null}
          </div>
        </div>

        {/* 订单状态步骤（旧版 OrderStatusSteps） */}
        <div className="member-order-steps">
          {STEPS.map((step, index) => (
            <div key={step} className={`member-order-steps__item${index < activeStep ? ' is-active' : ''}`}>
              <span className="member-order-steps__dot">{index + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="member-card" title="收货信息">
        <div className="member-order-detail__address">
          <b>{detail.consignee} {detail.mobile}</b>
          <span>{detail.userAddress || detail.address || '-'}</span>
          <span>配送方式：{detail.shippingTypeName || '-'}</span>
          {detail.trackingNo ? <span>物流：{detail.logisticsName || '-'} {detail.trackingNo}</span> : null}
        </div>
      </Card>

      <Card className="member-card" title="商品清单">
        {items.map((item, index) => (
          <div key={item.itemId || index} className="member-order__item">
            <img src={item.picThumb || item.productPicThumb || item.picUrl || ''} alt={item.productName || ''} />
            <div>
              <Link href={item.productId ? `/product/${item.productId}` : '/search'}>{item.productName}</Link>
              {item.productSn ? <span className="member-order__sn">货号：{item.productSn}</span> : null}
              {item.skuValue || item.skuData ? <span>{item.skuValue || item.skuData}</span> : null}
            </div>
            <b>¥ {money(item.price)}</b>
            <span>× {item.quantity}</span>
          </div>
        ))}
      </Card>

      <Card className="member-card" title="金额明细">
        <div className="member-order-detail__amounts">
          <span>商品金额 <b>¥ {money(detail.productAmount)}</b></span>
          <span>运费 <b>¥ {money(detail.shippingFee)}</b></span>
          <span>优惠券 <b>- ¥ {money(detail.couponAmount)}</b></span>
          <span>积分抵扣 <b>- ¥ {money(detail.pointsAmount)}</b></span>
          <span>优惠 <b>- ¥ {money(detail.discountAmount)}</b></span>
          {Number(detail.balance || 0) > 0 ? <span>余额抵扣 <b>- ¥ {money(detail.balance)}</b></span> : null}
          {Number(detail.serviceFee || 0) > 0 ? <span>服务费 <b>¥ {money(detail.serviceFee)}</b></span> : null}
          {Number(detail.creditAmount || 0) > 0 ? <span>账期金额 <b>¥ {money(detail.creditAmount)}</b></span> : null}
          {Number(detail.onlinePaidAmount || 0) > 0 ? <span>线上支付 <b>¥ {money(detail.onlinePaidAmount)}</b></span> : null}
          {Number(detail.offlinePaidAmount || 0) > 0 ? <span>线下支付 <b>¥ {money(detail.offlinePaidAmount)}</b></span> : null}
          <span className="total">应付金额 <b>¥ {money(detail.unpaidAmount || detail.totalAmount)}</b></span>
        </div>
      </Card>

      {detail.buyerNote ? (
        <Card className="member-card" title="买家留言">
          {detail.buyerNote}
        </Card>
      ) : null}

      {detail.invoiceData ? (
        <Card className="member-card" title="发票信息">
          <div className="member-order-detail__address">
            {detail.invoiceData.invoiceTitle || detail.invoiceData.title ? <span>抬头：{detail.invoiceData.invoiceTitle || detail.invoiceData.title}</span> : null}
            {detail.invoiceData.taxNo ? <span>税号：{detail.invoiceData.taxNo}</span> : null}
            {detail.invoiceData.invoiceType ? <span>类型：{detail.invoiceData.invoiceType}</span> : null}
          </div>
        </Card>
      ) : null}

      <div className="member-order-detail__links">
        <Link href={`/member/feedback/askList?orderId=${detail.orderId || orderId}&orderSn=${detail.orderSn || ''}`}>订单留言/咨询</Link>
        <Link href="/member/order/list" className="member-order-detail__back">返回订单列表</Link>
      </div>

      {/* 取消订单原因（旧版 CancelOrderReasonDialog） */}
      <Modal visible={cancelVisible} title="取消订单" onCancel={() => setCancelVisible(false)} onOk={() => void submitCancel()}>
        {Number(reasonConfig?.afterSalesReasonEnabled ?? 0) === 1 && (reasonConfig?.cancelOrderReasonList || []).length ? (
          <select value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} style={{ width: '100%', padding: '8px' }}>
            <option value="">请选择取消原因</option>
            {(reasonConfig?.cancelOrderReasonList || []).map((reason) => <option key={reason} value={reason}>{reason}</option>)}
          </select>
        ) : (
          <p>确认取消该订单？</p>
        )}
      </Modal>

      {/* 物流跟踪 */}
      <Modal visible={shippingVisible} title="物流跟踪" footer={null} onCancel={() => setShippingVisible(false)} width={560}>
        {shipping ? (
          <div>
            <p>物流单号：{shipping.logisticCode || detail.trackingNo || '-'}</p>
            <p>物流状态：{shipping.state || shipping.stateEx || '-'}</p>
            {(shipping.traces || []).length ? (shipping.traces || []).map((trace, index) => (
              <div key={index} className="member-order-shipping__trace">
                <span>{trace.acceptTime || ''}</span>
                <div>{trace.acceptStation || trace.action || trace.location || ''}</div>
              </div>
            )) : <p>暂无物流轨迹</p>}
          </div>
        ) : <p>暂无物流轨迹</p>}
      </Modal>
    </div>
  );
}

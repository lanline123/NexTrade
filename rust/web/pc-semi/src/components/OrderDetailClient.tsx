'use client';

/**
 * 订单详情（PC 会员中心）
 * 源码对照：
 * - view/pc/pages/member/order/Info.vue
 * - src/OrderInfoHeader.vue（状态头/操作/支付倒计时/认款状态）
 * - src/OrderStatusSteps.vue、src/OrderDeliveryInfo.vue（订单信息/自提/虚拟内容/配送员）
 * - src/OrderProductTable.vue（商品明细/小计/运费文案/礼品卡兑换/售后入口）
 * - src/OrderGiftCard.vue、src/OrderEcard.vue
 *
 * 后端 `GET /api/user/order/detail` 返回「订单字段平铺 + items」。
 * 未迁移部分：o2o 门店/预约、预售尾款细节、礼品卡转赠动作（仅展示卡信息+一键复制）。
 */
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Modal, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface OrderItem {
  itemId?: number;
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  picUrl?: string;
  productPicThumb?: string;
  skuValue?: string;
  skuData?: string | Array<{ name?: string; value?: string }>;
  extraSkuData?: Array<{ attrName?: string; attrValue?: string; attrPrice?: number | string }>;
  price?: number | string;
  subtotal?: number | string;
  quantity?: number;
  productType?: number;
  isGift?: number;
  aftersalesNumber?: number;
  aftersalesItem?: { aftersaleId?: number; statusName?: string; status?: number };
  eCard?: Array<{ cardNumber?: string; cardPassword?: string; cardPwd?: string }>;
  virtualSample?: string;
}

interface GiftCardInfo {
  giftCardsId?: number;
  cardNumber?: string;
  cardPassword?: string;
  status?: number;
  statusName?: string;
}

interface OrderDetail {
  orderId?: number;
  orderSn?: string;
  orderStatus?: number;
  orderStatusName?: string;
  orderStatusTip?: string;
  joinStatus?: number;
  joinStatusDesc?: string;
  payStatus?: number;
  payStatusName?: string;
  shippingStatusName?: string;
  addTime?: string;
  payTime?: string;
  payEndTime?: string;
  shippingTime?: string;
  receivedTime?: string;
  cancelRemark?: string;
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
  shopId?: number;
  payTypeId?: number;
  orderType?: number;
  orderSource?: string;
  isPickup?: boolean;
  pickupDetail?: Record<string, any>;
  isReservationHome?: boolean;
  deliveryOrderInfo?: { type?: number; staffName?: string; staffPhone?: string };
  offlinePaymentClaimStatus?: number | null;
  offlinePaymentClaimRejectReason?: string;
  offlinePaymentClaim?: { auditRemark?: string };
  autoDeliveryDays?: number;
  isPresale?: boolean;
  presaleInfo?: { presaleStatus?: number; saleMode?: number; finalPaymentStartTimeText?: string };
  isCycleOrder?: number;
  cycleCardInfo?: { expireTimeStr?: string; statusName?: string };
  giftCardOrder?: { num?: number; giftCardOrderInfo?: GiftCardInfo[] };
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

function copyText(text: string) {
  if (!text) return;
  if (navigator.clipboard?.writeText) {
    void navigator.clipboard
      .writeText(text)
      .then(() => Toast.success({ content: '已复制' }))
      .catch(() => Toast.error({ content: '复制失败' }));
    return;
  }
  Toast.error({ content: '当前浏览器不支持复制' });
}

const STEPS = ['下单', '付款', '发货', '收货', '完成'];

const STATUS_DESC = [
  '您的订单已提交成功，请尽快完成付款哦！',
  '感谢您在本店的购物，您的订单已提交成功，我们会尽快为您发货！',
  '您的订单已经发货，请注意查收，祝您购物愉快！',
  '您的订单已被取消，您可以通过“再次购买”，重新购买订单中的商品。',
  '您的订单被认定为无效订单，订单已被关闭。您可以通过“再次购买”，重新购买订单中的商品。给您造成的不便请多多谅解！',
  '您的订单已经确认收货，感谢您在本店购物，祝您生活愉快！',
];

export default function OrderDetailClient({ orderId }: { orderId: number }) {
    const { t } = useTranslation();
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [reasonConfig, setReasonConfig] = useState<ReasonConfig | null>(null);
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [shippingVisible, setShippingVisible] = useState(false);
  const [shipping, setShipping] = useState<ShippingResult | null>(null);
  const [nowTs, setNowTs] = useState(Date.now());

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
    const timer = setInterval(() => setNowTs(Date.now()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const payCountdown = useMemo(() => {
    const raw = String(detail?.payEndTime || '');
    if (!raw) return '';
    const endMs = Date.parse(raw.replace(/-/g, '/'));
    if (!Number.isFinite(endMs) || endMs <= nowTs) return '';
    const total = Math.floor((endMs - nowTs) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }, [detail?.payEndTime, nowTs]);

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

  const submitCancel = async () => {
    const reasons = reasonConfig?.cancelOrderReasonList || [];
    if (Number(reasonConfig?.afterSalesReasonEnabled ?? 0) === 1 && reasons.length && !cancelReason) {
      Toast.error({ content: '请选择取消原因' });
      return;
    }
    try {
      await apiPost('user/order/cancelOrder', { id: orderId, description: cancelReason || t('用户主动取消') });
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

  if (loading) return <Card className="cart-state">{t('订单详情加载中...')}</Card>;
  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>{t('登录后查看订单')}</h2>
        <Link href={`/login?redirect=/member/order/detail?id=${orderId}`}>
          <Button theme="solid" type="primary" size="large">{t('去登录')}</Button>
        </Link>
      </Card>
    );
  }
  if (!detail) return <Card className="cart-state">{t('订单不存在')}</Card>;

  const actions = detail.availableActions || {};
  const items = detail.items || [];
  const orderStatus = Number(detail.orderStatus ?? -1);
  const payStatus = Number(detail.payStatus ?? 0);
  const activeStep = orderStatus <= 0 ? 1 : orderStatus === 1 ? 2 : orderStatus === 2 ? 3 : orderStatus >= 5 ? 5 : 0;
  const orderType = Number(detail.orderType ?? 0);
  const orderSource = String(detail.orderSource || '');
  const isGiftCardProduct = items.some((item) => item.productType === 7 || item.productType === 8);
  const isGiftCardExchange = orderType === 12;
  const hasItemAftersales = items.some((item) => Boolean(item.aftersalesItem));
  const isPickupCompleted = Boolean(detail.isPickup) && orderStatus === 5;
  const giftCardBlocked = isGiftCardExchange || hasItemAftersales;
  const showItemAftersalesAction =
    actionEnabled(actions, 'toAftersales', 'toAfterSales') &&
    payStatus === 2 &&
    !giftCardBlocked &&
    orderSource !== 'pos' &&
    orderType !== 14 &&
    Number(detail.isCycleOrder ?? 0) !== 1 &&
    !isPickupCompleted &&
    detail.cycleCardInfo?.statusName !== '已过期' &&
    items.some((item) => item.isGift === 0 && Number(item.quantity || 0) > Number(item.aftersalesNumber || 0));

  const giftCardInfo = detail.giftCardOrder?.giftCardOrderInfo || [];
  const ecardItems = items.filter((item) => (item.eCard || []).length > 0);
  const virtualSampleItem = items.find((item) => Number(item.productType) === 2 && Boolean(item.virtualSample));
  const deliveryOrderInfo = detail.deliveryOrderInfo;
  const showDeliveryStaff = Number(deliveryOrderInfo?.type) === 1 && Boolean(deliveryOrderInfo?.staffName || deliveryOrderInfo?.staffPhone);
  const isOfflineOrder = Number(detail.payTypeId) === 3;
  const offlineClaimStatus = detail.offlinePaymentClaimStatus == null ? null : Number(detail.offlinePaymentClaimStatus);
  const offlineClaimRejected = isOfflineOrder && offlineClaimStatus === 2 && orderStatus !== 3;
  const offlineClaimAuditRemark = String(detail.offlinePaymentClaim?.auditRemark || '').trim();
  const showPayCountdown = actionEnabled(actions, 'toPay') && Boolean(payCountdown);

  // 运费/服务费文案（OrderProductTable shippingFeeLabel/FreeText 规则）
  const shippingTypeName = String(detail.shippingTypeName || '');
  const isPickupOrder = shippingTypeName.includes('自提') || (Boolean(detail.isPickup) && !detail.isReservationHome && Boolean(detail.pickupDetail));
  const isReserveOrder = orderType === 10;
  const isLocalDeliveryOrder = Number(deliveryOrderInfo?.type) === 1 || shippingTypeName.includes('同城');
  const noDeliveryTypes = new Set([2, 3, 4, 9, 8]);
  const isNoDelivery = items.some((item) => noDeliveryTypes.has(Number(item.productType))) || shippingTypeName.includes('无需配送');
  const showShippingFee = !isPickupOrder && (isReserveOrder || isLocalDeliveryOrder || !isNoDelivery);
  const shippingFeeLabel = isReserveOrder ? t('上门服务费') : isLocalDeliveryOrder ? t('配送费') : '快递';
  const shippingFeeFreeText = isReserveOrder ? t('免费上门') : isLocalDeliveryOrder ? t('免配送费') : '包邮';

  const payText =
    isGiftCardExchange ? t('礼品卡兑换') : Number(detail.payTypeId) === 1 ? t('在线支付') : Number(detail.payTypeId) === 2 ? t('货到付款') : '线下支付';

  return (
    <div className="member-order-detail">
      {/* 订单头部（OrderInfoHeader.vue） */}
      <Card className="member-card">
        <div className="member-order-detail__head">
          <div>
            <span className="member-order__status">{detail.orderStatusName || t('订单')}</span>
            <h2>订单号：{detail.orderSn}</h2>
            {detail.shop?.shopTitle ? <p>下单门店：{detail.shop.shopTitle}</p> : null}
            <p>下单时间：{detail.addTime || '-'}</p>
            {detail.joinStatusDesc ? <p>拼团状态：{detail.joinStatusDesc}</p> : null}
            {detail.orderStatusTip ? <p className="member-order-detail__tip">{detail.orderStatusTip}</p> : null}
            {detail.cancelRemark ? <p>取消原因：{detail.cancelRemark}</p> : null}
            {isGiftCardProduct ? (
              <p className="member-order-detail__tip">{t('为了您的财产安全，请妥善保管卡密信息，切勿将卡号、卡密、二维码截图等任何信息发送他人，谨防上当受骗!')}</p>
            ) : null}
            {offlineClaimStatus === 0 ? <p>{t('您已提交汇款凭证，等待财务人员核对流水，我们尽快完成审核。')}</p> : null}
            {offlineClaimRejected ? (
              <p className="member-order-detail__tip">
                认款审核未通过{detail.offlinePaymentClaimRejectReason ? `：${detail.offlinePaymentClaimRejectReason}` : ''}
              </p>
            ) : null}
            {showPayCountdown ? (
              <p className="member-order-detail__tip">{t('还剩')}<b>{payCountdown}</b>{t('订单自动取消')}</p>
            ) : null}
            {isOfflineOrder && offlineClaimStatus === 1 && offlineClaimAuditRemark ? <p>审核备注：{offlineClaimAuditRemark}</p> : null}
            {!showPayCountdown && actionEnabled(actions, 'toPay') && !offlineClaimRejected ? (
              <p>{t('请尽快完成支付，以免订单被自动取消')}</p>
            ) : null}
            {detail.cycleCardInfo?.expireTimeStr ? (
              <p>{detail.cycleCardInfo.expireTimeStr === '长期有效' ? t('长期有效') : t('有效期至：{d}', { d: detail.cycleCardInfo.expireTimeStr })}</p>
            ) : null}
            {[1, 2].includes(orderStatus) && Number(detail.autoDeliveryDays || 0) > 0 ? (
              <p>订单将在 {detail.autoDeliveryDays} 天后自动收货</p>
            ) : null}
            {detail.isPresale && Number(detail.presaleInfo?.presaleStatus) === 1 && orderStatus === 1 ? (
              <p>请在 {String(detail.presaleInfo?.finalPaymentStartTimeText || '')} 前支付尾款，超时将自动取消订单</p>
            ) : null}
            {!showPayCountdown && !actionEnabled(actions, 'toPay') ? <p>{detail.orderStatusTip || STATUS_DESC[orderStatus] || ''}</p> : null}
          </div>
          <div className="member-order-detail__actions">
            {actionEnabled(actions, 'cancelOrder') ? (
              <Button type="danger" onClick={() => { setCancelReason(''); setCancelVisible(true); }}>{t('取消订单')}</Button>
            ) : null}
            {actionEnabled(actions, 'offlinePaymentClaimDetail') && !offlineClaimRejected ? (
              <Link href={`/member/order/claiminfo?orderId=${detail.orderId || orderId}`}><Button>{t('认款详情')}</Button></Link>
            ) : null}
            {actionEnabled(actions, 'toPay') ? (
              offlineClaimRejected ? (
                <Link href={`/member/order/claiminfo?orderId=${detail.orderId || orderId}`}><Button theme="solid" type="primary">{t('修改申请')}</Button></Link>
              ) : (
                <Link href={`/order/pay?id=${detail.orderId || orderId}`}><Button theme="solid" type="primary">{t('付款')}</Button></Link>
              )
            ) : null}
            {/* 源码 OrderInfoHeader.vue：预售待付尾款 → 支付尾款 */}
            {detail.isPresale && Number(detail.presaleInfo?.presaleStatus) === 1 ? (
              <Link href={`/order/pay?id=${detail.orderId || orderId}&type=tail`}><Button theme="solid" type="primary">{t('支付尾款')}</Button></Link>
            ) : null}
            {actionEnabled(actions, 'confirmReceipt') && orderType !== 9 && orderType !== 10 ? <Button onClick={confirm}>{t('确认收货')}</Button> : null}
            {actionEnabled(actions, 'toAftersales', 'toAfterSales') && !giftCardBlocked && orderSource !== 'pos' && orderType !== 14 && !isPickupCompleted ? (
              <Link href={`/member/return/info?orderId=${detail.orderId || orderId}`}><Button>{t('整单售后')}</Button></Link>
            ) : null}
            {actionEnabled(actions, 'toAftersales', 'toAfterSales') ? (
              <Link href={`/member/aftersales/apply?orderId=${detail.orderId || orderId}`}><Button>{t('按商品售后')}</Button></Link>
            ) : null}
            {actionEnabled(actions, 'toComment') ? (
              <Link href={`/member/comment/info?orderId=${detail.orderId || orderId}`}><Button>{t('评价')}</Button></Link>
            ) : null}
            {actionEnabled(actions, 'delOrder') ? <Button onClick={deleteOrder}>{t('删除订单')}</Button> : null}
            {actionEnabled(actions, 'rebuy') ? <Button onClick={buyAgain}>{t('再次购买')}</Button> : null}
            {detail.trackingNo || detail.logisticsName ? <Button onClick={openShipping}>{t('查看物流')}</Button> : null}
          </div>
        </div>

        <div className="member-order-steps">
          {STEPS.map((step, index) => (
            <div key={step} className={`member-order-steps__item${index < activeStep ? ' is-active' : ''}`}>
              <span className="member-order-steps__dot">{index + 1}</span>
              <span>{step}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* 订单信息（OrderDeliveryInfo.vue） */}
      <Card className="member-card" title={t('订单信息')}>
        <div className="member-order-detail__address">
          {(detail.userAddress || detail.consignee || detail.mobile) && orderSource !== 'pos' ? (
            <span>收货信息：{detail.userAddress} {detail.consignee} {detail.mobile}</span>
          ) : null}
          {isPickupOrder && detail.pickupDetail ? (
            <span>自提信息：{String((detail.pickupDetail as any).pickupName || '')} {String((detail.pickupDetail as any).address || '')}</span>
          ) : null}
          {detail.shippingTypeName ? <span>配送方式：{detail.shippingTypeName}</span> : null}
          {showDeliveryStaff ? (
            <span>配送员：{deliveryOrderInfo?.staffName || '-'} {deliveryOrderInfo?.staffPhone || ''}</span>
          ) : null}
          <span>支付方式：{payText}</span>
          {detail.trackingNo ? <span>物流：{detail.logisticsName || '-'} {detail.trackingNo}</span> : null}
          {virtualSampleItem?.virtualSample ? (
            <span className="member-order__virtual" dangerouslySetInnerHTML={{ __html: virtualSampleItem.virtualSample }} />
          ) : null}
        </div>
      </Card>

      {/* 商品明细（OrderProductTable.vue） */}
      <Card className="member-card" title={t('订单商品')}>
        <div className="member-order-table">
          <table>
            <thead>
              <tr>
                <th>{t('商品名称')}</th>
                <th>{t('商品价格')}</th>
                <th>{t('购买数量')}</th>
                <th>{t('小计')}</th>
                {showItemAftersalesAction ? <th>{t('操作')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.itemId || index}>
                  <td>
                    <div className="member-order__product-main">
                      <img src={item.picThumb || item.productPicThumb || item.picUrl || ''} alt={item.productName || ''} />
                      <div>
                        <Link href={item.productId ? `/product/${item.productId}` : '/search'}>{item.productName}</Link>
                        {item.skuData ? (
                          <div className="member-order__skus">
                            {Array.isArray(item.skuData)
                              ? item.skuData.map((sku, skuIndex) => <span key={skuIndex}>{sku.name}：{sku.value}</span>)
                              : <span>{item.skuData}</span>}
                          </div>
                        ) : null}
                        {(item.extraSkuData || []).map((attr, attrIndex) => (
                          <div key={attrIndex} className="member-order__extra">
                            {attr.attrName}：{attr.attrValue}
                            {Number(attr.attrPrice || 0) > 0 ? ` (+¥${money(attr.attrPrice)})` : ''}
                          </div>
                        ))}
                        {item.productSn ? <div className="member-order-detail__product-sn">货号：{item.productSn}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td>¥ {money(item.price)}</td>
                  <td>{item.quantity}</td>
                  <td>¥ {money(item.subtotal ?? Number(item.price || 0) * Number(item.quantity || 0))}</td>
                  {showItemAftersalesAction ? (
                    <td>
                      {item.isGift === 0 && Number(item.quantity || 0) > Number(item.aftersalesNumber || 0) && !item.aftersalesItem ? (
                        <Link href={`/member/return/info?orderId=${detail.orderId || orderId}&itemId=${item.itemId || ''}`}>
                          <Button size="small">{t('申请售后')}</Button>
                        </Link>
                      ) : item.aftersalesItem ? (
                        <Link href={`/member/return/loginfo?id=${item.aftersalesItem.aftersaleId || ''}`}>
                          <Button size="small">{t('售后详情')}</Button>
                        </Link>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={showItemAftersalesAction ? 5 : 4}>
                  <div className="member-order-amounts">
                    <span>商品总价：¥ {money(detail.productAmount)}</span>
                    {Number(detail.serviceFee || 0) > 0 ? <span>附加费用：¥ {money(detail.serviceFee)}</span> : null}
                    {showShippingFee ? (
                      <span>
                        {shippingFeeLabel}：{Number(detail.shippingFee || 0) > 0 ? `¥ ${money(detail.shippingFee)}` : shippingFeeFreeText}
                      </span>
                    ) : null}
                    {Number(detail.balance || 0) > 0 ? <span>使用余额：¥ {money(detail.balance)}</span> : null}
                    {Number(detail.pointsAmount || 0) > 0 ? <span>积分减免：¥ {money(detail.pointsAmount)}</span> : null}
                    {Number(detail.discountAmount || 0) > 0 ? <span>其他优惠：- ¥ {money(detail.discountAmount)}</span> : null}
                    {Number(detail.couponAmount || 0) > 0 ? <span>优惠券优惠：- ¥ {money(detail.couponAmount)}</span> : null}
                    {Number(detail.unpaidAmount || 0) > 0 ? <span>待支付金额：¥ {money(detail.unpaidAmount)}</span> : null}
                    {Number(detail.creditAmount || 0) > 0 ? <span>账期金额：¥ {money(detail.creditAmount)}</span> : null}
                    {Number(detail.onlinePaidAmount || 0) > 0 ? <span>线上支付：¥ {money(detail.onlinePaidAmount)}</span> : null}
                    {Number(detail.offlinePaidAmount || 0) > 0 ? <span>线下支付：¥ {money(detail.offlinePaidAmount)}</span> : null}
                    <span className="total">{payStatus === 2 ? t('实付款') : '应付款'}：<b>¥ {money(detail.totalAmount)}</b></span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* 卡券信息（OrderEcard.vue） */}
      {ecardItems.length ? (
        <Card className="member-card" title={t('卡券信息')}>
          {ecardItems.map((item, index) => (
            <div key={index} className="member-order__ecard">
              <div className="member-order__ecard-title">{item.productName}</div>
              <div className="member-order__ecard-list">
                {(item.eCard || []).map((card, cardIndex) => (
                  <div key={cardIndex} className="member-order__ecard-item">
                    <span>{t('卡号：')}<b>{card.cardNumber}</b></span>
                    <span>{t('卡密：')}<b>{card.cardPassword || card.cardPwd}</b></span>
                    <Button size="small" onClick={() => copyText(`${card.cardNumber || ''} ${card.cardPassword || card.cardPwd || ''}`)}>{t('复制')}</Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </Card>
      ) : null}

      {/* 礼品卡信息（OrderGiftCard.vue） */}
      {giftCardInfo.length ? (
        <Card className="member-card" title={t('卡片信息（共 {n} 张）', { n: detail.giftCardOrder?.num ?? giftCardInfo.length })}>
          <div className="member-order__giftcards">
            {giftCardInfo.map((card, index) => (
              <div key={card.giftCardsId || index} className="member-order__giftcard">
                <div>{t('卡号：')}<b>{card.cardNumber}</b></div>
                <div>{t('卡密：')}<b>{card.cardPassword}</b></div>
                <div>状态：{card.statusName || (card.status === 0 ? t('未使用') : '已使用')}</div>
                <Button size="small" onClick={() => copyText(`${card.cardNumber || ''} ${card.cardPassword || ''}`)}>{t('复制卡号卡密')}</Button>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {detail.buyerNote ? (
        <Card className="member-card" title={t('买家留言')}>
          {detail.buyerNote}
        </Card>
      ) : null}

      {detail.invoiceData ? (
        <Card className="member-card" title={t('发票信息')}>
          <div className="member-order-detail__address">
            {detail.invoiceData.invoiceTitle || detail.invoiceData.title ? <span>抬头：{detail.invoiceData.invoiceTitle || detail.invoiceData.title}</span> : null}
            {detail.invoiceData.taxNo ? <span>税号：{detail.invoiceData.taxNo}</span> : null}
            {detail.invoiceData.invoiceType ? <span>类型：{detail.invoiceData.invoiceType}</span> : null}
          </div>
        </Card>
      ) : null}

      <div className="member-order-detail__links">
        <Link href={`/member/feedback/asklist?orderId=${detail.orderId || orderId}&orderSn=${detail.orderSn || ''}`}>订单留言/咨询</Link>
        <Link href="/member/order/list" className="member-order-detail__back">{t('返回订单列表')}</Link>
      </div>

      {/* 取消订单原因（CancelOrderReasonDialog.vue） */}
      <Modal visible={cancelVisible} title={t('取消订单')} onCancel={() => setCancelVisible(false)} onOk={() => void submitCancel()}>
        {Number(reasonConfig?.afterSalesReasonEnabled ?? 0) === 1 && (reasonConfig?.cancelOrderReasonList || []).length ? (
          <select value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} style={{ width: '100%', padding: '8px' }}>
            <option value="">{t('请选择取消原因')}</option>
            {(reasonConfig?.cancelOrderReasonList || []).map((reason) => <option key={reason} value={reason}>{reason}</option>)}
          </select>
        ) : (
          <p>{t('确认取消该订单？')}</p>
        )}
      </Modal>

      {/* 物流跟踪 */}
      <Modal visible={shippingVisible} title={t('物流跟踪')} footer={null} onCancel={() => setShippingVisible(false)} width={560}>
        {shipping ? (
          <div>
            <p>物流单号：{shipping.logisticCode || detail.trackingNo || '-'}</p>
            <p>物流状态：{shipping.state || shipping.stateEx || '-'}</p>
            {(shipping.traces || []).length ? (shipping.traces || []).map((trace, index) => (
              <div key={index} className="member-order-shipping__trace">
                <span>{trace.acceptTime || ''}</span>
                <div>{trace.acceptStation || trace.action || trace.location || ''}</div>
              </div>
            )) : <p>{t('暂无物流轨迹')}</p>}
          </div>
        ) : <p>{t('暂无物流轨迹')}</p>}
      </Modal>
    </div>
  );
}

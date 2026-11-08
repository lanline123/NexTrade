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
import MemberCancelOrderDialog from '@/components/MemberCancelOrderDialog';
import MemberLogisticsDialog from '@/components/MemberLogisticsDialog';
import PresaleSteps from '@/components/PresaleSteps';

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
  shippingMethod?: number;
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
  presaleInfo?: {
    presaleStatus?: number;
    saleMode?: number;
    finalPaymentStartTimeText?: string;
    /** 预售规则文案（PresaleSteps 需要） */
    [key: string]: unknown;
  };
  isCycleOrder?: number;
  cycleCardInfo?: { expireTimeStr?: string; statusName?: string };
  giftCardOrder?: { num?: number; giftCardOrderInfo?: GiftCardInfo[] };
  availableActions?: Record<string, boolean>;
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
  const [cancelVisible, setCancelVisible] = useState(false);
  const [shippingVisible, setShippingVisible] = useState(false);
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

  const openShipping = () => {
    setShippingVisible(true);
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

  /**
   * 预售配送方式（源码 OrderStatusSteps.vue presaleDeliveryType）：
   * 自提 → 2，同城 → 3，其余 → undefined（快递）
   */
  const presaleDeliveryType = useMemo(() => {
    if (detail?.isPickup) return 2;
    const shippingTypeName = String(detail?.shippingTypeName || '');
    if (shippingTypeName.includes('同城')) return 3;
    return undefined;
  }, [detail?.isPickup, detail?.shippingTypeName]);

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
    <div className="info-row">
      <div className="title-or-tabs right-info">
        <span>{t('订单详情')}</span>
        <div>
          <Link href={`/member/feedback/asklist?orderId=${detail.orderId || orderId}&orderSn=${detail.orderSn || ''}`}>
            <Button>{t('订单留言/咨询')}</Button>
          </Link>
        </div>
      </div>

      <div className="order-info">
        {/* 订单头部（OrderInfoHeader.vue）：.page-info-body.lr → .order-left / .order-right */}
        <div className="page-info-body lr">
          <div className="order-left">
            <div>
              <span>
                {t('订单号')}：<strong>{detail.orderSn}</strong>
              </span>
              {detail.shop?.shopTitle ? (
                <span style={{ marginLeft: 40 }}>
                  {t('下单门店')}：<span className="font-color">{detail.shop.shopTitle}</span>
                </span>
              ) : null}
              <span style={{ marginLeft: 40 }}>
                {t('订单状态')}：<strong>{detail.orderStatusName || t('订单')}{detail.joinStatusDesc ? `（${detail.joinStatusDesc}）` : ''}</strong>
              </span>
            </div>
            {detail.orderStatusTip ? <div>{detail.orderStatusTip}</div> : null}
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
          <div className="order-right">
            {actionEnabled(actions, 'cancelOrder') ? (
              <Button type="danger" onClick={() => setCancelVisible(true)}>{t('取消订单')}</Button>
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

        {/* 预售状态步骤条（源码 pages/member/order/src/OrderStatusSteps.vue → PresaleSteps） */}
        {detail.isPresale && detail.presaleInfo ? (
          <div className="page-info-body">
            <div className="sub-title">{t('预售状态')}</div>
            <div className="presale-steps">
              <PresaleSteps
                productPresale={detail.presaleInfo as unknown as Record<string, any>}
                presaleStatus={Number(detail.presaleInfo.presaleStatus ?? 0)}
                total={detail as unknown as Record<string, any>}
                deliveryType={presaleDeliveryType}
              />
            </div>
          </div>
        ) : null}

        {/* 订单信息（OrderDeliveryInfo.vue）：.sub-title + ul.order-ul */}
        <div className="page-info-body">
          <div className="sub-title">{t('订单信息')}</div>
          <ul className="order-ul" style={{ marginTop: 20 }}>
            {(detail.userAddress || detail.consignee || detail.mobile) && orderSource !== 'pos' ? (
              <li>收货信息：<span>{detail.userAddress} {detail.consignee} {detail.mobile}</span></li>
            ) : null}
            {isPickupOrder && detail.pickupDetail ? (
              <li>自提信息：<span>{String((detail.pickupDetail as any).pickupName || '')} {String((detail.pickupDetail as any).address || '')}</span></li>
            ) : null}
            {detail.shippingTypeName ? <li>配送方式：<span>{detail.shippingTypeName}</span></li> : null}
            {showDeliveryStaff ? (
              <li>配送员：<span>{deliveryOrderInfo?.staffName || '-'} {deliveryOrderInfo?.staffPhone || ''}</span></li>
            ) : null}
            <li>支付方式：<span>{payText}</span></li>
            {detail.trackingNo ? <li>物流：<span>{detail.logisticsName || '-'} {detail.trackingNo}</span></li> : null}
            {virtualSampleItem?.virtualSample ? (
              <li className="virtualsample">
                虚拟内容：
                <span className="virtualsample-value" dangerouslySetInnerHTML={{ __html: virtualSampleItem.virtualSample }} />
              </li>
            ) : null}
          </ul>
        </div>

        {/* 商品明细（OrderProductTable.vue）：table.order-table-info */}
        <div className="page-info-body">
          <div className="sub-title">{t('订单商品')}</div>
          <table className="order-table-info">
            <thead>
              <tr className="receipt-header">
                <th>{t('商品名称')}</th>
                <th>{t('商品价格')}</th>
                <th>{t('购买数量')}</th>
                <th>{t('小计')}</th>
                {showItemAftersalesAction ? <th>{t('操作')}</th> : null}
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => (
                <tr key={item.itemId || index} className="receipt-body">
                  <td className="receipt-item">
                    <div className="product-cell">
                      <img className="img-border" src={item.picThumb || item.productPicThumb || item.picUrl || ''} alt={item.productName || ''} />
                      <div className="product-cell__info">
                        <div className="product-cell__name">
                          <Link href={item.productId ? `/product/${item.productId}` : '/search'}>{item.productName}</Link>
                        </div>
                        {item.skuData ? (
                          <div className="sku-style">
                            {Array.isArray(item.skuData)
                              ? item.skuData.map((sku, skuIndex) => <div key={skuIndex}>{sku.name}：{sku.value}</div>)
                              : <div>{item.skuData}</div>}
                          </div>
                        ) : null}
                        {(item.extraSkuData || []).map((attr, attrIndex) => (
                          <div key={attrIndex} className="extraskudata extraskudata-item">
                            <div className="title">{attr.attrName}</div>
                            <div className="content">
                              <span className="content-text">{attr.attrValue}</span>
                              {Number(attr.attrPrice || 0) > 0 ? <span className="num">+¥{money(attr.attrPrice)}</span> : null}
                            </div>
                          </div>
                        ))}
                        {item.productSn ? <div className="sku-style">货号：{item.productSn}</div> : null}
                      </div>
                    </div>
                  </td>
                  <td className="receipt-item price">¥ {money(item.price)}</td>
                  <td className="receipt-item price">{item.quantity}</td>
                  <td className="receipt-item price">¥ {money(item.subtotal ?? Number(item.price || 0) * Number(item.quantity || 0))}</td>
                  {showItemAftersalesAction ? (
                    <td className="receipt-item operation">
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
              <tr className="receipt-footer">
                <td colSpan={showItemAftersalesAction ? 2 : 1}></td>
                <td className="receipt-footer-it one" colSpan={showItemAftersalesAction ? 3 : 3}>
                  <div className="item">
                    <div className="label">商品总价：</div>
                    <div className="text">¥ {money(detail.productAmount)}</div>
                  </div>
                  {Number(detail.serviceFee || 0) > 0 ? (
                    <div className="item">
                      <div className="label">附加费用：</div>
                      <div className="text">¥ {money(detail.serviceFee)}</div>
                    </div>
                  ) : null}
                  {showShippingFee ? (
                    <div className="item">
                      <div className="label">{shippingFeeLabel}：</div>
                      <div className="text">{Number(detail.shippingFee || 0) > 0 ? `¥ ${money(detail.shippingFee)}` : shippingFeeFreeText}</div>
                    </div>
                  ) : null}
                  {Number(detail.balance || 0) > 0 ? (
                    <div className="item">
                      <div className="label">使用余额：</div>
                      <div className="text">¥ {money(detail.balance)}</div>
                    </div>
                  ) : null}
                  {Number(detail.pointsAmount || 0) > 0 ? (
                    <div className="item">
                      <div className="label">积分减免：</div>
                      <div className="text">¥ {money(detail.pointsAmount)}</div>
                    </div>
                  ) : null}
                  {Number(detail.discountAmount || 0) > 0 ? (
                    <div className="item">
                      <div className="label">其他优惠：</div>
                      <div className="text">- ¥ {money(detail.discountAmount)}</div>
                    </div>
                  ) : null}
                  {Number(detail.couponAmount || 0) > 0 ? (
                    <div className="item">
                      <div className="label">优惠券优惠：</div>
                      <div className="text">- ¥ {money(detail.couponAmount)}</div>
                    </div>
                  ) : null}
                  {Number(detail.unpaidAmount || 0) > 0 ? (
                    <div className="item">
                      <div className="label">待支付金额：</div>
                      <div className="text">¥ {money(detail.unpaidAmount)}</div>
                    </div>
                  ) : null}
                  {Number(detail.creditAmount || 0) > 0 ? (
                    <div className="item">
                      <div className="label">账期金额：</div>
                      <div className="text">¥ {money(detail.creditAmount)}</div>
                    </div>
                  ) : null}
                  {Number(detail.onlinePaidAmount || 0) > 0 ? (
                    <div className="item">
                      <div className="label">线上支付：</div>
                      <div className="text">¥ {money(detail.onlinePaidAmount)}</div>
                    </div>
                  ) : null}
                  {Number(detail.offlinePaidAmount || 0) > 0 ? (
                    <div className="item">
                      <div className="label">线下支付：</div>
                      <div className="text">¥ {money(detail.offlinePaidAmount)}</div>
                    </div>
                  ) : null}
                  <div className="item">
                    <span>{payStatus === 2 ? t('实付款') : '应付款'}：</span>
                    <b style={{ fontSize: 20, color: 'var(--price, #cc0c1c)' }}>¥ {money(detail.totalAmount)}</b>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* 卡券信息（OrderEcard.vue） */}
        {ecardItems.length ? (
          <div className="page-info-body">
            <div className="sub-title">{t('卡券信息')}</div>
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
          </div>
        ) : null}

        {/* 礼品卡信息（OrderGiftCard.vue） */}
        {giftCardInfo.length ? (
          <div className="page-info-body">
            <div className="sub-title">{t('卡片信息（共 {n} 张）', { n: detail.giftCardOrder?.num ?? giftCardInfo.length })}</div>
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
          </div>
        ) : null}

        {detail.buyerNote ? (
          <div className="page-info-body">
            <div className="sub-title">{t('买家留言')}</div>
            <div>{detail.buyerNote}</div>
          </div>
        ) : null}

        {detail.invoiceData ? (
          <div className="page-info-body">
            <div className="sub-title">{t('发票信息')}</div>
            <ul className="order-ul">
              {detail.invoiceData.invoiceTitle || detail.invoiceData.title ? <li>抬头：<span>{detail.invoiceData.invoiceTitle || detail.invoiceData.title}</span></li> : null}
              {detail.invoiceData.taxNo ? <li>税号：<span>{detail.invoiceData.taxNo}</span></li> : null}
              {detail.invoiceData.invoiceType ? <li>类型：<span>{detail.invoiceData.invoiceType}</span></li> : null}
            </ul>
          </div>
        ) : null}

        <div className="member-order-detail__links">
          <Link href="/member/order/list" className="member-order-detail__back">{t('返回订单列表')}</Link>
        </div>
      </div>

      {/* 取消订单原因（CancelOrderReasonDialog.vue） */}
      {/* 取消订单原因弹窗（CancelOrderReasonDialog 对照） */}
      <MemberCancelOrderDialog
        visible={cancelVisible}
        orderId={orderId}
        onClose={() => setCancelVisible(false)}
        onSuccess={load}
      />

      {/* 物流跟踪（LogisticsTracking 对照） */}
      <MemberLogisticsDialog
        visible={shippingVisible}
        orderId={orderId}
        trackingNo={detail.trackingNo}
        logisticsName={detail.logisticsName}
        shippingMethod={detail.shippingMethod}
        onClose={() => setShippingVisible(false)}
      />
    </div>
  );
}

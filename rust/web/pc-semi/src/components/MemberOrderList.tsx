'use client';

/**
 * 我的订单列表（PC 会员中心）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/components/member/order/MemberOrderList.vue
 *   + CancelOrderReasonDialog.vue / LogisticsTracking.vue / utils/orderPayment.ts / utils/giftCard.ts
 *
 * 对齐点：
 * - 5 个 Tab + orderNum 角标；D1146 评价关闭时隐藏「待评价」，?type=awaitComment 回落全部
 * - 卡片：状态栏(含取消原因) / 订单号+共N件 / 商品行(预售·拼团角标、规格、单价×数量) / 操作栏
 * - 定金预售(saleMode=2)：首个商品行显示「总额/应付」
 * - 操作按钮 10 种 + availableActions 驱动 + o2o/礼品卡/周期购/自提守卫（数据缺失时自然不生效）
 * - 取消订单走 reasonConfig 原因弹窗（关闭时回落确认框）；删除/确认收货二次确认
 * - 查看物流弹窗 shippingInfo；再次购买 buyAgain → /order/check；认款详情 → claimInfo 页
 *
 * 已知后端缺口（前端守卫下自动隐藏，不报错）：
 * - Rust 订单列表 availableActions 未下发 offlinePaymentClaimDetail；items[].aftersalesItem 为 null
 * - 订单 VO 无 offlinePaymentClaimStatus / payTypeId / logisticsName 字段
 */

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Input, Modal, Radio, Spin, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

type TabKey = 'all' | 'awaitPay' | 'awaitShipping' | 'awaitReceived' | 'awaitComment';

interface OrderItem {
  productId?: number;
  productName?: string;
  productSn?: string;
  picThumb?: string;
  productPicThumb?: string;
  quantity?: number;
  price?: string | number;
  skuData?: Array<{ name?: string; value?: string }> | string[] | string;
  productType?: number | string;
  aftersalesItem?: { aftersaleId?: number } | null;
}

interface OrderRow {
  orderId: number;
  orderSn?: string;
  orderStatus?: number;
  orderStatusName?: string;
  totalAmount?: string | number;
  unpaidAmount?: string | number;
  addTime?: string;
  items?: OrderItem[];
  availableActions?: Record<string, boolean>;
  cancelRemark?: string;
  orderType?: number | string;
  orderSource?: string;
  shopId?: number;
  joinStatus?: number;
  grouponPromotionRecordId?: number;
  isPresale?: boolean | number;
  presaleInfo?: { saleMode?: number | string; presaleStatus?: number | string } | null;
  isCardOrder?: boolean;
  parentOrderSn?: string | number;
  isCycleOrder?: number;
  isPickup?: boolean;
  cycleCardInfo?: { statusName?: string } | null;
  payTypeId?: number | string | null;
  offlinePaymentClaimStatus?: number | string | null;
}

interface TraceNode {
  acceptTime?: string;
  acceptStation?: string;
  action?: string;
}

const TABS: Array<{ key: TabKey; label: string; orderStatus: number; commentStatus: number }> = [
  { key: 'all', label: '全部', orderStatus: -1, commentStatus: -1 },
  { key: 'awaitPay', label: '待付款', orderStatus: 0, commentStatus: -1 },
  { key: 'awaitShipping', label: '待发货', orderStatus: 1, commentStatus: -1 },
  { key: 'awaitReceived', label: '待收货', orderStatus: 2, commentStatus: -1 },
  { key: 'awaitComment', label: '待评价', orderStatus: -1, commentStatus: 0 },
];

const GIFT_CARD_ORDER_TYPE = 11;
const PHYSICAL_GIFT_CARD_PRODUCT_TYPE = 7;

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function skuText(sku: OrderItem['skuData']): string {
  if (!sku) return '';
  if (typeof sku === 'string') {
    const trimmed = sku.trim();
    return trimmed && trimmed !== '[]' && trimmed !== '{}' ? trimmed : '';
  }
  if (!Array.isArray(sku)) return '';
  return sku
    .map((item) => (typeof item === 'string' ? item : `${item?.name ?? ''}：${item?.value ?? ''}`))
    .filter(Boolean)
    .join('；');
}

function productHref(item: OrderItem, shopId?: number): string {
  return item.productId ? `/product/${item.productId}${shopId && shopId > 0 ? `?shopId=${shopId}` : ''}` : '/search';
}

// —— 守卫（对齐原版 MemberOrderList.vue / orderPayment.ts / giftCard.ts）——
const isOrderType14 = (order: OrderRow) => Number(order.orderType) === 14;
const isDepositPresaleOrder = (order: OrderRow) => Number(order.presaleInfo?.saleMode ?? 0) === 2;
const isMainSubCardOrder = (order: OrderRow) => order.isCardOrder && Number(order.parentOrderSn) === 0;
const isSubCardOrder = (order: OrderRow) => order.isCardOrder && Number(order.parentOrderSn) > 0;
const isCycleInfo = (order: OrderRow) => Number(order.isCycleOrder) === 1;
const isPickupCompleted = (order: OrderRow) => order.isPickup && Number(order.orderStatus) === 5;
const isCardSecretOrder = (order: OrderRow) => {
  const items = order.items ?? [];
  return items.length > 0 && items.every((item) => Number(item.productType) === 3);
};
const isPhysicalGiftCardItem = (item?: OrderItem) => Number(item?.productType ?? 0) === PHYSICAL_GIFT_CARD_PRODUCT_TYPE;
const isGiftCardAftersalesBlocked = (order: OrderRow) => {
  const orderType = Number(order?.orderType ?? 0);
  if (orderType === 12) return true;
  if (orderType !== GIFT_CARD_ORDER_TYPE) return false;
  return !(order.items ?? []).some(isPhysicalGiftCardItem);
};

/** 认款通过的定金订单仍可支付尾款，支付权限继续以后端返回为准。 */
const canShowToPay = (order: OrderRow): boolean => {
  if (!order.availableActions?.toPay) return false;
  if (Number(order.payTypeId) !== 3) return true;
  const status = order.offlinePaymentClaimStatus;
  if (status === null || status === undefined || Number(status) === 2) return true;
  return Number(status) === 1 && Number(order.presaleInfo?.saleMode) === 2 && Number(order.presaleInfo?.presaleStatus) === 1;
};

interface NumMap {
  all?: number;
  awaitPay?: number;
  awaitShipping?: number;
  awaitReceived?: number;
  awaitComment?: number;
}

export default function MemberOrderList({ initialType }: { initialType?: string }) {
  const initial = TABS.some((item) => item.key === initialType) ? (initialType as TabKey) : 'all';
  const [tab, setTab] = useState<TabKey>(initial);
  const [keyword, setKeyword] = useState('');
  const [rows, setRows] = useState<OrderRow[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [nums, setNums] = useState<NumMap>({});
  const [commentEnabled, setCommentEnabled] = useState<number | null>(null);

  // 取消订单原因弹窗（CancelOrderReasonDialog 对照）
  const [cancelState, setCancelState] = useState<{ visible: boolean; orderId: number; reasons: string[]; selected: string; submitting: boolean }>({
    visible: false,
    orderId: 0,
    reasons: [],
    selected: '',
    submitting: false,
  });
  // 查看物流弹窗（LogisticsTracking 对照）
  const [track, setTrack] = useState<{ visible: boolean; loading: boolean; orderId: number; shipperCode: string; logisticCode: string; traces: TraceNode[] }>({
    visible: false,
    loading: false,
    orderId: 0,
    shipperCode: '',
    logisticCode: '',
    traces: [],
  });

  const size = 10;

  // D1146：评价总开关
  useEffect(() => {
    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => setCommentEnabled(Number(json?.data?.productCommentEnabled ?? 1)))
      .catch(() => setCommentEnabled(1));
  }, []);

  // D1146：评价关闭时，?type=awaitComment（历史书签）回落全部
  useEffect(() => {
    if (commentEnabled === 0 && tab === 'awaitComment') setTab('all');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentEnabled]);

  const loadNum = () => {
    apiGet<NumMap>('user/order/orderNum')
      .then((result) => setNums(result || {}))
      .catch(() => setNums({}));
  };

  const load = () => {
    const current = TABS.find((item) => item.key === tab) || TABS[0];
    setLoading(true);
    apiGet<{ records?: OrderRow[]; total?: number }>('user/order/list', {
      page,
      size,
      sortField: 'addTime',
      sortOrder: 'desc',
      keyword,
      payStatus: -1,
      orderStatus: current.orderStatus,
      commentStatus: current.commentStatus,
      dateType: 1,
    })
      .then((result) => {
        setRows(Array.isArray(result?.records) ? result.records : []);
        setTotal(Number(result?.total || 0));
        setNeedLogin(false);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
        setRows([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (commentEnabled === null) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, page, commentEnabled]);

  useEffect(() => {
    loadNum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const afterAction = () => {
    load();
    loadNum();
    // 通知左侧 MemberNav 刷新角标（评价数/售后红点等）
    window.dispatchEvent(new Event('member-badges-changed'));
  };

  // —— 操作：确认收货（二次确认，对齐原版 onConfirmReceipt）——
  const onConfirmReceipt = (orderId: number) => {
    Modal.confirm({
      title: '确认要收货吗',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiPost('user/order/confirmReceipt', { id: orderId });
          Toast.success({ content: '确认收货成功' });
          afterAction();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '操作失败' });
        }
      },
    });
  };

  // —— 操作：删除订单（对齐原版 onDelOrder）——
  const onDelOrder = (orderId: number) => {
    Modal.confirm({
      title: '确认要删除该订单吗',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiPost('user/order/delOrder', { id: orderId });
          Toast.success({ content: '删除成功' });
          afterAction();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
        }
      },
    });
  };

  // —— 操作：取消订单（reasonConfig 原因弹窗，未启用原因时回落确认框）——
  const onCancelOrder = async (orderId: number) => {
    setCancelState({ visible: false, orderId, reasons: [], selected: '', submitting: false });
    try {
      const config = await apiGet<{ afterSalesReasonEnabled?: number; afterSalesReasonList?: string[]; cancelOrderReasonList?: string[] }>(
        'user/order/reasonConfig',
      );
      const reasons = Array.isArray(config?.afterSalesReasonList) ? config.afterSalesReasonList : Array.isArray(config?.cancelOrderReasonList) ? config.cancelOrderReasonList : [];
      if (Number(config?.afterSalesReasonEnabled) === 1 && reasons.length) {
        setCancelState({ visible: true, orderId, reasons, selected: '', submitting: false });
        return;
      }
      cancelWithoutReason(orderId);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '获取取消原因失败' });
      cancelWithoutReason(orderId);
    }
  };

  const cancelWithoutReason = (orderId: number) => {
    Modal.confirm({
      title: '确认要取消该订单吗',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await apiPost('user/order/cancelOrder', { id: orderId });
          Toast.success({ content: '取消订单成功' });
          afterAction();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '取消失败' });
        }
      },
    });
  };

  const submitCancelWithReason = async () => {
    if (!cancelState.selected || cancelState.submitting) return;
    setCancelState((state) => ({ ...state, submitting: true }));
    try {
      await apiPost('user/order/cancelOrder', { id: cancelState.orderId, description: cancelState.selected });
      Toast.success({ content: '取消订单成功' });
      setCancelState((state) => ({ ...state, visible: false }));
      afterAction();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '取消失败' });
    } finally {
      setCancelState((state) => ({ ...state, submitting: false }));
    }
  };

  // —— 操作：再次购买（跨境：buyAgain → /order/check，对齐原版 onReBuy）——
  const onReBuy = async (order: OrderRow) => {
    try {
      await apiPost('user/order/buyAgain', { id: order.orderId });
      Toast.success({ content: '正在跳转中，请稍后~' });
      setTimeout(() => {
        window.location.href = '/order/check';
      }, 1500);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '再次购买失败' });
    }
  };

  // —— 操作：查看物流（shippingInfo 弹窗，对齐原版 viewLogistics + LogisticsTracking）——
  const viewLogistics = (order: OrderRow) => {
    setTrack({ visible: true, loading: true, orderId: order.orderId, shipperCode: '', logisticCode: '', traces: [] });
    apiGet<{ shipperCode?: string; logisticCode?: string; traces?: TraceNode[] } | TraceNode[]>('user/order/shippingInfo', { id: order.orderId })
      .then((result) => {
        if (Array.isArray(result)) {
          setTrack((state) => ({ ...state, loading: false, traces: result }));
        } else {
          setTrack((state) => ({
            ...state,
            loading: false,
            shipperCode: String(result?.shipperCode || ''),
            logisticCode: String(result?.logisticCode || ''),
            traces: Array.isArray(result?.traces) ? result.traces : [],
          }));
        }
      })
      .catch((error) => {
        setTrack((state) => ({ ...state, loading: false }));
        Toast.error({ content: error instanceof Error ? error.message : '物流查询失败' });
      });
  };

  const visibleTabs = useMemo(() => TABS.filter((item) => item.key !== 'awaitComment' || commentEnabled === 1), [commentEnabled]);

  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>登录后查看订单</h2>
        <p>登录后可查看订单状态、物流和售后。</p>
        <Link href="/login?redirect=/member/order/list">
          <Button theme="solid" type="primary" size="large">去登录</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="member-orders">
      <div className="pc-order-panel">
        <div className="pc-order-panel__head">
          <div className="member-orders__tabs">
            {visibleTabs.map((item) => {
              const num = Number(nums[item.key] || 0);
              return (
                <button
                  key={item.key}
                  type="button"
                  className={item.key === tab ? 'is-active' : ''}
                  onClick={() => {
                    setPage(1);
                    setTab(item.key);
                  }}
                >
                  {item.label}
                  {num > 0 ? <span className="member-orders__num">{num}</span> : null}
                </button>
              );
            })}
          </div>
          <div className="member-orders__search">
            <Input value={keyword} onChange={setKeyword} placeholder="收货人名称或订单号" onEnterPress={() => { setPage(1); load(); }} />
            <Button onClick={() => { setPage(1); load(); }}>搜索</Button>
          </div>
        </div>

        <div className="pc-order-panel__body">
          {loading ? (
            <div className="member-orders__loading"><Spin size="large" /></div>
          ) : rows.length ? (
            <div className="member-orders__list">
              {rows.map((order) => {
            const actions = order.availableActions || {};
            const totalCount = (order.items || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
            const canAftersales =
              actions.toAftersales &&
              order.orderSource !== 'pos' &&
              order.cycleCardInfo?.statusName !== '已过期' &&
              !isGiftCardAftersalesBlocked(order) &&
              !isOrderType14(order) &&
              !isCycleInfo(order) &&
              !isPickupCompleted(order);
            const aftersalesItem = (order.items || [])[0]?.aftersalesItem;
            return (
              <article key={order.orderId} className="member-order">
                <header className="member-order__head">
                  <span className={`member-order__status is-s${order.orderStatus ?? -1}`}>{order.orderStatusName || '订单'}</span>
                  <span className="member-order__sn">{order.orderSn}</span>
                  <span className="member-order__time">{order.addTime}</span>
                  <Link className="member-order__detail" href={`/member/order/info?id=${order.orderId}`} target="_blank">
                    订单详情<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true"><path d="M4 2.5L7.5 6L4 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </Link>
                </header>
                {String(order.cancelRemark ?? '').trim() ? <div className="member-order__remark">取消原因：{order.cancelRemark}</div> : null}
                {(order.items || []).map((item, index) => (
                  <div key={index} className="member-order__shop">
                    <Link href={productHref(item, order.shopId)} target="_blank" className="member-order__shop-main">
                      <img src={item.productPicThumb || item.picThumb || ''} alt={item.productName || ''} />
                      <div className="member-order__shop-text">
                        <div className="member-order__shop-name">
                          {Number(order.isPresale) === 1 || order.isPresale === true ? <span className="member-order__tag-presale">预售</span> : null}
                          {Number(order.joinStatus) === 1 ? <span className="member-order__tag-joining">拼团</span> : null}
                          {item.productName}
                        </div>
                        {skuText(item.skuData) ? <div className="member-order__shop-sku">{skuText(item.skuData)}</div> : null}
                      </div>
                    </Link>
                    <div className="member-order__shop-price">
                      {isDepositPresaleOrder(order) && index === 0 ? (
                        <div className="member-order__presale-amount">
                          <div><span>总额</span><b>¥ {money(order.totalAmount)}</b></div>
                          <div><span>应付</span><b>¥ {money(order.unpaidAmount)}</b></div>
                        </div>
                      ) : (
                        <Link href={productHref(item)} target="_blank">¥ {money(item.price)}</Link>
                      )}
                      <Link href={productHref(item)} target="_blank"><span className="member-order__qty">×{item.quantity}</span></Link>
                    </div>
                  </div>
                ))}
                <footer className="member-order__foot">
                  <div className="member-order__total">
                    <span>共 {totalCount} 件</span>
                    <span className="member-order__total-label">合计</span>
                    <b>¥ {money(order.totalAmount)}</b>
                  </div>
                  <div className="member-order__bot-actions">
                    {actions.confirmReceipt && !isCardSecretOrder(order) ? (
                      <Button size="small" onClick={() => viewLogistics(order)}>查看物流</Button>
                    ) : null}
                    {canShowToPay(order) ? (
                      Number(order.offlinePaymentClaimStatus) === 2 ? (
                        <Link href={`/member/order/claimInfo?orderId=${order.orderId}`}><Button size="small" theme="solid" type="primary">修改申请</Button></Link>
                      ) : (
                        <Link href={`/order/pay?id=${order.orderId}`}><Button size="small" theme="solid" type="primary">去支付</Button></Link>
                      )
                    ) : null}
                    {Boolean(actions.offlinePaymentClaimDetail) && Number(order.offlinePaymentClaimStatus) !== 2 ? (
                      <Link href={`/member/order/claimInfo?orderId=${order.orderId}`}><Button size="small">认款详情</Button></Link>
                    ) : null}
                    {actions.cancelOrder ? <Button size="small" onClick={() => void onCancelOrder(order.orderId)}>取消订单</Button> : null}
                    {actions.delOrder ? <Button size="small" onClick={() => onDelOrder(order.orderId)}>删除订单</Button> : null}
                    {actions.confirmReceipt && Number(order.orderType) !== 9 && Number(order.orderType) !== 10 ? (
                      <Button size="small" theme="solid" type="primary" onClick={() => onConfirmReceipt(order.orderId)}>确认收货</Button>
                    ) : null}
                    {canAftersales ? (
                      <Link href={`/member/return/info?orderId=${order.orderId}`}><Button size="small">申请售后</Button></Link>
                    ) : null}
                    {order.items && order.items[0]?.aftersalesItem && !isGiftCardAftersalesBlocked(order) && !isOrderType14(order) && !isCycleInfo(order) ? (
                      <Link href={`/member/return/logInfo?id=${aftersalesItem?.aftersaleId || ''}`}><Button size="small">售后详情</Button></Link>
                    ) : null}
                    {actions.rebuy && !isSubCardOrder(order) ? (
                      <Button size="small" theme="solid" type="primary" onClick={() => void onReBuy(order)}>再次购买</Button>
                    ) : null}
                    {actions.toComment && commentEnabled === 1 ? (
                      <Link href={`/member/comment/info?id=${order.orderId}`}><Button size="small">去评价</Button></Link>
                    ) : null}
                    {Number(order.joinStatus) === 1 && order.grouponPromotionRecordId ? (
                      <Link href={`/member/group/info?id=${order.grouponPromotionRecordId}`} target="_blank"><Button size="small">拼团详情</Button></Link>
                    ) : null}
                  </div>
                </footer>
              </article>
            );
          })}
            </div>
          ) : (
            <div className="member-orders__empty">
              <p className="member-orders__empty-title">当前筛选下还没有任何订单哦!</p>
              <p className="member-orders__empty-sub">
                现在就去：<Link href="/">选购商品</Link>
              </p>
            </div>
          )}
        </div>

        {total > size ? (
          <div className="pc-order-panel__foot">
            <div className="pc-pagination">
              {Array.from({ length: Math.ceil(total / size) }).map((_, index) => (
                <button key={index} type="button" className={index + 1 === page ? 'is-active' : ''} onClick={() => setPage(index + 1)}>
                  {index + 1}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* 取消订单原因弹窗（CancelOrderReasonDialog 对照） */}
      <Modal
        title="请选择取消订单原因"
        visible={cancelState.visible}
        width={480}
        closeOnEsc
        onCancel={() => setCancelState((state) => ({ ...state, visible: false }))}
        footer={
          <>
            <Button onClick={() => setCancelState((state) => ({ ...state, visible: false }))}>取消</Button>
            <Button theme="solid" type="primary" loading={cancelState.submitting} disabled={!cancelState.selected} onClick={() => void submitCancelWithReason()}>
              确定
            </Button>
          </>
        }
      >
        <Radio.Group value={cancelState.selected} onChange={(event) => setCancelState((state) => ({ ...state, selected: String(event.target.value ?? '') }))}>
          <div className="member-orders__reasons">
            {cancelState.reasons.map((reason) => (
              <Radio key={reason} value={reason}>{reason}</Radio>
            ))}
          </div>
        </Radio.Group>
      </Modal>

      {/* 查看物流弹窗（LogisticsTracking 对照） */}
      <Modal title="物流跟踪" visible={track.visible} width={770} footer={null} onCancel={() => setTrack((state) => ({ ...state, visible: false }))}>
        <div className="member-orders__track">
          {track.loading ? (
            <div className="member-orders__track-loading"><Spin /></div>
          ) : (
            <>
              <div className="member-orders__track-head">
                {track.logisticCode ? <>快递公司：【{track.shipperCode || '-'}】，快递单号：【{track.logisticCode}】</> : '暂无物流信息'}
              </div>
              {track.traces.length ? (
                <ul className="member-orders__track-list">
                  {track.traces.map((node, index) => (
                    <li key={index} className={index === 0 ? 'is-first' : ''}>
                      <i />
                      <div>
                        <span className="member-orders__track-station">{node.acceptStation || node.action || ''}</span>
                        <span className="member-orders__track-time">{node.acceptTime || ''}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="member-orders__track-loading">查无信息，请刷新后重试或者联系客服！</div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}

'use client';

/**
 * 我的订单列表（PC 会员中心）—— Semi Design 现代化版
 *
 * 功能对照（与旧版 MemberOrderList.vue 1:1，行为不删减）：
 * - 5 个 Tab + orderNum 角标；D1146 评价关闭时隐藏「待评价」，?type=awaitComment 回落全部
 * - 关键词搜索（收货人/订单号）；分页（Semi Pagination，自带省略号）
 * - 卡片：订单号+下单时间+状态 Tag / 商品行(预售·拼团角标、规格、单价×数量) / 取消原因 / 合计+操作栏
 * - 定金预售(saleMode=2)：合计区显示「总额/应付」两行
 * - 操作按钮 10 种 + availableActions 驱动 + o2o/礼品卡/周期购/自提守卫
 * - 取消订单走 reasonConfig 原因弹窗；删除/确认收货二次确认；物流/认款弹窗
 *
 * 2026-11 修复（人工排查项）：
 * - 搜索首击失效：load() 改为接受 overrides，搜索时显式传入 keyword/page（旧实现闭包捕获旧值）
 * - 分页平铺全部页码 → Semi Pagination（自带省略号）
 * - Modal/Toast 文案接 i18n
 * - <a> 内嵌 <button> 的无效 HTML → 按钮统一 router.push
 *
 * 已知后端缺口（前端守卫下自动隐藏，不报错）：
 * - Rust 订单列表 availableActions 未下发 offlinePaymentClaimDetail；VO 无 offlinePaymentClaimStatus/payTypeId 字段
 * - orderNum 无 all 字段，「全部」角标恒 0
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Empty, Input, Modal, Pagination, Skeleton, Tabs, Tag, Toast } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { apiGet, apiPost } from '@/lib/client-api';
import MemberCancelOrderDialog from '@/components/MemberCancelOrderDialog';
import MemberLogisticsDialog from '@/components/MemberLogisticsDialog';
import MemberOfflineClaimDialog from '@/components/MemberOfflineClaimDialog';

import { useTranslation } from 'react-i18next';

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
  /** 快递单号（物流弹窗头部展示） */
  trackingNo?: string;
  /** 快递公司名（物流弹窗头部展示） */
  logisticsName?: string;
  /** 配送方式：1 快递 2 自提 3 同城 */
  shippingMethod?: number;
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

/** 订单状态 → Semi Tag 颜色 */
const STATUS_TAG_COLOR: Record<number, string> = {
  0: 'orange',
  1: 'blue',
  2: 'cyan',
  3: 'grey',
  4: 'grey',
  5: 'green',
  40: 'grey',
  50: 'grey',
};

function statusTagColor(order: OrderRow): 'amber' | 'green' | 'grey' | 'red' | 'blue' | 'cyan' | 'violet' {
  return (STATUS_TAG_COLOR[Number(order.orderStatus)] || 'grey') as 'grey';
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
  const { t } = useTranslation();
  const router = useRouter();
  const go = (href: string) => router.push(href);
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

  // 取消订单原因弹窗（MemberCancelOrderDialog 对照）
  const [cancelVisible, setCancelVisible] = useState(false);
  const [cancelOrderId, setCancelOrderId] = useState(0);
  // 查看物流弹窗（MemberLogisticsDialog 对照）
  const [trackVisible, setTrackVisible] = useState(false);
  const [trackOrderId, setTrackOrderId] = useState(0);
  const [trackOrder, setTrackOrder] = useState<{ trackingNo?: string; logisticsName?: string; shippingMethod?: number }>({});
  // 线下支付认领弹窗（MemberOfflineClaimDialog 对照）
  const [claimVisible, setClaimVisible] = useState(false);
  const [claimOrderId, setClaimOrderId] = useState(0);
  const [claimEditable, setClaimEditable] = useState(false);

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

  /**
   * 拉取订单列表。
   * overrides 用于「状态尚未落到 state 就要发请求」的场景（如点击搜索：
   * setKeyword 是异步的，闭包里的 keyword 还是旧值，必须显式传入）。
   */
  const load = (overrides?: { page?: number; keyword?: string; tab?: TabKey }) => {
    const currentTab = overrides?.tab ?? tab;
    const current = TABS.find((item) => item.key === currentTab) || TABS[0];
    setLoading(true);
    apiGet<{ records?: OrderRow[]; total?: number }>('user/order/list', {
      page: overrides?.page ?? page,
      size,
      sortField: 'addTime',
      sortOrder: 'desc',
      keyword: overrides?.keyword ?? keyword,
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
      title: t('确认要收货吗'),
      okText: t('确定'),
      cancelText: t('取消'),
      onOk: async () => {
        try {
          await apiPost('user/order/confirmReceipt', { id: orderId });
          Toast.success({ content: t('确认收货成功') });
          afterAction();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('操作失败') });
        }
      },
    });
  };

  // —— 操作：删除订单（对齐原版 onDelOrder）——
  const onDelOrder = (orderId: number) => {
    Modal.confirm({
      title: t('确认要删除该订单吗'),
      okText: t('确定'),
      cancelText: t('取消'),
      onOk: async () => {
        try {
          await apiPost('user/order/delOrder', { id: orderId });
          Toast.success({ content: t('删除成功') });
          afterAction();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : t('删除失败') });
        }
      },
    });
  };

  // —— 操作：取消订单（reasonConfig 原因弹窗，未启用原因时回落确认框）——
  const onCancelOrder = (orderId: number) => {
    setCancelOrderId(orderId);
    setCancelVisible(true);
  };

  // —— 操作：再次购买（跨境：buyAgain → /order/check，对齐原版 onReBuy）——
  const onReBuy = async (order: OrderRow) => {
    try {
      await apiPost('user/order/buyAgain', { id: order.orderId });
      Toast.success({ content: t('正在跳转中，请稍后~') });
      setTimeout(() => {
        window.location.href = '/order/check';
      }, 1500);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('再次购买失败') });
    }
  };

  // —— 操作：查看物流（MemberLogisticsDialog 对照）——
  const viewLogistics = (order: OrderRow) => {
    setTrackOrderId(order.orderId);
    setTrackOrder({
      trackingNo: order.trackingNo,
      logisticsName: order.logisticsName,
      shippingMethod: order.shippingMethod,
    });
    setTrackVisible(true);
  };

  // —— 操作：线下支付认领（MemberOfflineClaimDialog 对照）——
  const openClaimDetail = (orderId: number) => {
    setClaimOrderId(orderId);
    setClaimEditable(false);
    setClaimVisible(true);
  };

  const openClaimEdit = (orderId: number) => {
    setClaimOrderId(orderId);
    setClaimEditable(true);
    setClaimVisible(true);
  };

  const visibleTabs = useMemo(() => TABS.filter((item) => item.key !== 'awaitComment' || commentEnabled === 1), [commentEnabled]);

  if (needLogin) {
    return (
      <div className="mol mol--state">
        <Empty title={t('登录后查看订单')} description={t('登录后可查看订单状态、物流和售后。')} />
        <Button theme="solid" type="primary" size="large" onClick={() => go('/login?redirect=/member/order/list')}>
          {t('去登录')}
        </Button>
      </div>
    );
  }

  return (
    <div className="mol">
      {/* 工具条：状态 Tab（带角标） + 关键词搜索 */}
      <div className="mol-toolbar">
        <Tabs
          type="button"
          activeKey={tab}
          onChange={(key) => {
            setPage(1);
            setTab(key as TabKey);
          }}
        >
          {visibleTabs.map((item) => (
            <Tabs.TabPane
              key={item.key}
              itemKey={item.key}
              tab={
                <span className="mol-tab">
                  {t(item.label)}
                  {Number(nums[item.key] || 0) > 0 ? <span className="mol-tab__num">{nums[item.key]}</span> : null}
                </span>
              }
            />
          ))}
        </Tabs>
        <Input
          className="mol-search"
          style={{ width: 280 }}
          prefix={<IconSearch />}
          placeholder={t('收货人名称或订单号')}
          value={keyword}
          showClear
          onChange={(value) => setKeyword(value)}
          onEnterPress={() => {
            setPage(1);
            load({ page: 1, keyword });
          }}
          suffix={
            <Button
              theme="borderless"
              icon={<IconSearch />}
              aria-label={t('搜索')}
              onClick={() => {
                setPage(1);
                load({ page: 1, keyword });
              }}
            />
          }
        />
      </div>

      <div className="mol-body">
        {loading ? (
          <div className="mol-skeleton">
            {[0, 1, 2].map((index) => (
              <div key={index} className="mol-skeleton__card">
                <Skeleton active loading placeholder={<Skeleton.Paragraph rows={3} style={{ padding: '16px 16px 8px' }} />} />
              </div>
            ))}
          </div>
        ) : rows.length ? (
          <>
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
                <div key={order.orderId} className="mol-card">
                  {/* 头：订单号 + 下单时间 + 状态 */}
                  <div className="mol-card__head">
                    <div className="mol-card__head-left">
                      <Link className="mol-card__sn" href={`/member/order/info?id=${order.orderId}`} target="_blank" title={order.orderSn}>
                        {order.orderSn}
                      </Link>
                      {order.addTime ? <span className="mol-card__time">{order.addTime}</span> : null}
                    </div>
                    <Tag color={statusTagColor(order)}>{order.orderStatusName}</Tag>
                  </div>

                  {/* 商品行 */}
                  <div className="mol-card__items">
                    {(order.items || []).map((item, index) => (
                      <div key={index} className="mol-item">
                        <Link title={item.productName} href={productHref(item, order.shopId)} className="mol-item__picwrap" target="_blank">
                          <img className="mol-item__pic" src={item.productPicThumb || item.picThumb || ''} alt={item.productName || ''} loading="lazy" />
                        </Link>
                        <div className="mol-item__main">
                          <Link title={item.productName} href={productHref(item, order.shopId)} className="mol-item__name" target="_blank">
                            {Number(order.isPresale) === 1 || order.isPresale === true ? <Tag size="small" color="orange" className="mol-item__tag">{t('预售')}</Tag> : null}
                            {Number(order.joinStatus) === 1 ? <Tag size="small" color="red" className="mol-item__tag">{t('拼团')}</Tag> : null}
                            <span className="mol-item__name-text">{item.productName}</span>
                          </Link>
                          {skuText(item.skuData) ? <div className="mol-item__sku">{skuText(item.skuData)}</div> : null}
                        </div>
                        <div className="mol-item__right">
                          {isDepositPresaleOrder(order) && index === 0 ? null : (
                            <>
                              <Link title={item.productName} href={productHref(item)} target="_blank">
                                <span className="mol-item__price">¥{money(item.price)}</span>
                              </Link>
                              <Link title={item.productName} href={productHref(item)} target="_blank">
                                <span className="mol-item__qty">×{item.quantity}</span>
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 取消原因 */}
                  {String(order.cancelRemark ?? '').trim() ? (
                    <div className="mol-card__note">
                      {t('取消原因')}：{order.cancelRemark}
                    </div>
                  ) : null}

                  {/* 底：合计 + 操作 */}
                  <div className="mol-card__foot">
                    <div className="mol-card__total">
                      {isDepositPresaleOrder(order) ? (
                        <div className="mol-presale">
                          <div className="mol-presale__row">
                            <span>{t('总额')}</span>
                            <b>¥{money(order.totalAmount)}</b>
                          </div>
                          <div className="mol-presale__row mol-presale__row--due">
                            <span>{t('应付')}</span>
                            <b>¥{money(order.unpaidAmount)}</b>
                          </div>
                        </div>
                      ) : (
                        <>
                          <span className="mol-card__count">{t('共{{count}}件', { count: totalCount })}</span>
                          <span className="mol-card__sum">
                            {t('合计')}：<b>¥{money(order.totalAmount)}</b>
                          </span>
                        </>
                      )}
                    </div>
                    <div className="mol-card__actions">
                      <Button theme="borderless" onClick={() => go(`/member/order/info?id=${order.orderId}`)}>{t('订单详情')}</Button>
                      {actions.confirmReceipt && !isCardSecretOrder(order) ? (
                        <Button theme="borderless" onClick={() => viewLogistics(order)}>{t('查看物流')}</Button>
                      ) : null}
                      {canShowToPay(order) ? (
                        Number(order.offlinePaymentClaimStatus) === 2 ? (
                          <Button theme="solid" type="primary" onClick={() => openClaimEdit(order.orderId)}>{t('修改申请')}</Button>
                        ) : (
                          <Button theme="solid" type="primary" onClick={() => go(`/order/pay?id=${order.orderId}`)}>{t('去支付')}</Button>
                        )
                      ) : null}
                      {Boolean(actions.offlinePaymentClaimDetail) && Number(order.offlinePaymentClaimStatus) !== 2 ? (
                        <Button theme="light" onClick={() => openClaimDetail(order.orderId)}>{t('认款详情')}</Button>
                      ) : null}
                      {actions.cancelOrder ? (
                        <Button theme="light" onClick={() => onCancelOrder(order.orderId)}>{t('取消订单')}</Button>
                      ) : null}
                      {actions.delOrder ? (
                        <Button theme="light" type="danger" onClick={() => onDelOrder(order.orderId)}>{t('删除订单')}</Button>
                      ) : null}
                      {actions.confirmReceipt && Number(order.orderType) !== 9 && Number(order.orderType) !== 10 ? (
                        <Button theme="solid" type="primary" onClick={() => onConfirmReceipt(order.orderId)}>{t('确认收货')}</Button>
                      ) : null}
                      {canAftersales ? (
                        <Button theme="light" onClick={() => go(`/member/return/info?orderId=${order.orderId}`)}>{t('申请售后')}</Button>
                      ) : null}
                      {order.items && order.items[0]?.aftersalesItem && !isGiftCardAftersalesBlocked(order) && !isOrderType14(order) && !isCycleInfo(order) ? (
                        <Button theme="borderless" onClick={() => go(`/member/return/loginfo?id=${aftersalesItem?.aftersaleId || ''}`)}>{t('售后详情')}</Button>
                      ) : null}
                      {actions.rebuy && !isSubCardOrder(order) ? (
                        <Button theme="solid" type="primary" onClick={() => void onReBuy(order)}>{t('再次购买')}</Button>
                      ) : null}
                      {actions.toComment && commentEnabled === 1 ? (
                        <Button theme="light" onClick={() => go(`/member/comment/info?id=${order.orderId}`)}>{t('去评价')}</Button>
                      ) : null}
                      {Number(order.joinStatus) === 1 && order.grouponPromotionRecordId ? (
                        <Button theme="light" onClick={() => go(`/member/group/info?id=${order.grouponPromotionRecordId}`)}>{t('拼团详情')}</Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </>
        ) : (
          <div className="mol mol--state">
            <Empty title={t('当前筛选下还没有任何订单')} description={t('去看看有什么心仪的商品吧')} />
            <Button theme="solid" type="primary" onClick={() => go('/')}>{t('去选购')}</Button>
          </div>
        )}
      </div>

      {total > size ? (
        <div className="mol-pager">
          <Pagination total={total} pageSize={size} currentPage={page} onPageChange={(next) => setPage(next)} />
        </div>
      ) : null}

      {/* 取消订单原因弹窗（CancelOrderReasonDialog 对照） */}
      <MemberCancelOrderDialog
        visible={cancelVisible}
        orderId={cancelOrderId}
        onClose={() => setCancelVisible(false)}
        onSuccess={afterAction}
      />

      {/* 查看物流弹窗（LogisticsTracking 对照） */}
      <MemberLogisticsDialog
        visible={trackVisible}
        orderId={trackOrderId}
        trackingNo={trackOrder.trackingNo}
        logisticsName={trackOrder.logisticsName}
        shippingMethod={trackOrder.shippingMethod}
        onClose={() => setTrackVisible(false)}
      />

      {/* 线下支付认领弹窗（OfflinePaymentClaimDetail 对照） */}
      <MemberOfflineClaimDialog
        visible={claimVisible}
        orderId={claimOrderId}
        editable={claimEditable}
        onClose={() => setClaimVisible(false)}
        onSubmitted={afterAction}
      />
    </div>
  );
}

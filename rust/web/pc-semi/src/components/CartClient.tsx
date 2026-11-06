'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Checkbox, Modal, Toast } from '@douyinfe/semi-ui';
import ProductCard, { type ProductCardItem } from '@/components/product/ProductCard';
import { useProductColumns } from '@/components/product/use-product-columns';
import '@/components/product/product-card.scss';

/**
 * 购物车 —— 结构沿用 java-b2b2c-overseas-v5.8.61/view/pc/pages/cart/index.vue，
 *            视觉层为 Semi Design 现代主题。
 *
 * 结构原则（保证数据/交互与旧站一一对应）：
 * - DOM 层级与类名和原版 template 一致（cart-title / cart-left-col / cart-head /
 *   cart_table / product-list-cart / product-item / gift-box / table-bar-total /
 *   cart_total / pay_tools_bar / settle-* / mod_you_like）。
 * - 数量步进器复刻 pages/cart/src/InputNumber.vue（数量为 1 时减号变删除图标）。
 * - 价格复刻 components/format/Price.vue（.price > .util + .num + .num.decimal）。
 * - 业务逻辑（勾选同步 / 数量更新 / 删除 / 清空 / 移入收藏 / 结算前校验）与原版一致。
 *
 * 视觉原则：
 * - 样式全部在 app/cart-modern.scss，按 Semi Design 令牌重新设计
 *   （主色 #0064FA、四级灰阶、1px 描边、卡片 16 圆角、统一 .2s 过渡）。
 * - 原版把站点旧主题色 #e1251b 硬编码在 scoped less 里（价格、结算按钮、优惠标签），
 *   这里改为 CSS 变量 --cart-*，颜色只在一处定义。
 * - 原版商品行是固定列宽（col-4 379px），宽屏会留大片空白，这里改为商品信息弹性、
 *   价格列定宽右对齐。
 */

interface CartSku {
  isEnabled?: number | null;
}

interface ExtraSkuAttr {
  attrName?: string;
  attrValue?: string;
  attrPrice?: string | number;
}

interface GiftItem {
  giftId?: number;
  productId?: number;
  productName?: string;
  productSn?: string;
  seoLink?: string;
  picUrl?: string;
  picThumb?: string;
  skuData?: Array<{ name?: string; value?: string }>;
  num?: number;
}

interface CartItem {
  cartId: number;
  productId?: number;
  productName?: string;
  picThumb?: string;
  price?: string;
  productPrice?: string;
  quantity?: number;
  isChecked?: boolean;
  isDisabled?: boolean;
  skuData?: Array<{ name?: string; value?: string }>;
  /** 原版 extraSkuData：组合规格附加项 */
  extraSkuData?: ExtraSkuAttr[];
  /** 原版限购数量（0/空表示不限购） */
  limitNumber?: number;
  stock?: number;
  productStatus?: number;
  saleStatus?: number | string;
  effectiveSaleStatus?: number | string;
  sku?: CartSku;
  gift?: GiftItem[];
  activityInfo?: any;
  /** 原版 skuStatus：规格停用标记 */
  skuStatus?: number;
  /** 原版 usedPromotions：已使用促销，用于过滤活动标签 */
  usedPromotions?: any;
}

interface CartGroup {
  shopId?: number;
  shopTitle?: string;
  isChecked?: boolean;
  carts: CartItem[];
  gift?: GiftItem[];
}

interface Total {
  totalCount?: number;
  checkedCount?: number;
  productAmount?: number;
  discounts?: number;
  discountAfter?: number;
  serviceFee?: number;
  discountDiscountAmount?: number;
  discountCouponAmount?: number;
}

interface CartResult {
  cartList: CartGroup[];
  total: Total;
}

/* ------------------------------------------------------------------
 * 原版 activityTextMap：活动类型 -> 文案
 * ------------------------------------------------------------------ */
const ACTIVITY_TEXT: Record<number, string> = {
  1: '秒杀价',
  2: '券',
  3: '满减',
  4: '折扣',
  5: '满赠',
  6: '限时折扣',
  7: '拼团',
};

/** 原版 formatActivityList：非券取第一条；券优先取已使用的，否则取第一条。 */
function formatActivities(list: unknown, usedPromotions?: unknown): Array<{ type: number; text: string }> {
  const source = Array.isArray(list) ? list : [];
  const used = Array.isArray(usedPromotions) ? usedPromotions : [];
  const usedIds = new Set(
    used.map((item: any) => String(item?.promotionId ?? item?.id ?? '')).filter(Boolean),
  );
  const output: Array<{ type: number; text: string }> = [];
  source.forEach((item: any) => {
    const type = Number(item?.type ?? item?.promotionType ?? 0);
    const promotionId = String(item?.promotionId ?? item?.id ?? '');
    if (promotionId && usedIds.has(promotionId)) return;
    if (type === 2) {
      output.push({ type, text: String(item?.data?.promotionDesc || item?.promotionDesc || item?.name || '') });
      return;
    }
    const text = ACTIVITY_TEXT[type] || String(item?.name || item?.title || '');
    if (text) output.push({ type, text });
  });
  return output;
}

/** 原版 getDiscount：折扣百分比（向下取一位小数）。 */
function getDiscount(currentPrice: number, originalPrice: number): number {
  if (originalPrice === 0 || currentPrice >= originalPrice) return 0;
  const discountPercentage = ((originalPrice - currentPrice) / originalPrice) * 100;
  return Math.floor(discountPercentage * 10) / 10;
}

/** 原版 settleFoldLimit：结算缩略图折叠阈值 */
const SETTLE_FOLD_LIMIT = 8;

/** 原版 splitPriceParts：整数位 + 两位小数（含前导点） */
function splitPrice(value: unknown): { integer: string; decimals: string } {
  const raw = value === null || value === undefined ? '' : String(value);
  if (!raw) return { integer: '0', decimals: '.00' };
  if (!/^(\d+)(\.\d+)?$/.test(raw)) return { integer: '0', decimals: '.00' };
  const [integer, decimals] = Number(raw).toFixed(2).split('.');
  return { integer, decimals: `.${decimals}` };
}

/**
 * 复刻 components/format/Price.vue（FormatPrice）
 * 结构：<div class="price align-bottom"><div class="util">￥</div><div class="num">1</div><div class="num decimal">.00</div></div>
 */
function Price({
  value,
  currencyStyle,
  fontStyle,
}: {
  value: unknown;
  currencyStyle?: React.CSSProperties;
  fontStyle?: React.CSSProperties;
}) {
  const { integer, decimals } = splitPrice(value);
  const hasCurrencyStyle = currencyStyle && Object.keys(currencyStyle).length > 0;
  return (
    <div className="price align-bottom">
      <div className="util align-bottom" style={hasCurrencyStyle ? currencyStyle : fontStyle}>
        ￥
      </div>
      <div className="num" style={fontStyle}>
        {integer}
      </div>
      {decimals ? (
        <div className="num decimal" style={fontStyle}>
          {decimals}
        </div>
      ) : null}
    </div>
  );
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : '';
  const response = await fetch(`/api/${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
    ...options,
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : {};
  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || json.message || `请求失败（${response.status}）`);
  }
  return (json.data ?? json) as T;
}

/** 原版 isSaleProhibited：禁售/失效销售状态。 */
function isSaleProhibited(item: CartItem): boolean {
  return Number(item.saleStatus ?? item.effectiveSaleStatus ?? 1) === 0;
}

/** 原版 isProductUnavailable：禁售或商品下架。 */
function isProductUnavailable(item: CartItem): boolean {
  return isSaleProhibited(item) || Number(item.productStatus ?? 1) === 0;
}

/** 原版 isDisabledData：不可用 / 售罄 / 规格停用 / 后端禁用。 */
function isDisabledData(item: CartItem): boolean {
  return isProductUnavailable(item) || Number(item.stock ?? 1) <= 0 || item.isDisabled === true || item.sku?.isEnabled === 0;
}

/** 原版 isSkuDisabledData / isOffShelfDisabledData */
function isSkuDisabledData(item: CartItem): boolean {
  return item.sku?.isEnabled === 0;
}
function isOffShelfDisabledData(item: CartItem): boolean {
  return isProductUnavailable(item);
}

/** 原版 applyCartSaleState：不可用项置禁用并取消勾选。 */
function applySaleState(result: CartResult): CartResult {
  const groups = (result.cartList || []).map((group) => ({
    ...group,
    carts: (group.carts || []).map((item) =>
      isDisabledData(item) ? { ...item, isDisabled: true, isChecked: false } : item,
    ),
  }));
  return { cartList: groups, total: result.total || {} };
}

function cartQuantityMax(item: CartItem): number {
  const stock = Number(item.stock ?? 0);
  const limit = Number(item.limitNumber ?? 0);
  const candidates = [stock > 0 ? stock : Number.POSITIVE_INFINITY, limit > 0 ? limit : Number.POSITIVE_INFINITY];
  const max = Math.min(...candidates);
  return Number.isFinite(max) ? Math.max(1, max) : 9999;
}

/** 原版 ProdSwiper.vue 的 PAGE_SIZE：固定每页数量以保证 page 分页稳定 */
const RECOMMEND_PAGE_SIZE = 12;

function productLink(item: { productId?: number }) {
  return `/product/${item.productId || ''}`;
}

/* ------------------------------------------------------------------
 * 复刻 pages/cart/src/InputNumber.vue：数量为 1 时减号变删除图标
 * ------------------------------------------------------------------ */
function CartNum({
  value,
  max,
  limitNumber,
  disabled,
  onChange,
  onRemove,
}: {
  value: number;
  max: number;
  limitNumber?: number;
  disabled?: boolean;
  onChange: (next: number) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(String(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(String(value));
  }, [value]);

  const step = (type: 'min' | 'add') => {
    if (disabled) return;
    if (type === 'min' && value > 1) {
      onChange(value - 1);
      return;
    }
    if (type === 'add') {
      if (limitNumber && value >= limitNumber) {
        onChange(limitNumber);
        Toast.error({ content: `限购${limitNumber}件，已达限购数` });
        return;
      }
      if (max && value >= max) {
        onChange(max);
        Toast.error({ content: '库存不足' });
        return;
      }
      onChange(value + 1);
    }
  };

  const commit = (raw: string) => {
    let num = raw.trim();
    if (!num) {
      num = '1';
    } else {
      num = String(parseInt(num, 10));
      if (Number.isNaN(Number(num)) || Number(num) < 1) num = '1';
    }
    setDraft(num);
    onChange(Number(num));
  };

  return (
    <div className={`cart-num-box flex${disabled ? ' disabled-box' : ''}`}>
      {value > 1 ? (
        <span className={`min${value <= 1 ? ' disabled' : ''}`} onClick={() => step('min')} />
      ) : (
        <span className="delete" onClick={onRemove} />
      )}
      <input
        type="text"
        value={draft}
        disabled={disabled}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(event) => {
          const next = event.target.value.replace(/\D/g, '');
          if (limitNumber && parseInt(next || '0', 10) > limitNumber) {
            setDraft(String(limitNumber));
            Toast.error({ content: `限购${limitNumber}件，已达限购数` });
            return;
          }
          if (max && parseInt(next || '0', 10) > max) {
            setDraft(String(max));
            Toast.error({ content: '库存不足' });
            return;
          }
          setDraft(next);
        }}
        onBlur={(event) => {
          focused.current = false;
          commit(event.target.value);
        }}
      />
      <span className={`plus${value >= max ? ' disabled' : ''}`} onClick={() => step('add')} />
    </div>
  );
}

export default function CartClient() {
  const [groups, setGroups] = useState<CartGroup[]>([]);
  const [total, setTotal] = useState<Total>({});
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  /**
   * 精选好物（原版 ProdSwiper.vue）：推荐 ID 只取一次，商品按 12/页滚动加载。
   * 未到尽头时只渲染整行，余数留到下一页补满，避免末行残缺 —— 与原版 displayList 同口径。
   */
  const [recommended, setRecommended] = useState<ProductCardItem[]>([]);
  const [recommendTotal, setRecommendTotal] = useState(0);
  const [recommendLoading, setRecommendLoading] = useState(true);
  const [recommendNoMore, setRecommendNoMore] = useState(false);
  const recommendPageRef = useRef(1);
  const recommendIdsRef = useRef('');
  const recommendGridRef = useRef<HTMLDivElement | null>(null);
  const recommendSentinelRef = useRef<HTMLDivElement | null>(null);
  const recommendGenerationRef = useRef(0);
  /** 复刻原版 useResponsiveGridColumns({ minCardWidth: 240, gap: 16, minColumns: 5, maxColumns: 6 }) */
  const recommendColumns = useProductColumns(recommendGridRef);
  /** 原版 showAllProducts：结算缩略图展开 */
  const [showAllGoods, setShowAllGoods] = useState(false);
  /** 原版 isSettleExpanded：小屏优惠明细展开 */
  const [settleExpanded, setSettleExpanded] = useState(false);
  /** 原版 isFixed（源码中恒为 false，保留位） */
  const [isFixed] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await request<CartResult>('cart/cart/list');
      const normalized = applySaleState({ cartList: result.cartList || [], total: result.total || {} });
      setGroups(normalized.cartList);
      setTotal(normalized.total);
      setNeedLogin(false);
      return normalized.cartList;
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setNeedLogin(message.includes('登录') || message.includes('401'));
      setGroups([]);
      return null;
    } finally {
      setLoading(false);
    }
  };

  /** 原版 ProdSwiper：推荐 ID 只取一次，商品按页取 */
  const loadRecommend = useCallback(async (page: number, reset = false) => {
    const generation = ++recommendGenerationRef.current;
    setRecommendLoading(true);
    try {
      let ids = recommendIdsRef.current;
      if (!ids) {
        const idsResult = await request<string | number[]>('common/recommend/getProductIds');
        ids = Array.isArray(idsResult) ? idsResult.join(',') : String(idsResult || '');
        recommendIdsRef.current = ids;
      }
      if (!ids) {
        if (generation === recommendGenerationRef.current) setRecommendNoMore(true);
        return;
      }
      const list = await request<{ records?: ProductCardItem[]; total?: number }>(
        `product/product/list?page=${page}&size=${RECOMMEND_PAGE_SIZE}&ids=${encodeURIComponent(ids)}`,
      );
      if (generation !== recommendGenerationRef.current) return;
      const records = list.records || [];
      setRecommendTotal(Number(list.total || 0));
      setRecommended((prev) => (reset ? records : [...prev, ...records]));
      if (records.length < RECOMMEND_PAGE_SIZE) setRecommendNoMore(true);
    } catch {
      /* 推荐位失败不影响购物车主流程 */
    } finally {
      if (generation === recommendGenerationRef.current) setRecommendLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecommend(1, true);
  }, [loadRecommend]);

  /** 已到数据尽头：接口返回不足一页，或已取满 total（原版 reachedEnd） */
  const recommendReachedEnd =
    recommendNoMore || (recommendTotal > 0 && recommended.length >= recommendTotal);

  /**
   * 未到尽头时只渲染能铺满整行的部分，余数留到下一页补满再显示（原版 displayList）。
   */
  const recommendDisplay = useMemo(() => {
    if (recommendReachedEnd) return recommended;
    const full = Math.floor(recommended.length / recommendColumns) * recommendColumns;
    return recommended.slice(0, full);
  }, [recommended, recommendColumns, recommendReachedEnd]);

  /** 原版 window scroll 触底加载，这里用 IntersectionObserver（与原版等价、更稳） */
  useEffect(() => {
    const node = recommendSentinelRef.current;
    if (!node || recommendReachedEnd || recommendLoading) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        recommendPageRef.current += 1;
        void loadRecommend(recommendPageRef.current);
      },
      { rootMargin: '240px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [recommendReachedEnd, recommendLoading, loadRecommend]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !localStorage.getItem('accessToken')) {
      window.location.replace(`/login?redirect=${encodeURIComponent('/cart')}`);
      return;
    }
    void load();
  }, []);

  useEffect(() => {
    if (!needLogin) return;
    window.location.replace(`/login?redirect=${encodeURIComponent('/cart')}`);
  }, [needLogin]);

  /** 原版 checkedProducts / cartProducts */
  const checkedItems = useMemo(
    () => groups.flatMap((group) => (group.carts || []).filter((item) => item.isChecked && !isDisabledData(item))),
    [groups],
  );
  const checkedCount = Number(
    total.checkedCount ?? checkedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0),
  );
  const productAmount = checkedItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const allChecked =
    groups.length > 0 &&
    groups.every((group) => {
      const available = (group.carts || []).filter((item) => !isDisabledData(item));
      return available.length > 0 && available.every((item) => item.isChecked);
    });

  /** 原版 updateCheckData：提交全部商品的勾选态（不可用项恒为 0）。 */
  const syncCheck = async (nextGroups: CartGroup[]) => {
    setGroups(nextGroups);
    const data = nextGroups.flatMap((group) =>
      (group.carts || []).map((item) => ({ cartId: item.cartId, isChecked: item.isChecked && !isDisabledData(item) ? 1 : 0 })),
    );
    await request('cart/cart/updateCheck', { method: 'POST', body: JSON.stringify({ data }) }).catch(() => undefined);
    await load();
  };

  const toggleAll = async (checked: boolean) => {
    await syncCheck(
      groups.map((group) => ({
        ...group,
        isChecked: checked,
        carts: (group.carts || []).map((item) => ({ ...item, isChecked: checked && !isDisabledData(item) })),
      })),
    );
  };

  /** 原版 onCheckAllItem */
  const toggleGroup = async (index: number, checked: boolean) => {
    const next = groups.map((group, groupIndex) =>
      groupIndex === index
        ? {
            ...group,
            isChecked: checked,
            carts: (group.carts || []).map((item) => ({ ...item, isChecked: checked && !isDisabledData(item) })),
          }
        : group,
    );
    await syncCheck(next);
  };

  const toggleItem = async (index: number, cartId: number, checked: boolean) => {
    const next = groups.map((group, groupIndex) =>
      groupIndex === index
        ? { ...group, carts: (group.carts || []).map((item) => (item.cartId === cartId ? { ...item, isChecked: checked } : item)) }
        : group,
    );
    await syncCheck(next);
  };

  /** 原版 onUncheckSettleProduct：结算缩略图上取消选择 */
  const toggleItemChecked = async (cartId: number) => {
    const index = groups.findIndex((group) => (group.carts || []).some((item) => item.cartId === cartId));
    if (index < 0) return;
    await toggleItem(index, cartId, false);
  };

  /** 原版 handleUpdateCartItem + 300ms 防抖 */
  const changeQuantity = async (item: CartItem, quantity: number) => {
    if (updating) return;
    const next = Math.floor(Number(quantity) || 1);
    if (next < 1) return;
    setUpdating(true);
    try {
      await request('cart/cart/updateItem', {
        method: 'POST',
        body: JSON.stringify({ cartId: item.cartId, data: { quantity: next } }),
      });
      await load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '修改数量失败' });
    } finally {
      setUpdating(false);
    }
  };

  /** 原版 removeCartItem：删除单个商品 */
  const remove = (cartIds: number | number[], title = '确认要删除该商品吗') => {
    const ids = Array.isArray(cartIds) ? cartIds : [cartIds];
    Modal.confirm({
      title,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await request('cart/cart/removeItem', { method: 'POST', body: JSON.stringify({ cartIds: ids }) });
          await load();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
        }
      },
    });
  };

  /** 原版 removeCheckedCartItem */
  const removeChecked = () => {
    if (!checkedItems.length) {
      Toast.warning({ content: '请至少选择一个宝贝' });
      return;
    }
    remove(checkedItems.map((item) => item.cartId), '确认要删除指定的商品吗');
  };

  /** 原版 collectCheckedCartItem：已选商品逐个收藏后从购物车移除 */
  const collectChecked = () => {
    if (!checkedItems.length) {
      Toast.warning({ content: '请至少选择一个宝贝' });
      return;
    }
    Modal.confirm({
      title: '确认将选中的商品移入收藏吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await Promise.allSettled(
            checkedItems.map((item) =>
              request('user/collectProduct/save', { method: 'POST', body: JSON.stringify({ productId: item.productId }) }),
            ),
          );
          await request('cart/cart/removeItem', {
            method: 'POST',
            body: JSON.stringify({ cartIds: checkedItems.map((item) => item.cartId) }),
          });
          await load();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '移入收藏失败' });
        }
      },
    });
  };

  /** 原版 onClearCart */
  const clearCart = () => {
    Modal.confirm({
      title: '确认要清空购物车吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await request('cart/cart/clear', { method: 'POST' });
          await load();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '清空购物车失败' });
        }
      },
    });
  };

  /** 原版 refreshSaleBeforeCheckout：结算前拉最新购物车，已选商品下架则排除 */
  const refreshSaleBeforeCheckout = async (): Promise<number[] | null> => {
    const selectedIds = new Set(checkedItems.map((item) => item.cartId));
    try {
      const fresh = await request<CartResult>('cart/cart/list');
      const normalized = applySaleState({ cartList: fresh.cartList || [], total: fresh.total || {} });
      const lines = normalized.cartList.flatMap((group) => group.carts || []);
      const blocked = lines.some((line) => selectedIds.has(line.cartId) && isProductUnavailable(line));
      if (blocked) {
        const data = lines.map((line) => ({
          cartId: line.cartId,
          isChecked: line.isChecked && !isProductUnavailable(line) ? 1 : 0,
        }));
        await request('cart/cart/updateCheck', { method: 'POST', body: JSON.stringify({ data }) }).catch(() => undefined);
        Toast.error({ content: '商品已下架' });
        await load();
        return null;
      }
      setGroups(normalized.cartList);
      setTotal(normalized.total);
      const ids = lines.filter((line) => line.isChecked && !isProductUnavailable(line)).map((line) => line.cartId);
      return ids.length ? ids : null;
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '结算校验失败' });
      return null;
    }
  };

  const checkout = async () => {
    if (!checkedItems.length || checkingOut) return;
    setCheckingOut(true);
    try {
      const ids = await refreshSaleBeforeCheckout();
      if (!ids) {
        Toast.warning({ content: '请选择要结算的商品' });
        return;
      }
      window.location.href = `/order/check?cartIds=${ids.join(',')}`;
    } finally {
      setCheckingOut(false);
    }
  };

  /* 原版 loading 态：600px 占位 */
  if (loading || needLogin) {
    return (
      <div className="cart">
        <div style={{ height: 600, width: '100%' }} />
      </div>
    );
  }

  const cartEmpty = groups.length === 0;

  return (
    <div className="cart">
      <div className="cart-title">
        {cartEmpty ? (
          /* 原版 r_wheit / no_goods 空态（含 shop 图标） */
          <div className="r_wheit justify-center">
            <div className="no_goods">
              <div className="flex">
                <img className="icon" src="/assets/images/common/empty-box.svg" alt="" width={50} height={50} />
                <div className="strong">还没有商品？</div>
              </div>
              <div className="left main">
                <Link href="/">
                  <button type="button" className="go_buy" title="马上挑选商品">
                    去购物
                  </button>
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="cart-left-col">
            {/* 列表头部：标题 + 件数 + 全选 + 批量操作 */}
            <div className="cart-head">
              <div className="cartHeadTitle">
                购物车
                <span className="cartHeadTitle-count">共 {total.totalCount ?? 0} 件商品</span>
              </div>
              <div className="product-list-cart flex">
                <div className="item col-1 center">
                  <Checkbox
                    className="block-checkbox"
                    checked={allChecked}
                    onChange={(event) => void toggleAll(Boolean(event.target.checked))}
                  />
                </div>
                <div className="item allItem">全选</div>
                <div className="cart-batch-actions flex align-center">
                  <div className="batch-btn" onClick={() => void collectChecked()}>
                    移入收藏
                  </div>
                  <div className="batch-btn" onClick={() => void removeChecked()}>
                    删除
                  </div>
                </div>
              </div>
            </div>

            {groups.map((group, groupIndex) => {
              const groupAvailable = (group.carts || []).filter((item) => !isDisabledData(item));
              return (
                <div className="cart_table" key={group.shopId ?? groupIndex}>
                  {/* 店铺行 */}
                  <div className="cart_store_title flex">
                    <div className="item col-1 height-1 center">
                      <Checkbox
                        className="block-checkbox"
                        checked={groupAvailable.length > 0 && groupAvailable.every((item) => item.isChecked)}
                        disabled={groupAvailable.length === 0}
                        onChange={(event) => void toggleGroup(groupIndex, Boolean(event.target.checked))}
                      />
                    </div>
                    <div className="item flex align-center">
                      <div className="tit">
                        {Number(group.shopId ?? 0) === 0 ? '官方自营' : group.shopTitle || ''}
                      </div>
                    </div>
                  </div>

                  <div className="cart_list_wrap">
                    {(group.carts || []).map((product) => {
                      const disabled = isDisabledData(product);
                      const unavailable = isProductUnavailable(product);
                      const skuDisabled = isSkuDisabledData(product);
                      const offShelf = isOffShelfDisabledData(product);
                      const soldOut = Number(product.stock ?? 1) <= 0;
                      const max = cartQuantityMax(product);
                      const currentPrice = Number(product.price || 0);
                      const originPrice = Number(product.productPrice || 0);
                      return (
                        <div className={`product-list-cart${disabled ? ' disabled-item' : ''}`} key={product.cartId}>
                          <div className="product-item flex">
                            <div className="item col-1 height-1 center flex align-center justify-center">
                              <Checkbox
                                className="block-checkbox"
                                checked={Boolean(product.isChecked)}
                                disabled={disabled}
                                onChange={(event) => void toggleItem(groupIndex, product.cartId, Boolean(event.target.checked))}
                              />
                            </div>

                            <div className={`item col-4 flex${unavailable ? ' cart-invalid-product-item' : ''}`}>
                              <div className="pic">
                                {unavailable ? (
                                  <div>
                                    <img src={product.picThumb || ''} alt={product.productName || ''} />
                                  </div>
                                ) : (
                                  <Link href={productLink(product)} target="_blank">
                                    <img src={product.picThumb || ''} alt={product.productName || ''} />
                                  </Link>
                                )}
                                {unavailable || soldOut ? (
                                  <div className="disabled">
                                    {unavailable ? <div>已下架</div> : soldOut ? <div>已售罄</div> : null}
                                  </div>
                                ) : null}
                              </div>

                              <div className="name pt5">
                                {unavailable ? (
                                  <p>{product.productName}</p>
                                ) : (
                                  <Link className="name_pctyle" href={productLink(product)} target="_blank">
                                    {product.productName}
                                  </Link>
                                )}

                                <div className="info">
                                  {(product.skuData || []).map((sku, index) => (
                                    <span key={index}>
                                      {index !== 0 ? ' , ' : ''}
                                      {sku.name}:{sku.value}
                                    </span>
                                  ))}
                                </div>

                                {product.extraSkuData && product.extraSkuData.length ? (
                                  <div className="extraskudata">
                                    {product.extraSkuData.map((attr, index) => (
                                      <div className="extraskudata-item" key={index}>
                                        <div className="title">{attr.attrName}</div>
                                        <div className="line-box">
                                          <div className="line" />
                                        </div>
                                        <div className="content">
                                          <span className="content-text">{attr.attrValue}</span>
                                          <Price value={attr.attrPrice} />
                                          <span className="num">x{product.quantity}</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                {product.activityInfo && !skuDisabled && !offShelf ? (
                                  <div className="promotion-box">
                                    {formatActivities(product.activityInfo, product.usedPromotions).map((activity, index) => (
                                      <div className="promotion-box-item" key={index}>
                                        {activity.type !== 2 ? (
                                          <div className="promotion">
                                            <div className="ticket-content">{ACTIVITY_TEXT[activity.type] || ''}</div>
                                          </div>
                                        ) : (
                                          <div className="promotion">
                                            <div className="ticket-type">
                                              券<span className="ticket-line" />
                                            </div>
                                            <div className="ticket-content">{activity.text}</div>
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}

                                <div className={`item col-2${skuDisabled || offShelf ? ' cart-invalid-item' : ''}`}>
                                  <div className="pt5 flex margin-top">
                                    {!skuDisabled && !offShelf ? (
                                      <CartNum
                                        value={Number(product.quantity || 1)}
                                        max={max}
                                        limitNumber={Number(product.limitNumber ?? 0) || undefined}
                                        disabled={disabled || updating}
                                        onChange={(next) => void changeQuantity(product, next)}
                                        onRemove={() => remove(product.cartId)}
                                      />
                                    ) : null}
                                    {skuDisabled ? <span className="cart-invalid-text">请重新选择规格</span> : null}
                                    {!skuDisabled && offShelf ? <span className="cart-invalid-text">商品已下架</span> : null}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* 价格列：折后价 + 划线原价 + 优惠比例 */}
                            <div className="item col-2 center item-price">
                              {!skuDisabled && !offShelf ? (
                                <div className="flex-f">
                                  <div className="money pt5 priceFormOurty discount-price">
                                    <Price value={product.price} />
                                  </div>
                                  <div className="money pt5 priceFormQurty orgin-price">
                                    <Price value={originPrice} />
                                    <div className="discount-txt">优惠{getDiscount(currentPrice, originPrice)}%</div>
                                  </div>
                                </div>
                              ) : (
                                <span className="cart-invalid-text">暂不支持购买</span>
                              )}
                            </div>
                          </div>
                          <div className="cart-line" />
                        </div>
                      );
                    })}
                  </div>

                  {/* 原版 gift-box：店铺级赠品 */}
                  {group.gift && group.gift.length > 0 ? (
                    <div className="gift-box">
                      <div className="gift-title">赠品</div>
                      <div className="gift-content">
                        {group.gift.map((gift) => (
                          <Link
                            key={gift.giftId}
                            target="_blank"
                            href={`/product/${gift.productId || ''}`}
                            style={{ textDecoration: 'none' }}
                          >
                            <div className="gift-content-item">
                              <div className="gift-item-left">
                                <img src={gift.picThumb || gift.picUrl || ''} alt={gift.productName || ''} />
                              </div>
                              <div className="gift-item-right">
                                <div className="gift-item-name">{gift.productName}</div>
                                {gift.skuData && gift.skuData.length > 0 ? (
                                  <div className="sku-card">
                                    {gift.skuData.map((sku, index) => (
                                      <div className="sku-item" key={index}>
                                        {sku.value}
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                <div className="gift-item-num">x{gift.num}</div>
                              </div>
                            </div>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

            {/* 原版 table-bar-total：全选 / 共 N 件 / 清空购物车 */}
            <div className="table-bar-total">
              <div className="table-bar-total_l flex align-center">
                <div className="item col-1 height-1 center flex align-center justify-center">
                  <Checkbox
                    className="block-checkbox"
                    checked={allChecked}
                    onChange={(event) => void toggleAll(Boolean(event.target.checked))}
                  />
                </div>
                <div className="pay_txt_row flex">
                  <span className="all">全选</span>
                  <div className="flex total-num">
                    <span>共</span>
                    <span className="font-color font-num">{total.totalCount ?? 0}</span>
                    <span>件</span>
                  </div>
                  <div>
                    <a onClick={() => void clearCart()}>清空购物车</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 原版 cart_total：结算栏（宽屏 sticky 358，<=1400 右下角固定浮层） */}
        <div className="cart_total">
          <div className={`pay_tools_bar${isFixed ? ' tools_bar_bottom' : ''}`}>
            <div className="pay_tools_inner">
              <div className="pay_tools_r">
                <div className={`pay_tools_total_box${settleExpanded ? ' is-expanded' : ''}`}>
                  {/* 1. 标题 */}
                  <div className="settle-header-container">
                    <div className="settle-head flex justify-between align-center">
                      <span className="settle-title">结算明细</span>
                      <span className="settle-sub">实际优惠金额以下单页为准</span>
                    </div>
                  </div>

                  {/* 2. 明细（可滚动） */}
                  <div className="settle-panel-container">
                    {checkedCount === 0 ? (
                      <div className="pay_tools_r flex justify-center" style={{ padding: '40px 0' }}>
                        <div className="no_goods">
                          <div className="flex">
                            <img className="icon" src="/assets/images/common/empty-box.svg" alt="" width={50} height={50} />
                            <div className="strong">没有待结算的商品</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <div className="settle-goods-wrapper">
                            <div className={`settle-goods${showAllGoods ? '' : ' is-fold'}`}>
                              {checkedItems.map((item) => (
                                <div className="settle-goods-item" key={item.cartId}>
                                  <div className="settle-goods-img-mask" />
                                  <div className="settle-goods-uncheck" onClick={() => void toggleItemChecked(item.cartId)}>
                                    取消选择
                                  </div>
                                  <img src={item.picThumb || ''} alt={item.productName || ''} />
                                </div>
                              ))}
                              {Array.from({ length: (4 - (checkedItems.length % 4)) % 4 }).map((_, index) => (
                                <div className="settle-goods-item empty" key={`empty-${index}`} />
                              ))}
                            </div>
                            {checkedItems.length > SETTLE_FOLD_LIMIT ? (
                              <div className="settle-goods-toggle" onClick={() => setShowAllGoods((value) => !value)}>
                                <span>{showAllGoods ? '收起' : '显示全部商品'}</span>
                                <span className={`arrow${showAllGoods ? ' up' : ''}`}>▾</span>
                              </div>
                            ) : null}
                          </div>

                          <div className="settle-price-wrapper">
                            <div className="settle-line-item">
                              <div className="settle-line">
                                <span className="lbl strong">商品总价</span>
                                <span className="val">
                                  <Price value={total.productAmount} />
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="settle-lines">
                          {Number(total.discountDiscountAmount || 0) > 0 ? (
                            <div className="settle-line-item">
                              <div className="settle-line">
                                <span className="lbl">活动优惠</span>
                                <span className="val discount-val flex align-center">
                                  <span className="settle-symbol">-</span>
                                  <Price value={total.discountDiscountAmount} />
                                </span>
                              </div>
                            </div>
                          ) : null}
                          {Number(total.discountCouponAmount || 0) > 0 ? (
                            <div className="settle-line-item">
                              <div className="settle-line">
                                <span className="lbl">优惠券</span>
                                <span className="val discount-val flex align-center">
                                  <span className="settle-symbol">-</span>
                                  <Price value={total.discountCouponAmount} />
                                </span>
                              </div>
                            </div>
                          ) : null}
                          {Number(total.serviceFee || 0) > 0 ? (
                            <div className="settle-line-item">
                              <div className="settle-line">
                                <span className="lbl">附加费用</span>
                                <span className="val flex align-center">
                                  <span className="settle-symbol">+</span>
                                  <Price value={total.serviceFee} />
                                </span>
                              </div>
                            </div>
                          ) : null}
                        </div>

                        <div className="settle-summary-row flex justify-end align-center">
                          <div className="save-total">
                            <span className="lbl">优惠共减</span>
                            <Price value={total.discounts} />
                          </div>
                          <span className="divider-line" />
                          <div className="sub-total">
                            <span className="lbl">合计</span>
                            <Price value={total.discountAfter ?? productAmount} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* 3. 底部合计 + 结算 */}
                  <div className="settle-bottom-container">
                    <div className="settle-bottom-inner">
                      <div className="settle-bottom-left">
                        <div className="settle-final flex justify-between align-end">
                          <span className="final-label">合计:</span>
                          <div className="final-right">
                            {/* 字号/字重/配色统一由 .settle-final .price 控制 */}
                            <Price value={total.discountAfter ?? productAmount} />
                          </div>
                        </div>

                        {checkedCount > 0 ? (
                          <div className="settle-discount-toggle" onClick={() => setSettleExpanded((value) => !value)}>
                            <span className="discount-lbl">优惠共减</span>
                            <span className="discount-val">
                              <Price value={total.discounts} />
                            </span>
                            <span className="toggle-link">
                              <span>优惠明细</span>
                              <span className={`arrow${settleExpanded ? ' up' : ''}`}>▾</span>
                            </span>
                          </div>
                        ) : null}
                      </div>

                      <div className="settle-bottom-right">
                        <button
                          type="button"
                          className="buyBtnOne"
                          disabled={!checkedCount || checkingOut}
                          onClick={() => void checkout()}
                        >
                          结算({checkedCount || 0})
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 原版 ProdSwiper：精选好物（mod_you_like） */}
      {recommendDisplay.length || recommendLoading ? (
        <div className="mod_you_like">
          <h3 className="com-pc-title">精选好物</h3>
          <div
            className="you_like_list"
            ref={recommendGridRef}
            style={{ '--you-like-columns': recommendColumns } as React.CSSProperties}
          >
            {recommendDisplay.map((product, index) => (
              <ProductCard
                key={`${product.productId}-${index}`}
                product={product}
                onCallback={() => void load()}
              />
            ))}
          </div>
          <div ref={recommendSentinelRef}>
            {recommendLoading ? (
              <div className="loading-con">
                <span className="gif-loading" />
              </div>
            ) : null}
            {recommendReachedEnd && !recommendLoading ? (
              <div className="load-end-con">没有更多喽~</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

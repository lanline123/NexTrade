'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Checkbox, InputNumber, Modal, Toast } from '@douyinfe/semi-ui';
import { IconDelete, IconShoppingBag } from '@douyinfe/semi-icons';

/**
 * 购物车（源码对照 java-b2b2c-overseas-v5.8.61/view/pc/pages/cart/index.vue）
 *
 * 对齐点：
 * - `limitNumber` 限购 + `stock` 库存上限校验（旧版 pages/cart/src/InputNumber.vue）
 * - 禁售/下架/已售罄/规格停用 → `isDisabled` 且取消勾选（旧版 utils/productSale.ts）
 * - 全选/店铺勾选/单项勾选与 updateCheck 同步；不可用商品不参与结算
 * - 清空购物车、批量删除已选、已选移入收藏
 * - 结算前刷新销售状态，若已选商品下架/禁售则提示并排除
 */

interface CartSku {
  isEnabled?: number | null;
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

interface RecommendedProduct {
  productId?: number;
  productName?: string;
  productPrice?: string | number;
  marketPrice?: string | number;
  picThumb?: string;
  picUrl?: string;
  productSn?: string;
}

interface CartItem {
  cartId: number;
  productId?: number;
  productName?: string;
  picThumb?: string;
  price?: string;
  quantity?: number;
  isChecked?: boolean;
  isDisabled?: boolean;
  skuData?: Array<{ name?: string; value?: string }>;
  /** 旧版限购数量（0/空表示不限购） */
  limitNumber?: number;
  /** 库存 */
  stock?: number;
  productStatus?: number;
  saleStatus?: number | string;
  effectiveSaleStatus?: number | string;
  sku?: CartSku;
  gift?: GiftItem[];
  activityInfo?: any;
}

interface CartGroup {
  shopId?: number;
  shopTitle?: string;
  isChecked?: boolean;
  carts: CartItem[];
}

interface Total {
  totalCount?: number;
  checkedCount?: number;
  productAmount?: number;
  discounts?: number;
  discountAfter?: number;
  serviceFee?: number;
}

interface CartResult {
  cartList: CartGroup[];
  total: Total;
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

function money(value: unknown): string {
  return Number(value || 0).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** 旧版 `isSaleProhibited`：禁售/失效销售状态。 */
function isSaleProhibited(item: CartItem): boolean {
  return Number(item.saleStatus ?? item.effectiveSaleStatus ?? 1) === 0;
}

/** 旧版 `isProductUnavailable`：禁售或商品下架。 */
function isProductUnavailable(item: CartItem): boolean {
  return isSaleProhibited(item) || Number(item.productStatus ?? 1) === 0;
}

/** 旧版 `isDisabledData`：不可用 / 售罄 / 规格停用 / 后端禁用。 */
function isDisabledData(item: CartItem): boolean {
  return isProductUnavailable(item) || Number(item.stock ?? 1) <= 0 || item.isDisabled === true || item.sku?.isEnabled === 0;
}

/** 旧版 `applyCartSaleState`：保留原始状态，仅把不可用项置禁用并取消勾选。 */
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

export default function CartClient() {
  const [groups, setGroups] = useState<CartGroup[]>([]);
  const [total, setTotal] = useState<Total>({});
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [recommended, setRecommended] = useState<RecommendedProduct[]>([]);

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

  // 旧版 ProdSwiper：GET common/recommend/getProductIds → GET product/product/list?ids=
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const idsResult = await request<string | number[]>('common/recommend/getProductIds');
        const ids = Array.isArray(idsResult) ? idsResult.join(',') : String(idsResult || '');
        if (!ids) return;
        const list = await request<{ records?: RecommendedProduct[] }>(
          `product/product/list?page=1&size=8&ids=${encodeURIComponent(ids)}`,
        );
        if (!cancelled) setRecommended(list.records || []);
      } catch {
        /* 推荐位失败不影响购物车主流程 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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

  const checkedItems = useMemo(
    () => groups.flatMap((group) => (group.carts || []).filter((item) => item.isChecked && !isDisabledData(item))),
    [groups],
  );
  const checkedCount = checkedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const productAmount = checkedItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const allChecked = groups.length > 0 && groups.every((group) => (group.carts || []).filter((item) => !isDisabledData(item)).every((item) => item.isChecked));

  /** 与旧版 `updateCheckData` 对齐：提交全部商品的勾选态（不可用项恒为 0）。 */
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

  const changeQuantity = async (item: CartItem, quantity: number) => {
    if (updating) return;
    const next = Math.floor(Number(quantity) || 1);
    const max = cartQuantityMax(item);
    if (next < 1) return;
    if (next > max) {
      const limit = Number(item.limitNumber ?? 0);
      const stock = Number(item.stock ?? 0);
      if (limit > 0 && max === limit) Toast.error({ content: `限购${limit}件，已达限购数` });
      else if (stock > 0 && max === stock) Toast.error({ content: '库存不足' });
      Toast.error({ content: `最多可购买 ${max} 件` });
      return;
    }
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

  const remove = (cartIds: number | number[]) => {
    const ids = Array.isArray(cartIds) ? cartIds : [cartIds];
    Modal.confirm({
      title: '确认要删除指定的商品吗',
      content: '确认从购物车删除该商品？',
      onOk: async () => {
        try {
          await request('cart/cart/removeItem', { method: 'POST', body: JSON.stringify({ cartIds: ids }) });
          Toast.success({ content: '删除成功' });
          await load();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
        }
      },
    });
  };

  const removeChecked = () => {
    if (!checkedItems.length) {
      Toast.warning({ content: '请至少选择一个宝贝' });
      return;
    }
    remove(checkedItems.map((item) => item.cartId));
  };

  /** 旧版 `collectCheckedCartItem`：已选商品逐个收藏后从购物车移除。 */
  const collectChecked = () => {
    if (!checkedItems.length) {
      Toast.warning({ content: '请至少选择一个宝贝' });
      return;
    }
    Modal.confirm({
      title: '确认将选中的商品移入收藏吗？',
      onOk: async () => {
        try {
          await Promise.allSettled(
            checkedItems.map((item) => request('user/collectProduct/save', { method: 'POST', body: JSON.stringify({ productId: item.productId }) })),
          );
          await request('cart/cart/removeItem', { method: 'POST', body: JSON.stringify({ cartIds: checkedItems.map((item) => item.cartId) }) });
          Toast.success({ content: '已移入收藏' });
          await load();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '移入收藏失败' });
        }
      },
    });
  };

  /** 旧版 `onClearCart`：清空购物车。 */
  const clearCart = () => {
    Modal.confirm({
      title: '确认要清空购物车吗？',
      onOk: async () => {
        try {
          await request('cart/cart/clear', { method: 'POST' });
          Toast.success({ content: '购物车已清空' });
          await load();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '清空购物车失败' });
        }
      },
    });
  };

  /**
   * 旧版 `refreshSaleBeforeCheckout`：结算前拉最新购物车，已选商品若下架/禁售则提示并排除。
   */
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
        if (!checkedItems.length) Toast.warning({ content: '请选择要结算的商品' });
        return;
      }
      window.location.href = `/order/check?cartIds=${ids.join(',')}`;
    } finally {
      setCheckingOut(false);
    }
  };

  if (loading) {
    return <div className="cart-state">购物车加载中...</div>;
  }

  if (needLogin) {
    return (
      <Card className="cart-state">
        <IconShoppingBag size="extra-large" />
        <h2>登录后查看购物车</h2>
        <p>登录后可以同步购物车、收藏和订单信息。</p>
        <Link href="/login?redirect=/cart">
          <Button theme="solid" type="primary" size="large">
            去登录
          </Button>
        </Link>
      </Card>
    );
  }

  if (!groups.length) {
    return (
      <Card className="cart-state">
        <IconShoppingBag size="extra-large" />
        <h2>购物车还是空的</h2>
        <p>去首页看看有什么适合你的设备。</p>
        <Link href="/">
          <Button theme="solid" type="primary" size="large">
            去逛逛
          </Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="pc-cart">
      <div className="pc-cart__table">
        <div className="pc-cart__head">
          <Checkbox checked={allChecked} onChange={(event) => void toggleAll(Boolean(event.target.checked))}>
            全选
          </Checkbox>
          <span>商品信息</span>
          <span>单价</span>
          <span>数量</span>
          <span>小计</span>
          <span>操作</span>
        </div>

        {groups.map((group, groupIndex) => (
          <div key={group.shopId ?? groupIndex} className="pc-cart__group">
            <div className="pc-cart__group-head">
              <Checkbox
                checked={(group.carts || []).filter((item) => !isDisabledData(item)).every((item) => item.isChecked)}
                onChange={(event) => void toggleGroup(groupIndex, Boolean(event.target.checked))}
              >
                {group.shopId ? group.shopTitle || '店铺' : '官方自营'}
              </Checkbox>
            </div>

            {(group.carts || []).map((item) => {
              const disabled = isDisabledData(item);
              const soldOut = Number(item.stock ?? 1) <= 0;
              const unavailable = isProductUnavailable(item);
              const max = cartQuantityMax(item);
              return (
                <div key={item.cartId} className={`pc-cart__row ${disabled ? 'is-disabled' : ''}`}>
                  <Checkbox
                    checked={Boolean(item.isChecked)}
                    disabled={disabled}
                    onChange={(event) => void toggleItem(groupIndex, item.cartId, Boolean(event.target.checked))}
                  />
                  <div className="pc-cart__product">
                    <img src={item.picThumb || ''} alt={item.productName || ''} />
                    <div>
                      <Link href={`/product/${item.productId || ''}`}>{item.productName || '商品'}</Link>
                      {item.skuData?.length ? (
                        <span className="pc-cart__sku">
                          {item.skuData.map((sku) => `${sku.name || ''}：${sku.value || ''}`).join(' / ')}
                        </span>
                      ) : null}
                      {Array.isArray(item.gift) && item.gift.length ? (
                        <span className="pc-cart__gifts">
                          赠品：
                          {item.gift.map((gift, giftIndex) => (
                            <span key={gift.giftId ?? giftIndex} className="pc-cart__gift">
                              {(gift.picThumb || gift.picUrl) ? <img src={gift.picThumb || gift.picUrl} alt={gift.productName || ''} /> : null}
                              {gift.productName || '赠品'}
                              {gift.skuData?.length ? `（${gift.skuData.map((sku) => sku.value || '').filter(Boolean).join(' / ')}）` : ''}
                              {gift.num ? ` × ${gift.num}` : ''}
                            </span>
                          ))}
                        </span>
                      ) : null}
                      {Array.isArray(item.activityInfo) && item.activityInfo.length ? (
                        <span className="pc-cart__activity">
                          {item.activityInfo.map((activity: any) => activity?.name || activity?.title || '').filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                      {unavailable ? (
                        <span className="pc-cart__disabled-reason">{soldOut ? '已售罄' : '商品已下架或禁售'}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="pc-cart__price">¥ {money(item.price)}</div>
                  <div className="pc-cart__quantity">
                    <InputNumber
                      min={1}
                      max={max}
                      value={Number(item.quantity || 1)}
                      disabled={updating || disabled}
                      onChange={(value) => void changeQuantity(item, Number(value) || 1)}
                    />
                    {Number(item.limitNumber ?? 0) > 0 ? (
                      <span className="pc-cart__limit">限购 {item.limitNumber} 件</span>
                    ) : null}
                    {Number(item.stock ?? 0) > 0 ? <span className="pc-cart__stock">库存 {item.stock}</span> : null}
                  </div>
                  <div className="pc-cart__subtotal">¥ {money(Number(item.price || 0) * Number(item.quantity || 0))}</div>
                  {Number(item.quantity || 1) <= 1 ? (
                    <Button theme="borderless" type="danger" icon={<IconDelete />} onClick={() => remove(item.cartId)}>
                      删除
                    </Button>
                  ) : (
                    <Button theme="borderless" onClick={() => void changeQuantity(item, Number(item.quantity || 1) - 1)}>
                      减少
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="pc-cart__footer">
        <Checkbox checked={allChecked} onChange={(event) => void toggleAll(Boolean(event.target.checked))}>
          全选
        </Checkbox>
        <Button theme="borderless" onClick={() => void removeChecked()}>
          删除已选
        </Button>
        <Button theme="borderless" onClick={() => void collectChecked()}>
          移入收藏
        </Button>
        <Button theme="borderless" type="danger" onClick={() => void clearCart()}>
          清空购物车
        </Button>
        <div className="pc-cart__summary">
          <span>
            已选 <b>{checkedCount}</b> 件
          </span>
          {Number(total.productAmount || 0) > 0 ? <span>商品金额：¥ {money(total.productAmount)}</span> : null}
          {Number(total.discounts || 0) > 0 ? <span>优惠：-¥ {money(total.discounts)}</span> : null}
          {Number(total.serviceFee || 0) > 0 ? <span>服务费：¥ {money(total.serviceFee)}</span> : null}
          <span>
            合计：<b>¥ {money(total.discountAfter ?? productAmount)}</b>
          </span>
          <Button
            theme="solid"
            type="primary"
            size="large"
            disabled={!checkedItems.length}
            loading={checkingOut}
            onClick={() => void checkout()}
          >
            去结算
          </Button>
        </div>
      </div>

      {recommended.length ? (
        <section className="pc-cart__recommend">
          <h2 className="pc-cart__recommend-title">精选好物</h2>
          <div className="pc-cart__recommend-grid">
            {recommended.map((product) => (
              <Link key={product.productId} href={`/product/${product.productId || ''}`} className="pc-cart__recommend-card">
                <img src={product.picThumb || product.picUrl || ''} alt={product.productName || ''} />
                <span className="pc-cart__recommend-name">{product.productName || '商品'}</span>
                <b>¥ {money(product.productPrice)}</b>
                {Number(product.marketPrice || 0) > 0 ? <del>¥ {money(product.marketPrice)}</del> : null}
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

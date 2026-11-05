'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Checkbox, InputNumber, Modal, Toast } from '@douyinfe/semi-ui';
import { IconDelete, IconShoppingBag } from '@douyinfe/semi-icons';

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

export default function CartClient() {
  const [groups, setGroups] = useState<CartGroup[]>([]);
  const [total, setTotal] = useState<Total>({});
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await request<CartResult>('cart/cart/list');
      setGroups(result.cartList || []);
      setTotal(result.total || {});
      setNeedLogin(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      setNeedLogin(message.includes('登录') || message.includes('401'));
      setGroups([]);
    } finally {
      setLoading(false);
    }
  };

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
    () => groups.flatMap((group) => (group.carts || []).filter((item) => item.isChecked && !item.isDisabled)),
    [groups],
  );
  const checkedCount = checkedItems.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  const productAmount = checkedItems.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const allChecked = groups.length > 0 && groups.every((group) => (group.carts || []).filter((item) => !item.isDisabled).every((item) => item.isChecked));

  const syncCheck = async (nextGroups: CartGroup[]) => {
    setGroups(nextGroups);
    const data = nextGroups.flatMap((group) =>
      (group.carts || []).map((item) => ({ cartId: item.cartId, isChecked: item.isChecked && !item.isDisabled ? 1 : 0 })),
    );
    await request('cart/cart/updateCheck', { method: 'POST', body: JSON.stringify({ data } ) }).catch(() => undefined);
    void load();
  };

  const toggleAll = async (checked: boolean) => {
    await syncCheck(
      groups.map((group) => ({
        ...group,
        isChecked: checked,
        carts: (group.carts || []).map((item) => ({ ...item, isChecked: checked && !item.isDisabled })),
      })),
    );
  };

  const toggleGroup = async (index: number, checked: boolean) => {
    const next = groups.map((group, groupIndex) =>
      groupIndex === index
        ? {
            ...group,
            isChecked: checked,
            carts: (group.carts || []).map((item) => ({ ...item, isChecked: checked && !item.isDisabled })),
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

  const changeQuantity = async (cartId: number, quantity: number) => {
    if (quantity < 1) return;
    setUpdating(true);
    try {
      await request('cart/cart/updateItem', {
        method: 'POST',
        body: JSON.stringify({ cartId, data: { quantity } }),
      });
      await load();
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '修改数量失败' });
    } finally {
      setUpdating(false);
    }
  };

  const remove = (cartId: number) => {
    Modal.confirm({
      title: '删除商品',
      content: '确认从购物车删除该商品？',
      onOk: async () => {
        try {
          await request('cart/cart/removeItem', {
            method: 'POST',
            body: JSON.stringify({ cartIds: [cartId] }),
          });
          Toast.success({ content: '删除成功' });
          await load();
        } catch (error) {
          Toast.error({ content: error instanceof Error ? error.message : '删除失败' });
        }
      },
    });
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
                checked={(group.carts || []).filter((item) => !item.isDisabled).every((item) => item.isChecked)}
                onChange={(event) => void toggleGroup(groupIndex, Boolean(event.target.checked))}
              >
                {group.shopId ? group.shopTitle || '店铺' : '官方自营'}
              </Checkbox>
            </div>

            {(group.carts || []).map((item) => (
              <div key={item.cartId} className={`pc-cart__row ${item.isDisabled ? 'is-disabled' : ''}`}>
                <Checkbox
                  checked={Boolean(item.isChecked)}
                  disabled={Boolean(item.isDisabled)}
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
                  </div>
                </div>
                <div className="pc-cart__price">¥ {money(item.price)}</div>
                <div className="pc-cart__quantity">
                  <InputNumber
                    min={1}
                    value={Number(item.quantity || 1)}
                    disabled={updating || Boolean(item.isDisabled)}
                    onChange={(value) => void changeQuantity(item.cartId, Number(value) || 1)}
                  />
                </div>
                <div className="pc-cart__subtotal">¥ {money(Number(item.price || 0) * Number(item.quantity || 0))}</div>
                <Button theme="borderless" type="danger" icon={<IconDelete />} onClick={() => remove(item.cartId)}>
                  删除
                </Button>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="pc-cart__footer">
        <Checkbox checked={allChecked} onChange={(event) => void toggleAll(Boolean(event.target.checked))}>
          全选
        </Checkbox>
        <Button
          theme="borderless"
          type="danger"
          onClick={() => void syncCheck(groups.map((group) => ({ ...group, carts: [] })))}
        >
          清空已选
        </Button>
        <div className="pc-cart__summary">
          <span>
            已选 <b>{checkedCount}</b> 件
          </span>
          <span>
            合计：<b>¥ {money(total.discountAfter ?? productAmount)}</b>
          </span>
          <Link href={`/order/check?cartIds=${checkedItems.map((item) => item.cartId).join(',')}`}>
            <Button theme="solid" type="primary" size="large" disabled={!checkedItems.length}>
              去结算
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

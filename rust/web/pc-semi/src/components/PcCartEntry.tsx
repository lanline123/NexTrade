'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ShoppingCart from '@icon-park/react/es/icons/ShoppingCart';
import { formatPrice } from '@/lib/currency';
import { imageFormat } from '@/lib/image';
import { buildProductPath } from '@/lib/link';

import { useTranslation } from 'react-i18next';
/**
 * 头部购物车入口 + hover 下拉面板。
 * 对齐旧版 view/pc components/shoppingCart/ShoppingCart.vue + ShoppingCartList.vue：
 * hover 展开已加购商品列表（图/名/价×数/删除），底部合计 + 去购物车结算。
 */

interface CartProduct {
  cartId?: number;
  productId?: number;
  productSn?: string | number;
  seoLink?: string | null;
  productName?: string;
  price?: number | string;
  quantity?: number | string;
  picUrl?: string;
  picThumb?: string;
}

interface CartGroup {
  carts?: CartProduct[];
}

interface CartListResponse {
  cartList?: CartGroup[];
  total?: { totalCount?: number };
}

function pickPic(product: CartProduct): string {
  return imageFormat(product.picUrl || product.picThumb || '');
}

function productHref(product: CartProduct): string {
  return buildProductPath({ seoLink: product.seoLink, sn: product.productSn ?? product.productId });
}

export default function PcCartEntry({ cartStyle = 1, cartPic = '' }: { cartStyle?: number; cartPic?: string }) {
    const { t } = useTranslation();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<CartProduct[]>([]);
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    fetch('/api/cart/cart/list', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      .then((response) => response.json())
      .then((json) => setCount(Number(json?.data?.total?.totalCount || 0)))
      .catch(() => undefined);
  }, []);

  const loadCartList = () => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoaded(true);
      return;
    }
    fetch('/api/cart/cart/list', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      .then((response) => response.json())
      .then((json) => {
        const data: CartListResponse = json?.data || {};
        const groups = Array.isArray(data.cartList) ? data.cartList : [];
        const flat: CartProduct[] = [];
        groups.forEach((group) => (group.carts || []).forEach((product) => flat.push(product)));
        setItems(flat);
        setCount(Number(data.total?.totalCount || flat.length));
      })
      .catch(() => undefined)
      .finally(() => setLoaded(true));
  };

  const removeItem = async (cartId?: number) => {
    if (!cartId) return;
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    try {
      await fetch('/api/cart/cart/removeItem', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ cartIds: [cartId] }),
      });
    } catch {
      /* 删除失败静默，下次展开会重新拉取 */
    }
    loadCartList();
  };

  return (
    <div
      className="pc-cart-entry"
      onMouseEnter={() => {
        setOpen(true);
        if (!loaded) loadCartList();
      }}
      onMouseLeave={() => setOpen(false)}
    >
      <Link href="/cart">
        <div className={`content${cartStyle === 2 ? ' content--pic' : ''}`}>
          {cartStyle === 2 ? (
            cartPic ? <img className="cart-img" src={cartPic} alt="" /> : <div className="cart-img-empty">{t('购物车')}</div>
          ) : (
            <>
              <div className="icon"><ShoppingCart size={20} /></div>
              {count > 0 ? <div className="count">{count}</div> : null}
              <div className="txt">{t('购物车')}</div>
            </>
          )}
        </div>
      </Link>

      {open ? (
        <div className="pc-cart-dropdown">
          {items.length > 0 ? (
            <>
              <div className="pc-cart-dropdown__list">
                {items.map((product, index) => (
                  <div key={product.cartId ?? index} className="pc-cart-dropdown__item">
                    <Link href={productHref(product)} className="pc-cart-dropdown__photo">
                      {pickPic(product) ? (
                        <img src={pickPic(product)} alt={product.productName || ''} />
                      ) : null}
                    </Link>
                    <div className="pc-cart-dropdown__info">
                      <Link href={productHref(product)} className="pc-cart-dropdown__name">
                        {product.productName}
                      </Link>
                      <span className="pc-cart-dropdown__price">
                        <span className="pc-cart-dropdown__price-con">
                          <b className="pc-cart-dropdown__price-num">{formatPrice(product.price)}</b>
                          × {product.quantity ?? 1}
                        </span>
                        <span
                          className="pc-cart-dropdown__del"
                          title={t('删除该商品')}
                          onClick={(event) => {
                            event.preventDefault();
                            void removeItem(product.cartId);
                          }}
                        >{t('删除')}</span>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="pc-cart-dropdown__footer">
                <span className="pc-cart-dropdown__total">{t('购物车共')}<span className="pc-cart-dropdown__total-num">{count}</span>{t('件商品')}</span>
                <Link href="/cart" className="pc-cart-dropdown__checkout">{t('去购物车结算')}</Link>
              </div>
            </>
          ) : (
            <div className="pc-cart-dropdown__empty">
              {loaded ? (
                <>{t('购物车中还没有商品')}<br />{t('赶紧选购吧')}</>
              ) : (
                '加载中…'
              )}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

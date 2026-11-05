'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ShoppingCart from '@icon-park/react/es/icons/ShoppingCart';

export default function PcCartEntry({ cartStyle = 1, cartPic = '' }: { cartStyle?: number; cartPic?: string }) {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    fetch('/api/cart/cart/list', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      .then((response) => response.json())
      .then((json) => setCount(Number(json?.data?.total?.totalCount || 0)))
      .catch(() => undefined);
  }, []);

  return (
    <Link href="/cart" className="pc-header__action pc-cart-entry">
      {cartStyle === 2 && cartPic ? (
        <img className="pc-cart-entry__pic" src={cartPic} alt="" />
      ) : (
        <span className="pc-cart-entry__icon">
          <ShoppingCart size={20} />
          {count > 0 ? <i className="pc-cart-entry__count">{count}</i> : null}
        </span>
      )}
      <span>购物车</span>
    </Link>
  );
}

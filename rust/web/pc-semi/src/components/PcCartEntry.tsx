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
    <Link href="/cart">
      <div className={`content${cartStyle === 2 ? ' content--pic' : ''}`}>
        {cartStyle === 2 ? (
          cartPic ? <img className="cart-img" src={cartPic} alt="" /> : <div className="cart-img-empty">购物车</div>
        ) : (
          <>
            <div className="icon"><ShoppingCart size={20} /></div>
            {count > 0 ? <div className="count">{count}</div> : null}
            <div className="txt">购物车</div>
          </>
        )}
      </div>
    </Link>
  );
}

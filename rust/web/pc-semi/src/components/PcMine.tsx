'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import User from '@icon-park/react/es/icons/User';

interface MineUser {
  nickname?: string;
  dimUsername?: string;
  avatar?: string;
  [key: string]: unknown;
}

export default function PcMine() {
  const [user, setUser] = useState<MineUser | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    fetch('/api/user/user/detail', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      .then((response) => response.json())
      .then((json) => setUser(json?.data || null))
      .catch(() => undefined);
  }, []);

  const logout = () => {
    localStorage.removeItem('accessToken');
    document.cookie = 'accessToken=; path=/; max-age=0';
    window.location.href = '/';
  };

  const name = String(user?.nickname || user?.dimUsername || '我的');

  if (!user) {
    return (
      <Link href="/login" className="pc-header__action pc-mine">
        <User size={20} />
        <span>登录</span>
      </Link>
    );
  }

  return (
    <div className="pc-mine" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <Link href="/member" className="pc-header__action">
        <User size={20} />
        <span>我的</span>
      </Link>
      {open ? (
        <div className="pc-mine__dropdown">
          <Link href="/member" className="pc-mine__head">
            <span className="pc-mine__avatar">
              {user.avatar ? <img src={String(user.avatar)} alt="" /> : name.slice(0, 1)}
            </span>
            <b>{name}</b>
          </Link>
          <div className="pc-mine__menu">
            <Link href="/member/order/list">我的订单</Link>
            <Link href="/member/comment/List">我的评价</Link>
            <Link href="/member/collectProduct/List">心愿单</Link>
            <Link href="/member/address">收货地址</Link>
            <Link href="/member/browsingHistory">浏览记录</Link>
            <button type="button" onClick={logout}>退出登录</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

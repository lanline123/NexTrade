'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import User from '@icon-park/react/es/icons/User';
import Down from '@icon-park/react/es/icons/Down';

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
      <div className="category-wrap">
        <div className="bar-wrap">
          <Link href="/login" className="content">
            <div className="icon"><User size={18} /></div>
            <div className="txt">登录</div>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="category-wrap" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <div className="bar-wrap">
        <div className="content">
          <Link href="/member" className="content">
            <div className="icon"><User size={18} /></div>
            <div className="txt">我的</div>
            <div className="icon ml"><Down className={`arrow${open ? ' rotate' : ''}`} size={14} /></div>
          </Link>
        </div>
      </div>
      {open ? (
        <div className="popover-mine-content">
          <Link href="/member" className="member-info">
            <div className="avatar">
              {user.avatar ? <img src={String(user.avatar)} alt="" referrerPolicy="no-referrer" /> : null}
            </div>
            <div className="name">{name}</div>
          </Link>
          <div className="menu-wrap">
            <Link href="/member/order/list" className="item-wrap">我的订单</Link>
            <Link href="/member/comment/list" className="item-wrap">我的评价</Link>
            <Link href="/member/collectProduct/list" className="item-wrap">心愿单</Link>
            <Link href="/member/address/list" className="item-wrap">收货地址</Link>
            <Link href="/member/browsingHistory/list" className="item-wrap">浏览记录</Link>
            <button type="button" className="item-wrap logout" onClick={logout}>退出登录</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

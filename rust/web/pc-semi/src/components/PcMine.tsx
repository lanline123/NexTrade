'use client';

/**
 * 头部「我的」入口（源码：view/pc/components/common/components/Mine.vue）
 *
 * - 未登录：.category-wrap > .bar-wrap > .content（登录）
 * - 已登录：hover 弹层 .popover-mine-content（会员信息 + 菜单）
 * - 评价入口受后台 productCommentEnabled 控制（D1146）
 * - 头像空时回退 defaultAvatar（config/base）
 */
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import User from '@icon-park/react/es/icons/User';
import Down from '@icon-park/react/es/icons/Down';
import { readHeaderBootstrap } from '@/lib/header-bootstrap';

interface MineUser {
  nickname?: string;
  dimUsername?: string;
  avatar?: string;
  [key: string]: unknown;
}

/** hover 关闭延迟（对齐源码 el-popover :hide-after="300"；弹层与触发区之间由 CSS ::before 桥接） */
const MINE_HIDE_DELAY_MS = 300;

export default function PcMine({
  isWhite = false,
  baseConfig = null,
}: {
  isWhite?: boolean;
  /** 服务端预取的站点配置（默认头像 / 评价开关），保证首屏与其他头部模块同时就绪 */
  baseConfig?: Record<string, any> | null;
}) {
  const [user, setUser] = useState<MineUser | null>(null);
  const [open, setOpen] = useState(false);
  const [defaultAvatar, setDefaultAvatar] = useState(String(baseConfig?.defaultAvatar || ''));
  const [commentEnabled, setCommentEnabled] = useState(Number(baseConfig?.productCommentEnabled ?? 1));
  const hoverTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    };
  }, []);

  useEffect(() => {
    // 站点配置优先用服务端注入的 props，避免头像/评价开关再等一次客户端请求
    const cachedBase = baseConfig || readHeaderBootstrap()?.base;
    if (cachedBase) {
      setDefaultAvatar(String(cachedBase.defaultAvatar || ''));
      setCommentEnabled(Number(cachedBase.productCommentEnabled ?? 1));
      return;
    }
    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => {
        setDefaultAvatar(String(json?.data?.defaultAvatar || ''));
        setCommentEnabled(Number(json?.data?.productCommentEnabled ?? 1));
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setUser(null);
      return;
    }
    let cancelled = false;
    fetch('/api/user/user/detail', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setUser(json?.data || null);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const logout = () => {
    localStorage.removeItem('accessToken');
    document.cookie = 'accessToken=; path=/; max-age=0';
    window.location.href = '/';
  };

  const scheduleClose = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    hoverTimer.current = window.setTimeout(() => setOpen(false), MINE_HIDE_DELAY_MS);
  };
  const cancelClose = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
  };

  const avatarSrc = String(user?.avatar || defaultAvatar || '');
  const name = String(user?.nickname || user?.dimUsername || '我的');

  if (!user) {
    return (
      <div className={`category-wrap${isWhite ? ' white' : ''}`}>
        <div className="bar-wrap">
          <div className="content">
            <Link href="/member/login" className="content">
              <div className="icon">
                <User size={18} />
              </div>
              <div className="txt">登录</div>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`category-wrap${isWhite ? ' white' : ''}`}
      onMouseEnter={() => {
        cancelClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <div className="bar-wrap">
        <div className="content">
          <Link href="/member" className="content">
            <div className="icon">
              <User size={18} />
            </div>
            <div className="txt">我的</div>
            <div className="icon ml">
              <Down className={`arrow${open ? ' rotate' : ''}`} size={14} />
            </div>
          </Link>
        </div>
      </div>

      {open ? (
        <div className="popover-mine-content">
          <div>
            <Link href="/member" className="member-info">
              <div className="avatar">
                {avatarSrc ? <img src={avatarSrc} alt="" referrerPolicy="no-referrer" /> : null}
              </div>
              <div className="name">{name}</div>
            </Link>
          </div>
          <div className="menu-wrap">
            <Link href="/member/order/list" className="item-wrap">
              我的订单
            </Link>
            {commentEnabled === 1 ? (
              <Link href="/member/comment/list" className="item-wrap">
                我的评价
              </Link>
            ) : null}
            <Link href="/member/collectProduct/list" className="item-wrap">
              心愿单
            </Link>
            <Link href="/member/address/list" className="item-wrap">
              收货地址
            </Link>
            <Link href="/member/browsingHistory/list" className="item-wrap">
              浏览记录
            </Link>
            <a className="item-wrap logout" onClick={logout}>
              退出登录
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar, Button, Card, Skeleton, Tag } from '@douyinfe/semi-ui';
import { IconArrowRight, IconOrderedList, IconUser } from '@douyinfe/semi-icons';
import { apiGet } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
interface MemberInfo {
  userId?: number;
  username?: string;
  nickname?: string;
  avatar?: string;
  points?: number;
  balance?: number;
  coupon?: number;
  rankName?: string;
  mobile?: string;
  awaitPay?: number;
  awaitReceived?: number;
  awaitCoupon?: number;
}

interface OrderNum {
  awaitPay?: number;
  awaitShipping?: number;
  awaitReceived?: number;
  awaitComment?: number;
}

const ORDER_SHORTCUTS = [
  { key: 'awaitPay', label: '待付款', href: '/member/order/list?status=awaitPay' },
  { key: 'awaitShipping', label: '待发货', href: '/member/order/list?status=awaitShipping' },
  { key: 'awaitReceived', label: '待收货', href: '/member/order/list?status=awaitReceived' },
  { key: 'awaitComment', label: '待评价', href: '/member/order/list?status=awaitComment' },
];

const MEMBER_NAV = [
  { label: '我的订单', href: '/member/order/list', icon: <IconOrderedList /> },
  { label: '收货地址', href: '/member/address', icon: <IconUser /> },
  { label: '我的收藏', href: '/member/favorite', icon: <IconUser /> },
  { label: '我的积分', href: '/member/points', icon: <IconUser /> },
  { label: '账户余额', href: '/member/balance', icon: <IconUser /> },
  { label: '我的优惠券', href: '/member/coupon', icon: <IconUser /> },
  { label: '售后服务', href: '/member/aftersales', icon: <IconUser /> },
  { label: '账户资料', href: '/member/profile', icon: <IconUser /> },
];

export default function MemberClient() {
    const { t } = useTranslation();
  const [info, setInfo] = useState<MemberInfo | null>(null);
  const [orderNum, setOrderNum] = useState<OrderNum>({});
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    Promise.all([apiGet<MemberInfo>('user/user/detail'), apiGet<OrderNum>('user/order/orderNum').catch(() => ({}))])
      .then(([profile, counts]) => {
        setInfo(profile || {});
        setOrderNum(counts || {});
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Card className="member-card"><Skeleton.Title /><Skeleton.Paragraph rows={3} /></Card>;

  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>{t('登录后进入会员中心')}</h2>
        <p>{t('查看订单、优惠券、收货地址和个人资料。')}</p>
        <Link href="/login?redirect=/member">
          <Button theme="solid" type="primary" size="large">{t('去登录')}</Button>
        </Link>
      </Card>
    );
  }

  return (
    <div className="member-layout">
      <aside className="member-side">
        <Card className="member-side__profile">
          <Avatar size="large" src={info?.avatar}>
            {(info?.nickname || info?.username || t('会')).slice(0, 1)}
          </Avatar>
          <div>
            <b>{info?.nickname || info?.username || t('会员')}</b>
            <span>{info?.mobile || t('欢迎回来')}</span>
          </div>
          {info?.rankName ? <Tag color="orange">{info.rankName}</Tag> : null}
        </Card>
        <nav className="member-side__nav">
          {MEMBER_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="member-side__nav-item">
              {item.icon}
              <span>{item.label}</span>
              <IconArrowRight />
            </Link>
          ))}
        </nav>
      </aside>

      <div className="member-main">
        <div className="member-stats">
          <Card className="member-stat">
            <span>{t('账户余额')}</span>
            <b>¥ {Number(info?.balance || 0).toFixed(2)}</b>
          </Card>
          <Card className="member-stat">
            <span>{t('积分')}</span>
            <b>{info?.points ?? 0}</b>
          </Card>
          <Card className="member-stat">
            <span>{t('优惠券')}</span>
            <b>{info?.coupon ?? info?.awaitCoupon ?? 0}</b>
          </Card>
        </div>

        <Card className="member-card" title={t('我的订单')}>
          <div className="member-order-shortcuts">
            {ORDER_SHORTCUTS.map((item) => (
              <Link key={item.key} href={item.href} className="member-order-shortcut">
                <b>{orderNum[item.key as keyof OrderNum] ?? 0}</b>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
          <div className="member-card__more">
            <Link href="/member/order/list">{t('查看全部订单')}<IconArrowRight /></Link>
          </div>
        </Card>
      </div>
    </div>
  );
}

'use client';

/**
 * 会员中心首页（对照旧版 `view/pc/pages/member/index.vue` 迁移）。
 *
 * 旧版结构：
 * - 用户信息区：头像、昵称、等级图标、企业认证徽标、编辑资料 / 账户安全 / 我的地址入口；
 * - 订单状态行：我的订单、待付款、待收货、评论（评论开启时）、售后数量入口；
 * - 快捷入口：优惠券（含待使用数量）、心愿单、浏览记录；
 * - 精选好物 / 最近浏览商品。
 *
 * 新版复用 pc-semi 既有的 `member-layout / member-side / member-main / member-card` 样式，
 * 数据接口沿用旧版：`user/user/memberCenter`、`user/order/orderNum`、`user/user/historyProduct`。
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Avatar, Button, Card, Skeleton, Tag } from '@douyinfe/semi-ui';
import { IconArrowRight, IconOrderedList, IconUser } from '@douyinfe/semi-icons';
import { apiGet } from '@/lib/client-api';

interface MemberCenterInfo {
  userId?: number;
  username?: string;
  nickname?: string;
  avatar?: string;
  mobile?: string;
  rankIco?: string;
  rankName?: string;
  isCompanyAuth?: number;
  awaitPay?: number;
  awaitCoupon?: number;
  balance?: number;
  points?: number;
}

interface OrderNum {
  awaitPay?: number;
  awaitShipping?: number;
  awaitReceived?: number;
  awaitComment?: number;
  awaitAftersalesCollect?: number;
}

interface HistoryProduct {
  productId: number;
  productName?: string;
  picThumb?: string;
  productPrice?: number | string;
  marketPrice?: number | string;
}

const ORDER_SHORTCUTS: Array<{ key: keyof OrderNum; label: string; href: string }> = [
  { key: 'awaitPay', label: '待付款', href: '/member/order/list?status=awaitPay' },
  { key: 'awaitShipping', label: '待发货', href: '/member/order/list?status=awaitShipping' },
  { key: 'awaitReceived', label: '待收货', href: '/member/order/list?status=awaitReceived' },
  { key: 'awaitComment', label: '待评论', href: '/member/comment/list' },
  { key: 'awaitAftersalesCollect', label: '售后', href: '/member/aftersales' },
];

const MEMBER_NAV: Array<{ label: string; href: string }> = [
  { label: '我的订单', href: '/member/order/list' },
  { label: '我的优惠券', href: '/member/coupon' },
  { label: '收货地址', href: '/member/address' },
  { label: '查看心愿单', href: '/member/favorite' },
  { label: '查看浏览记录', href: '/member/browsingHistory' },
  { label: '我的收藏店铺', href: '/member/collectShop' },
  { label: '账户余额', href: '/member/balance' },
  { label: '我的积分', href: '/member/points' },
  { label: '实名认证', href: '/member/userCertification' },
  { label: '我的拼团', href: '/member/group' },
  { label: '我的询价', href: '/member/inquiry' },
  { label: '留言反馈', href: '/member/feedback/list' },
  { label: '礼品卡兑换', href: '/member/giftCard/exchange' },
  { label: '账户资料', href: '/member/profile' },
];

export default function MemberCenterClient() {
  const [info, setInfo] = useState<MemberCenterInfo | null>(null);
  const [orderNum, setOrderNum] = useState<OrderNum>({});
  const [history, setHistory] = useState<HistoryProduct[]>([]);
  /** 源码 ProdSwiper「精选好物」：推荐商品 */
  const [recommended, setRecommended] = useState<HistoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<MemberCenterInfo>('user/user/memberCenter'),
      apiGet<OrderNum>('user/order/orderNum').catch(() => ({})),
      apiGet<HistoryProduct[]>('user/user/historyProduct', { page: 1, size: 10 }).catch(() => []),
      apiGet<{ records?: HistoryProduct[] } | HistoryProduct[]>('common/recommend/guessLike', { size: 10 }).catch(() => []),
    ])
      .then(([profile, counts, browsing, guess]) => {
        setInfo(profile || {});
        setOrderNum(counts || {});
        setHistory(Array.isArray(browsing) ? browsing.slice(0, 5) : []);
        const guessList = Array.isArray(guess) ? guess : (guess?.records || []);
        setRecommended(Array.isArray(guessList) ? guessList.slice(0, 10) : []);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <Card className="member-card">
        <Skeleton.Title />
        <Skeleton.Paragraph rows={4} />
      </Card>
    );
  }

  if (needLogin) {
    return (
      <Card className="cart-state">
        <h2>登录后进入会员中心</h2>
        <p>查看订单、优惠券、地址、积分与个人资料。</p>
        <Link href="/login?redirect=/member">
          <Button theme="solid" type="primary" size="large">去登录</Button>
        </Link>
      </Card>
    );
  }

  const count = (value?: number) => (value ? value : '-');

  return (
    <div className="member-layout">
      <aside className="member-side">
        <Card className="member-side__profile">
          <Avatar size="large" src={info?.avatar}>
            {(info?.nickname || info?.username || '会').slice(0, 1)}
          </Avatar>
          <div>
            <b>{info?.nickname || info?.username || '会员'}</b>
            <span>{info?.mobile || '欢迎回来'}</span>
          </div>
          {info?.rankIco ? <img src={info.rankIco} alt="" style={{ width: 20 }} /> : null}
          {info?.rankName ? <Tag color="orange">{info.rankName}</Tag> : null}
          {Number(info?.isCompanyAuth) > 0 ? <Tag color="green">已实名</Tag> : null}
        </Card>
        <div style={{ display: 'flex', gap: 8, margin: '12px 0' }}>
          <Link href="/member/profile" style={{ flex: 1 }}>
            <Button block size="small">编辑个人资料</Button>
          </Link>
          <Link href="/member/security" style={{ flex: 1 }}>
            <Button block size="small">账户安全</Button>
          </Link>
        </div>
        <nav className="member-side__nav">
          {MEMBER_NAV.map((item) => (
            <Link key={item.href} href={item.href} className="member-side__nav-item">
              <IconUser />
              <span>{item.label}</span>
              <IconArrowRight />
            </Link>
          ))}
        </nav>
      </aside>

      <div className="member-main">
        <Card className="member-card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', background: '#f2f4f7', alignItems: 'center', justifyContent: 'center' }}>
                {info?.avatar ? (
                  <img src={info.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <Avatar size="large">{(info?.nickname || '会').slice(0, 1)}</Avatar>
                )}
              </div>
              <div>
                <b style={{ fontSize: 18 }}>{info?.nickname || info?.username || '会员'}</b>
                <div style={{ color: '#98a2b3', fontSize: 13, marginTop: 4 }}>{info?.mobile || ''}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Link href="/member/address"><Button size="small">我的地址</Button></Link>
              <Link href="/member/profile"><Button size="small">编辑资料</Button></Link>
              <Link href="/member/security"><Button size="small">账户安全</Button></Link>
            </div>
          </div>
        </Card>

        <Card className="member-card" title="我的订单">
          <div className="member-order-shortcuts">
            {ORDER_SHORTCUTS.map((item) => (
              <Link key={item.key} href={item.href} className="member-order-shortcut">
                <b>{count(orderNum[item.key])}</b>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
          <div className="member-card__more">
            <Link href="/member/order/list">
              <IconOrderedList /> 查看全部订单 <IconArrowRight />
            </Link>
          </div>
        </Card>

        <div className="member-stats">
          <Card className="member-stat">
            <span>优惠券</span>
            <b>{count(info?.awaitCoupon)}</b>
            <Link href="/member/coupon" style={{ fontSize: 12 }}>查看优惠券</Link>
          </Card>
          <Card className="member-stat">
            <span>账户余额</span>
            <b>¥ {Number(info?.balance || 0).toFixed(2)}</b>
            <Link href="/member/balance" style={{ fontSize: 12 }}>查看余额</Link>
          </Card>
          <Card className="member-stat">
            <span>积分</span>
            <b>{Number(info?.points || 0)}</b>
            <Link href="/member/points" style={{ fontSize: 12 }}>查看积分</Link>
          </Card>
        </div>

        <Card className="member-card" title="最近浏览">
          {history.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
              {history.map((item) => (
                <Link key={item.productId} href={`/product/${item.productId}`} style={{ display: 'block', color: 'inherit' }}>
                  <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#f7f8fa', borderRadius: 8, overflow: 'hidden' }}>
                    {item.picThumb ? <img src={item.picThumb} alt={item.productName || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.productName || ''}</div>
                  <div style={{ color: '#e1251b', fontSize: 13 }}>¥ {Number(item.productPrice || 0).toFixed(2)}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ color: '#98a2b3', fontSize: 13 }}>暂无浏览记录</div>
          )}
          <div className="member-card__more">
            <Link href="/member/browsingHistory">查看全部浏览记录 <IconArrowRight /></Link>
          </div>
        </Card>

        {/* 源码 pages/member/index.vue 末尾 ProdSwiper titleName="精选好物" */}
        <Card className="member-card" title="精选好物">
          {recommended.length ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
              {recommended.map((item) => (
                <Link key={item.productId} href={`/product/${item.productId}`} style={{ display: 'block', color: 'inherit' }}>
                  <div style={{ width: '100%', aspectRatio: '1 / 1', background: '#f7f8fa', borderRadius: 8, overflow: 'hidden' }}>
                    {item.picThumb ? <img src={item.picThumb} alt={item.productName || ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : null}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.productName || ''}</div>
                  <div style={{ color: '#e1251b', fontSize: 13 }}>¥ {Number(item.productPrice || 0).toFixed(2)}</div>
                </Link>
              ))}
            </div>
          ) : (
            <div style={{ color: '#98a2b3', fontSize: 13 }}>暂无推荐商品</div>
          )}
        </Card>
      </div>
    </div>
  );
}

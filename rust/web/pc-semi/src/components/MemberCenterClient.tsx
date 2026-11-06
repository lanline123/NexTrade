'use client';

/**
 * 会员中心
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/index.vue
 * 结构（原版）：
 *   .infout      头像 60 + 昵称 28px + 等级/认证 + 入口（编辑个人资料 / 账户 / 我的地址）
 *   .userTotu    浅灰底卡片行：我的订单标题块 + 待付款 / 待收货 / 评论 / 售后 计数块（224×60 白卡）
 *   .userBottom  三张浅灰卡：优惠券 N / 心愿单 / 浏览记录
 *   ProdSwiper   精选好物
 * 接口：user/user/memberCenter、user/order/orderNum、user/user/historyProduct、common/recommend/guessLike
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Button, Card, Skeleton, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import Coupon from '@icon-park/react/es/icons/Coupon';
import Heart from '@icon-park/react/es/icons/Heart';
import History from '@icon-park/react/es/icons/History';
import Right from '@icon-park/react/es/icons/Right';
import Order from '@icon-park/react/es/icons/Order';
import ShoppingCart from '@icon-park/react/es/icons/ShoppingCart';

interface MemberCenterInfo {
  userId?: number;
  nickname?: string;
  avatar?: string;
  rankIco?: string;
  isCompanyAuth?: number;
  awaitCoupon?: number;
  balance?: number;
  points?: number;
  coupon?: number;
}

interface OrderNum {
  awaitPay?: number;
  awaitReceived?: number;
  awaitComment?: number;
  awaitAftersalesCollect?: number;
  awaitAftersales?: number;
}

interface HistoryProduct {
  productId?: number;
  productName?: string;
  picThumb?: string;
  productPrice?: number | string;
}

function count(value: unknown): string {
  const num = Number(value || 0);
  return num > 0 ? String(num) : '-';
}

export default function MemberCenterClient() {
  const [info, setInfo] = useState<MemberCenterInfo>({});
  const [orderNum, setOrderNum] = useState<OrderNum>({});
  const [recommend, setRecommend] = useState<HistoryProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);

  useEffect(() => {
    Promise.all([
      apiGet<MemberCenterInfo>('user/user/memberCenter'),
      apiGet<OrderNum>('user/order/orderNum').catch(() => ({})),
      apiGet<{ records?: HistoryProduct[] } | HistoryProduct[]>('common/recommend/guessLike', { page: 1, size: 8 }).catch(() => []),
    ])
      .then(([profile, counts, guess]) => {
        setInfo(profile || {});
        setOrderNum(counts || {});
        const list = Array.isArray(guess) ? guess : (guess?.records || []);
        setRecommend(Array.isArray(list) ? list.slice(0, 8) : []);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
        Toast.error({ content: message || '会员信息加载失败' });
      })
      .finally(() => setLoading(false));
  }, []);

  /** 精选好物快捷加购 */
  const addToCart = async (productId?: number) => {
    if (!productId) return;
    try {
      await apiPost('cart/cart/addToCart', { id: productId, number: 1 });
      Toast.success({ content: '已加入购物车' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '加入购物车失败' });
    }
  };

  if (loading) {
    return (
      <div className="mc-skeleton">
        <div className="mc-skeleton__user"><Skeleton.Avatar size="large" /><Skeleton.Title style={{ width: 180 }} /><Skeleton.Paragraph rows={1} style={{ width: 320 }} /></div>
        <div className="mc-skeleton__row">{[0, 1, 2, 3].map((i) => <Skeleton.Title key={i} style={{ width: '100%', height: 60 }} />)}</div>
        <div className="mc-skeleton__row">{[0, 1, 2].map((i) => <Skeleton.Title key={i} style={{ width: '100%', height: 64 }} />)}</div>
      </div>
    );
  }

  if (needLogin) {
    return (
      <Card className="mc-card mc-login">
        <h2>登录后查看会员中心</h2>
        <Link href="/login?redirect=/member" className="mc-login__btn">去登录</Link>
      </Card>
    );
  }

  return (
    <div className="mc">
      {/* 用户信息（原版 .infout） */}
      <section className="mc-user">
        <div className={`mc-user__avatar${info.avatar ? '' : ' is-empty'}`}>
          {info.avatar ? <img src={info.avatar} alt="" /> : <span>{(info.nickname || '会').slice(0, 1)}</span>}
        </div>
        <div className="mc-user__col">
          <div className="mc-user__name">
            <span>{info.nickname || '会员'}</span>
            {info.rankIco ? <img className="mc-user__rank" src={info.rankIco} alt="" /> : null}
            <span className={`mc-user__auth${Number(info.isCompanyAuth) > 0 ? ' is-verified' : ''}`}>
              {Number(info.isCompanyAuth) > 0 ? '已认证' : '未认证'}
            </span>
          </div>
          <div className="mc-user__links">
            <Link href="/member/profile">编辑个人资料</Link>
            <Link href="/member/security">账户</Link>
            <Link href="/member/address/list">我的地址</Link>
          </div>
        </div>
      </section>

      {/* 订单快捷入口（原版 .userTotu） */}
      <section className="mc-orders">
        <Link href="/member/order/list" className="mc-orders__title">
          <Order size={20} />
          <span>我的订单</span>
          <Right size={14} />
        </Link>
        <Link href="/member/order/list?status=awaitPay" className="mc-orders__item">
          <b>{count(orderNum.awaitPay)}</b>
          <span>待付款</span>
        </Link>
        <Link href="/member/order/list?status=awaitReceived" className="mc-orders__item">
          <b>{count(orderNum.awaitReceived)}</b>
          <span>待收货</span>
        </Link>
        <Link href="/member/comment/list" className="mc-orders__item">
          <b>{count(orderNum.awaitComment)}</b>
          <span>评论</span>
        </Link>
        <Link href="/member/return/log" className="mc-orders__item">
          <b>{count(orderNum.awaitAftersalesCollect ?? orderNum.awaitAftersales)}</b>
          <span>售后</span>
        </Link>
      </section>

      {/* 三张快捷卡（原版 .userBottom） */}
      <section className="mc-cards">
        <Link href="/member/coupon/list" className="mc-cards__item">
          <div className="mc-cards__top">
            <span className="mc-cards__label"><Coupon size={20} />优惠券 <em>{count(info.awaitCoupon ?? info.coupon)}</em></span>
            <Right size={14} />
          </div>
          <div className="mc-cards__sub">查看优惠券</div>
        </Link>
        <Link href="/member/collectProduct/list" className="mc-cards__item">
          <div className="mc-cards__top">
            <span className="mc-cards__label"><Heart size={20} />心愿单</span>
            <Right size={14} />
          </div>
          <div className="mc-cards__sub">查看心愿单</div>
        </Link>
        <Link href="/member/browsingHistory/list" className="mc-cards__item">
          <div className="mc-cards__top">
            <span className="mc-cards__label"><History size={20} />浏览记录</span>
            <Right size={14} />
          </div>
          <div className="mc-cards__sub">查看浏览记录</div>
        </Link>
      </section>

      {/* 精选好物（原版 ProdSwiper） */}
      {recommend.length ? (
        <section className="mc-recommend">
          <h2 className="mc-recommend__title">精选好物</h2>
          <div className="mc-recommend__grid">
            {recommend.map((row) => (
              <Link className="mc-recommend__card" key={row.productId} href={`/product/${row.productId}`}>
                <div className="mc-recommend__img">
                  {row.picThumb ? <img src={row.picThumb} alt={row.productName || ''} loading="lazy" /> : null}
                </div>
                <div className="mc-recommend__name">{row.productName || '商品'}</div>
                <div className="mc-recommend__foot">
                  <span className="mc-recommend__price">¥ {Number(row.productPrice || 0).toFixed(2)}</span>
                  <Button
                    size="small"
                    theme="light"
                    type="primary"
                    icon={<ShoppingCart size={14} />}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      void addToCart(row.productId);
                    }}
                  />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

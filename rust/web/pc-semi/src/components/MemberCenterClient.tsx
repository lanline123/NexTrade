'use client';

/**
 * 会员中心（现代化仪表盘改版）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/index.vue
 * 样式：app/member-home.scss（.mh-*，手工维护；替代旧 .mc-* 结构）
 *
 * 设计语言（与登录页毛玻璃改版一致）：
 *   .mh-hero      主题渐变欢迎横幅：头像 + 昵称/认证徽章 + 时段问候 +
 *                 资产统计（余额/积分/优惠券）+ 资料快捷入口（ghost 胶囊）
 *   .mh-card      白卡「我的订单」：卡头（全部订单 →）+ 待付款/待收货/评论/售后 四状态块
 *   .mh-card      白卡「快捷入口」：优惠券/心愿单/浏览记录/我的地址/账户安全/发票申请 六宫格
 *   .mh-recommend 精选好物：getProductIds → product/product/list，12/页 + 滚动加载（沿用 ProductCard）
 *
 * 数据与逻辑未改动，接口与旧版一一对应：
 * user/user/memberCenter、user/order/orderNum、common/config/base、
 * common/recommend/getProductIds、product/product/list。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, Skeleton, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';
import Coupon from '@icon-park/react/es/icons/Coupon';
import Heart from '@icon-park/react/es/icons/Heart';
import History from '@icon-park/react/es/icons/History';
import Right from '@icon-park/react/es/icons/Right';
import Wallet from '@icon-park/react/es/icons/Wallet';
import Truck from '@icon-park/react/es/icons/Truck';
import Comments from '@icon-park/react/es/icons/Comments';
import HeadsetOne from '@icon-park/react/es/icons/HeadsetOne';
import SettingTwo from '@icon-park/react/es/icons/SettingTwo';
import Security from '@icon-park/react/es/icons/Security';
import Bill from '@icon-park/react/es/icons/Bill';
import User from '@icon-park/react/es/icons/User';
import Point from '@icon-park/react/es/icons/Point';
import ProductCard from '@/components/product/ProductCard';
import { useProductColumns } from '@/components/product/use-product-columns';
import '@/components/product/product-card.scss';

import { useTranslation } from 'react-i18next';
/** 原版 ProdSwiper 的 PAGE_SIZE */
const PAGE_SIZE = 12;
/** 原版 utils/util.ts isB2B()：跨境 B2C 构建为 false，企业认证徽章不渲染 */
const IS_B2B = process.env.NEXT_PUBLIC_PC_B2B === '1';

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

interface RecommendProduct {
  productId?: number;
  productName?: string;
  picThumb?: string;
  productPrice?: number | string;
}

/** 金额展示：保留两位小数（余额） */
function money(value: unknown): string {
  const num = Number(value || 0);
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

/** 时段问候（useEffect 里计算，避免 SSR/CSR 渲染结果不一致） */
function greetingByHour(hour: number): string {
  if (hour < 6) return '夜深了';
  if (hour < 9) return '早上好';
  if (hour < 12) return '上午好';
  if (hour < 14) return '中午好';
  if (hour < 18) return '下午好';
  return '晚上好';
}

export default function MemberCenterClient() {
    const { t } = useTranslation();
  const [info, setInfo] = useState<MemberCenterInfo>({});
  const [orderNum, setOrderNum] = useState<OrderNum>({});
  const [recommend, setRecommend] = useState<RecommendProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [recommendLoading, setRecommendLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  /** D1146：评价总开关（原版 commonStore.productCommentEnabled） */
  const [commentEnabled, setCommentEnabled] = useState(1);
  /** 原版 commonStore.closeAuth：B2B 认证入口开关 */
  const [closeAuth, setCloseAuth] = useState(0);
  /** 时段问候（客户端挂载后计算，默认空不渲染问候行） */
  const [greeting, setGreeting] = useState('');
  const pageRef = useRef(0);
  const idsRef = useRef('');
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setGreeting(greetingByHour(new Date().getHours()));
  }, []);

  useEffect(() => {
    Promise.all([
      apiGet<MemberCenterInfo>('user/user/memberCenter'),
      apiGet<OrderNum>('user/order/orderNum').catch(() => ({})),
    ])
      .then(([profile, counts]) => {
        setInfo(profile || {});
        setOrderNum(counts || {});
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
        Toast.error({ content: message || t('会员信息加载失败') });
      })
      .finally(() => setLoading(false));
  }, []);

  /** 站点配置：评价开关 + 认证入口开关（与原版 commonStore 对齐） */
  useEffect(() => {
    apiGet<Record<string, any>>('common/config/base')
      .then((base) => {
        setCommentEnabled(Number(base?.productCommentEnabled ?? 1));
        setCloseAuth(Number(base?.closeAuth ?? 0));
      })
      .catch(() => undefined);
  }, []);

  /**
   * 精选好物（原版 ProdSwiper）：先取推荐 ID，再按页取商品；
   * 每页 12 条，滚到底部自动加载下一页，末页不足一页即停。
   */
  const loadRecommend = useCallback(async (nextPage: number) => {
    if (loadingRef.current || nextPage < 1) return;
    loadingRef.current = true;
    setRecommendLoading(true);
    try {
      if (!idsRef.current) {
        const idResult = await apiGet<number[] | string>('common/recommend/getProductIds');
        const raw = Array.isArray(idResult) ? idResult : String(idResult || '').split(',');
        idsRef.current = raw.map((item) => String(item).trim()).filter(Boolean).join(',');
      }
      if (!idsRef.current) {
        setHasMore(false);
        return;
      }
      const result = await apiGet<{ records?: RecommendProduct[]; total?: number }>('product/product/list', {
        page: nextPage,
        size: PAGE_SIZE,
        ids: idsRef.current,
      });
      const records = result?.records || [];
      pageRef.current = nextPage;
      setRecommend((prev) => (nextPage === 1 ? records : [...prev, ...records]));
      const total = Number(result?.total || 0);
      const loaded = (nextPage - 1) * PAGE_SIZE + records.length;
      setHasMore(records.length >= PAGE_SIZE && (total === 0 || loaded < total));
    } catch {
      // 推荐位失败不影响会员中心主流程
      setHasMore(false);
    } finally {
      loadingRef.current = false;
      setRecommendLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRecommend(1);
  }, [loadRecommend]);

  /** 滚动到底部加载下一页 */
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadRecommend(pageRef.current + 1);
      },
      { rootMargin: '240px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, loadRecommend, recommend.length]);

  /** 精选好物快捷加购由 ProductCard 内部处理，列数走 useProductColumns 统一口径 */
  const recommendGridRef = useRef<HTMLDivElement | null>(null);
  const recommendColumns = useProductColumns(recommendGridRef);

  if (loading) {
    return (
      <div className="mh-skeleton">
        <div className="mh-skeleton__hero"><Skeleton.Avatar size="large" /><Skeleton.Title style={{ width: 200 }} /><Skeleton.Paragraph rows={1} style={{ width: 360 }} /></div>
        <div className="mh-skeleton__row">{[0, 1, 2, 3].map((i) => <Skeleton.Title key={i} style={{ width: '100%', height: 88 }} />)}</div>
        <div className="mh-skeleton__row">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton.Title key={i} style={{ width: '100%', height: 72 }} />)}</div>
      </div>
    );
  }

  if (needLogin) {
    return (
      <Card className="mh-login">
        <h2>{t('登录后查看会员中心')}</h2>
        <Link href="/login?redirect=/member" className="mh-login__btn">{t('去登录')}</Link>
      </Card>
    );
  }

  const verified = Number(info.isCompanyAuth) > 0;
  // 原版：v-if="isB2B() && commonStore.closeAuth === 1"
  const showAuthBadge = IS_B2B && closeAuth === 1;

  return (
    <div className="mh">
      {/* ---------------- 欢迎横幅：问候 + 资产 + 资料入口 ---------------- */}
      <section className="mh-hero">
        <span className="mh-hero__deco mh-hero__deco--1" aria-hidden />
        <span className="mh-hero__deco mh-hero__deco--2" aria-hidden />
        <div className="mh-hero__user">
          <div className={`mh-hero__avatar${info.avatar ? '' : ' is-empty'}`}>
            {info.avatar ? <img src={info.avatar} alt="" /> : <span>{(info.nickname || t('会')).slice(0, 1)}</span>}
          </div>
          <div className="mh-hero__who">
            <div className="mh-hero__name">
              <span>{info.nickname || t('会员')}</span>
              {info.rankIco ? <img className="mh-hero__rank" src={info.rankIco} alt="" /> : null}
              {showAuthBadge ? (
                <Link
                  href="/member/usercertification/info"
                  className={`mh-hero__auth${verified ? ' is-verified' : ''}`}
                  title={verified ? t('已认证') : '未认证'}
                >
                  <i className="mh-hero__auth-ico" aria-hidden="true">
                    <svg viewBox="0 0 48 48" aria-hidden="true">
                      <path d="M12.5 15h6.3l9.2 15.6L25.2 36z" fill="#fff" />
                      <path d="M32.2 15h5.4l-7 12.8-3-5.4z" fill="#fff" />
                    </svg>
                  </i>
                  <span>{verified ? t('已认证') : '未认证'}</span>
                </Link>
              ) : null}
            </div>
            <div className="mh-hero__greeting">
              {greeting ? <span>{t(greeting)}，</span> : null}
              <span>{t('欢迎回来')}</span>
            </div>
            <div className="mh-hero__links">
              <Link href="/member/profile" className="mh-hero__link"><User size={15} />{t('编辑个人资料')}</Link>
              <Link href="/member/security" className="mh-hero__link"><Security size={15} />{t('账户安全')}</Link>
              <Link href="/member/address/list" className="mh-hero__link"><SettingTwo size={15} />{t('我的地址')}</Link>
            </div>
          </div>
        </div>

        {/* 资产统计（可点击跳转对应页面） */}
        <div className="mh-hero__assets">
          <Link href="/member/account/detail" className="mh-hero__asset">
            <b>¥ {money(info.balance)}</b>
            <span>{t('账户余额')}</span>
          </Link>
          <Link href="/member/point/list" className="mh-hero__asset">
            <b>{Number(info.points || 0)}</b>
            <span>{t('我的积分')}</span>
          </Link>
          <Link href="/member/coupon/list" className="mh-hero__asset">
            <b>{Number(info.coupon || info.awaitCoupon || 0)}</b>
            <span>{t('优惠券')}</span>
          </Link>
        </div>
      </section>

      {/* ---------------- 我的订单：四状态块 ---------------- */}
      <section className="mh-card">
        <div className="mh-card__head">
          <span className="mh-card__title"><Wallet size={18} />{t('我的订单')}</span>
          <Link href="/member/order/list" className="mh-card__more">{t('全部订单')}<Right size={13} /></Link>
        </div>
        <div className="mh-orders">
          <Link href="/member/order/list?type=awaitPay" className="mh-orders__item">
            <span className="mh-orders__ico">
              <Wallet size={24} />
              {Number(orderNum.awaitPay || 0) > 0 ? <em>{Number(orderNum.awaitPay)}</em> : null}
            </span>
            <span className="mh-orders__label">{t('待付款')}</span>
          </Link>
          <Link href="/member/order/list?type=awaitReceived" className="mh-orders__item">
            <span className="mh-orders__ico">
              <Truck size={24} />
              {Number(orderNum.awaitReceived || 0) > 0 ? <em>{Number(orderNum.awaitReceived)}</em> : null}
            </span>
            <span className="mh-orders__label">{t('待收货')}</span>
          </Link>
          {/* D1146：评价功能关闭时不展示「评论」入口 */}
          {commentEnabled === 1 ? (
            <Link href="/member/comment/list" className="mh-orders__item">
              <span className="mh-orders__ico">
                <Comments size={24} />
                {Number(orderNum.awaitComment || 0) > 0 ? <em>{Number(orderNum.awaitComment)}</em> : null}
              </span>
              <span className="mh-orders__label">{t('待评价')}</span>
            </Link>
          ) : null}
          <Link href="/member/return/log" className="mh-orders__item">
            <span className="mh-orders__ico">
              <HeadsetOne size={24} />
              {Number(orderNum.awaitAftersalesCollect ?? (orderNum.awaitAftersales || 0)) > 0 ? (
                <em>{Number(orderNum.awaitAftersalesCollect ?? orderNum.awaitAftersales)}</em>
              ) : null}
            </span>
            <span className="mh-orders__label">{t('退换/售后')}</span>
          </Link>
        </div>
      </section>

      {/* ---------------- 快捷入口：六宫格 ---------------- */}
      <section className="mh-card">
        <div className="mh-card__head">
          <span className="mh-card__title"><Point size={18} />{t('常用服务')}</span>
        </div>
        <div className="mh-quick">
          <Link href="/member/coupon/list" className="mh-quick__item">
            <span className="mh-quick__ico"><Coupon size={22} /></span>
            <span className="mh-quick__label">{t('优惠券')}</span>
          </Link>
          <Link href="/member/collectproduct/list" className="mh-quick__item">
            <span className="mh-quick__ico"><Heart size={22} /></span>
            <span className="mh-quick__label">{t('心愿单')}</span>
          </Link>
          <Link href="/member/browsinghistory/list" className="mh-quick__item">
            <span className="mh-quick__ico"><History size={22} /></span>
            <span className="mh-quick__label">{t('浏览记录')}</span>
          </Link>
          <Link href="/member/address/list" className="mh-quick__item">
            <span className="mh-quick__ico"><SettingTwo size={22} /></span>
            <span className="mh-quick__label">{t('我的地址')}</span>
          </Link>
          <Link href="/member/security" className="mh-quick__item">
            <span className="mh-quick__ico"><Security size={22} /></span>
            <span className="mh-quick__label">{t('账户安全')}</span>
          </Link>
          <Link href="/member/orderinvoice/list" className="mh-quick__item">
            <span className="mh-quick__ico"><Bill size={22} /></span>
            <span className="mh-quick__label">{t('发票申请')}</span>
          </Link>
        </div>
      </section>

      {/* ---------------- 精选好物（原版 ProdSwiper）—— 商品卡统一走 ProductCard ---------------- */}
      {recommend.length ? (
        <section className="mh-recommend">
          <h2 className="com-pc-title">{t('精选好物')}</h2>
          <div
            className="product-card-grid"
            ref={recommendGridRef}
            style={{ '--you-like-columns': recommendColumns } as React.CSSProperties}
          >
            {recommend.map((row, index) => (
              <ProductCard key={`${row.productId}-${index}`} product={row} />
            ))}
          </div>
          <div ref={sentinelRef} className="mh-recommend__more">
            {recommendLoading ? <span>{t('加载中…')}</span> : hasMore ? <span>{t('上滑加载更多')}</span> : <span>{t('没有更多喽~')}</span>}
          </div>
        </section>
      ) : null}
    </div>
  );
}

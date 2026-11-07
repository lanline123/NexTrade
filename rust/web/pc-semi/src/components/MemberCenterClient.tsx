'use client';

/**
 * 会员中心
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/index.vue
 * 结构（原版）：
 *   .infout      头像 60 + 昵称 28px + 等级/认证 + 入口（编辑个人资料 / 账户 / 我的地址）
 *   .userTotu    浅灰底卡片行：我的订单标题块 + 待付款 / 待收货 / 评论 / 售后 计数块（224×60 白卡）
 *   .userBottom  三张浅灰卡：优惠券 N / 心愿单 / 浏览记录
 *   ProdSwiper   精选好物：getProductIds → product/product/list，12/页 + 滚动加载
 * 接口：user/user/memberCenter、user/order/orderNum、common/config/base、
 *       common/recommend/getProductIds、product/product/list
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Card, Skeleton, Toast } from '@douyinfe/semi-ui';
import { apiGet } from '@/lib/client-api';
import Coupon from '@icon-park/react/es/icons/Coupon';
import Heart from '@icon-park/react/es/icons/Heart';
import History from '@icon-park/react/es/icons/History';
import Right from '@icon-park/react/es/icons/Right';
import Order from '@icon-park/react/es/icons/Order';
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

function count(value: unknown): string {
  const num = Number(value || 0);
  return num > 0 ? String(num) : '-';
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
  const pageRef = useRef(0);
  const idsRef = useRef('');
  const loadingRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

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
        <h2>{t('登录后查看会员中心')}</h2>
        <Link href="/login?redirect=/member" className="mc-login__btn">{t('去登录')}</Link>
      </Card>
    );
  }

  const verified = Number(info.isCompanyAuth) > 0;
  // 原版：v-if="isB2B() && commonStore.closeAuth === 1"
  const showAuthBadge = IS_B2B && closeAuth === 1;

  return (
    <div className="mc">
      {/* 用户信息（原版 .infout） */}
      <section className="mc-user">
        <div className={`mc-user__avatar${info.avatar ? '' : ' is-empty'}`}>
          {info.avatar ? <img src={info.avatar} alt="" /> : <span>{(info.nickname || t('会')).slice(0, 1)}</span>}
        </div>
        <div className="mc-user__col">
          <div className="mc-user__name">
            <span>{info.nickname || t('会员')}</span>
            {info.rankIco ? <img className="mc-user__rank" src={info.rankIco} alt="" /> : null}
            {showAuthBadge ? (
              <Link
                href="/member/userCertification/info"
                className={`mc-user__auth${verified ? ' is-verified' : ''}`}
                title={verified ? t('已认证') : '未认证'}
              >
                <i className="mc-user__auth-ico" aria-hidden="true">
                  <svg viewBox="0 0 48 48" aria-hidden="true">
                    <path d="M12.5 15h6.3l9.2 15.6L25.2 36z" fill="#fff" />
                    <path d="M32.2 15h5.4l-7 12.8-3-5.4z" fill="#fff" />
                  </svg>
                </i>
                <span>{verified ? t('已认证') : '未认证'}</span>
              </Link>
            ) : null}
          </div>
          <div className="mc-user__links">
            <Link href="/member/profile">{t('编辑个人资料')}</Link>
            <Link href="/member/security">{t('账户')}</Link>
            <Link href="/member/address/list">{t('我的地址')}</Link>
          </div>
        </div>
      </section>

      {/* 订单快捷入口（原版 .userTotu） */}
      <section className="mc-orders">
        <Link href="/member/order/list" className="mc-orders__title">
          <Order size={20} />
          <span>{t('我的订单')}</span>
          <Right size={14} />
        </Link>
        <Link href="/member/order/list?type=awaitPay" className="mc-orders__item">
          <b>{count(orderNum.awaitPay)}</b>
          <span>{t('待付款')}</span>
        </Link>
        <Link href="/member/order/list?type=awaitReceived" className="mc-orders__item">
          <b>{count(orderNum.awaitReceived)}</b>
          <span>{t('待收货')}</span>
        </Link>
        {/* D1146：评价功能关闭时不展示「评论」入口 */}
        {commentEnabled === 1 ? (
          <Link href="/member/comment/list" className="mc-orders__item">
            <b>{count(orderNum.awaitComment)}</b>
            <span>{t('评论')}</span>
          </Link>
        ) : null}
        <Link href="/member/return/log" className="mc-orders__item">
          <b>{count(orderNum.awaitAftersalesCollect ?? orderNum.awaitAftersales)}</b>
          <span>{t('售后')}</span>
        </Link>
      </section>

      {/* 三张快捷卡（原版 .userBottom） */}
      <section className="mc-cards">
        <Link href="/member/coupon/list" className="mc-cards__item">
          <div className="mc-cards__top">
            <span className="mc-cards__label"><Coupon size={20} />{t('优惠券')}<em>{count(info.awaitCoupon ?? info.coupon)}</em></span>
            <Right size={14} />
          </div>
          <div className="mc-cards__sub">{t('查看优惠券')}</div>
        </Link>
        <Link href="/member/collectProduct/list" className="mc-cards__item">
          <div className="mc-cards__top">
            <span className="mc-cards__label"><Heart size={20} />{t('心愿单')}</span>
            <Right size={14} />
          </div>
          <div className="mc-cards__sub">{t('查看心愿单')}</div>
        </Link>
        <Link href="/member/browsingHistory/list" className="mc-cards__item">
          <div className="mc-cards__top">
            <span className="mc-cards__label"><History size={20} />{t('浏览记录')}</span>
            <Right size={14} />
          </div>
          <div className="mc-cards__sub">{t('查看浏览记录')}</div>
        </Link>
      </section>

      {/* 精选好物（原版 ProdSwiper）—— 商品卡统一走 ProductCard */}
      {recommend.length ? (
        <section className="mc-recommend">
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
          <div ref={sentinelRef} className="mc-recommend__more">
            {recommendLoading ? <span>{t('加载中…')}</span> : hasMore ? <span>{t('上滑加载更多')}</span> : <span>{t('没有更多喽~')}</span>}
          </div>
        </section>
      ) : null}
    </div>
  );
}

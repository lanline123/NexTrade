'use client';

/**
 * 浏览历史（PC 会员中心）—— 忠实迁移版
 *
 * 设计决策（2026-11-08，用户验收结论）：本页与收藏商品页是旧版的姐妹页
 * （同一 ProductCard 卡片 + .collect-list-content 响应式栅格），自造现代卡片
 * 两版均不如原版好看，最终以收藏页同款结构 + 类名迁移，视觉与心愿单完全一致。
 *
 * 功能：
 * - 足迹加载（user/user/historyProduct，size 15，兼容 records 包装与裸数组）
 * - 删除足迹（user/user/delHistoryProduct { ids }——注意旧版误调 delCollectProduct，这里用正确接口）
 * - 卡片加购（cart/cart/addToCart { id, number }，与 ProductGrid 一致）
 * - 未登录空态 + 足迹空态；响应式栅格（min 240px / gap 8 / 4~6 列）
 * - 原版分页已注释（size 15 一屏），保持一致不渲染分页
 *
 * 结构：与 CollectProductClient 相同的 .collect-card 卡片（member-pages.scss 全局样式，
 * 本页 wrapper 挂 .mp-collect-product 以复用其作用域），数据字段做精简映射。
 */
import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';

import { currencySymbol } from '@/lib/currency';
const GRID_GAP = 8;
const CARD_MIN_WIDTH = 240;
const MIN_COLUMNS = 4;
const MAX_COLUMNS = 6;

interface HistoryProduct {
  productId: number;
  productName?: string;
  picThumb?: string;
  productPrice?: string | number;
  price?: string | number;
}

function imageUrl(src?: string): string {
  if (!src) return '';
  if (/^(https?:)?\/\//i.test(src) || src.startsWith('/') || src.startsWith('data:')) return src;
  return `/static/${src.replace(/^\/+/, '')}`;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (value === undefined || value === null || value === '') continue;
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return null;
}

function splitPrice(value: number | null): { int: string; dec: string } {
  if (value === null) return { int: '--', dec: '' };
  const [int, dec] = value.toFixed(2).split('.');
  return { int: Number(int).toLocaleString('zh-CN'), dec };
}

export default function BrowsingHistoryClient() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<HistoryProduct[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [openMore, setOpenMore] = useState<string | null>(null);
  const [columns, setColumns] = useState(MIN_COLUMNS);
  const gridRef = useRef<HTMLDivElement | null>(null);
  /** 对应原版 requestGeneration：删除并发时只接受最后一次响应 */
  const generation = useRef(0);
  const size = 15;

  /** 对应原版 useResponsiveGridColumns：按容器实际宽度推导 CSS 变量 --collect-columns */
  useEffect(() => {
    const element = gridRef.current;
    if (!element) return;
    const update = () => {
      const width = element.clientWidth;
      if (width <= 0) return;
      const next = Math.floor((width + GRID_GAP) / (CARD_MIN_WIDTH + GRID_GAP));
      setColumns(Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, next)));
    };
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  /** 点击卡片空白处收起「更多」气泡 */
  useEffect(() => {
    if (!openMore) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target?.closest('[data-collect-more]')) setOpenMore(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [openMore]);

  const load = () => {
    const current = ++generation.current;
    setLoading(true);
    apiGet<{ records?: HistoryProduct[]; total?: number } | HistoryProduct[]>('user/user/historyProduct', { page: 1, size })
      .then((result) => {
        if (current !== generation.current) return;
        if (Array.isArray(result)) {
          setRows(result);
          setTotal(result.length);
        } else {
          setRows(result?.records || []);
          setTotal(Number(result?.total || 0));
        }
        setNeedLogin(false);
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : '';
        setNeedLogin(message.includes('登录') || message.includes('401'));
      })
      .finally(() => {
        if (current === generation.current) setLoading(false);
      });
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = async (productId: number) => {
    try {
      await apiPost('user/user/delHistoryProduct', { ids: [productId] });
      Toast.success({ content: t('已删除足迹') });
      load();
    } catch {
      Toast.error({ content: t('删除失败') });
    }
  };

  const addToCart = async (event: React.MouseEvent, item: HistoryProduct) => {
    event.stopPropagation();
    try {
      await apiPost('cart/cart/addToCart', { id: item.productId, number: 1 });
      Toast.success({ content: t('已加入购物车') });
      window.dispatchEvent(new Event('cart-changed'));
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : t('加入购物车失败') });
    }
  };

  const gridStyle = { '--collect-columns': columns } as CSSProperties;

  if (needLogin) {
    return (
      <div className="info-row collect-product mp-collect-product mp-browsing-list">
        <div className="title-or-tabs"><span className="card-title">{t('浏览历史')}</span></div>
        <div className="page-body">
          <div className="no-result">
            <div className="empty">
              <img className="empty-img" src="/assets/images/empty-box.png" alt="" />
              <div className="empty-text">{t('登录后查看浏览历史')}</div>
              <Link className="mp-browsing-list__login" href="/login?redirect=/member/browsinghistory">{t('去登录')}</Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="info-row collect-product mp-collect-product mp-browsing-list">
      <div className="title-or-tabs">
        <span className="card-title">{t('浏览历史')}</span>
        {total > 0 ? <span className="collect-product__count">{t('共 {n} 件商品', { n: total })}</span> : null}
      </div>
      <div className="page-body">
        <div className="collect-list-content" ref={gridRef} style={gridStyle}>
          {rows.map((item) => {
            const key = String(item.productId);
            const href = `/product/${item.productId}`;
            const name = item.productName || '';
            const pic = imageUrl(item.picThumb);
            const price = firstNumber(item.price, item.productPrice);
            const money = splitPrice(price);

            return (
              <article
                className="collect-card"
                key={key}
                onClick={() => {
                  // 「更多」气泡展开时，点空白先收气泡，不误跳商品页
                  if (openMore) { setOpenMore(null); return; }
                  window.open(href, '_blank', 'noopener,noreferrer');
                }}
              >
                <div className="collect-card__top">
                  <Link href={href} target="_blank" className="collect-card__pic" onClick={(event) => event.stopPropagation()}>
                    {pic ? (
                      <img src={pic} alt={name} loading="lazy" />
                    ) : (
                      <span className="collect-card__pic-empty" aria-hidden="true" />
                    )}
                  </Link>
                  <div className="collect-card__more" data-collect-more onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      aria-label={t('更多操作')}
                      aria-expanded={openMore === key}
                      onClick={() => setOpenMore((current) => (current === key ? null : key))}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                        <circle cx="4" cy="10" r="1.6" fill="currentColor" />
                        <circle cx="10" cy="10" r="1.6" fill="currentColor" />
                        <circle cx="16" cy="10" r="1.6" fill="currentColor" />
                      </svg>
                    </button>
                    {openMore === key ? (
                      <div className="collect-card__pop">
                        <button type="button" onClick={() => void remove(item.productId)}>{t('删除足迹')}</button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="collect-card__body">
                  <div className="collect-card__name">{name}</div>
                  {/* 旧版 ProductCard：.desc-wrap > .virtual-sales（历史接口无销量字段，按 0 展示） */}
                  <div className="collect-card__sales">{t('已售 {n}', { n: 0 })}</div>
                  {/* 旧版：拼团 tag 或 24px 占位，保证价格行起始高度一致 */}
                  <div className="collect-card__tag-slot" />
                  <div className="collect-card__price-row">
                    <div className="collect-card__price">
                      <span className="collect-card__currency">{currencySymbol()}</span>
                      <b>{money.int}</b>
                      {money.dec ? <span className="collect-card__decimals">.{money.dec}</span> : null}
                    </div>
                    <button
                      type="button"
                      className="collect-card__add"
                      aria-label={t('加入购物车')}
                      onClick={(event) => void addToCart(event, item)}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  {/* 旧版 .other-wrap：店铺名（绿色 14px/600；历史接口无店铺字段，回落官方自营） */}
                  <div className="collect-card__shop">{t('官方自营')}</div>
                </div>
              </article>
            );
          })}
          {!loading && !rows.length ? (
            <div className="no-result">
              <div className="empty">
                <img className="empty-img" src="/assets/images/empty-box.png" alt="" />
                <div className="empty-text">{t('您还没有留下任何足迹')}</div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

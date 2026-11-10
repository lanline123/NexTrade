'use client';

/**
 * 心愿单（收藏商品）列表 —— PC 会员中心
 *
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/collectproduct/List.vue
 *  - CommonPageContainer flex（左 MemberNav + 右内容）由外层 MemberShell 承担
 *  - title-or-tabs > card-title「心愿单」；page-body > collect-list-content 商品卡网格
 *  - useResponsiveGridColumns({ minCardWidth: 240, gap: 8, minColumns: 4, maxColumns: 6 })
 *  - ProductCard(:is-more=true) 右上角气泡「删除」→ 重新拉列表；卡片内圆钮加购
 *  - Pagination、空状态 empty-box.png「您还没有收藏的商品」
 *  - requestGeneration 防竞态；删除后重新 loadFilter
 *
 * 接口对照 Rust（crates/api/public/src/routes/member/collect_product.rs）：
 *  GET  /api/user/collectProduct/list    → { records, total }
 *  POST /api/user/collectProduct/cancel  → 入参 { productId }
 *       注意：Java 前端 collectProduct.ts 传 { id }，但 Rust CollectProductDTO 只认 productId。
 *  GET  /api/product/product/list?ids=   → 补价格 / 销量 / 库存
 *       原因：Rust CollectProductVO 当前只有 collectId/productId/shopId/addTime/productName/picThumb，
 *       比 Java CollectProductVO 少了 price/productPrice/productStock/virtualSales 等卡片字段。
 *       这里按 ids 批量补一次，接口失败时静默降级（价格显示 --），不阻塞列表。
 *  GET  /api/product/productStyle/batchActiveStyle?productIds= → 商品活动边框图
 *  POST /api/cart/cart/addToCart        → { id, number }，与 ProductGrid 一致
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent } from 'react';
import Link from 'next/link';
import { Spin, Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';

import { useTranslation } from 'react-i18next';
import { currencySymbol } from '@/lib/currency';
/** 后端默认 size=15（CollectListQuery::page_params），与原版不传 size 时一致 */
const PAGE_SIZE = 15;
const GRID_GAP = 8;
const CARD_MIN_WIDTH = 240;
const MIN_COLUMNS = 4;
const MAX_COLUMNS = 6;

interface CollectRow {
  collectId?: number;
  productId: number;
  productName?: string;
  picThumb?: string;
  picUrl?: string;
  productSn?: string;
  shopId?: number;
  shop?: { shopTitle?: string };
  shopTitle?: string;
  price?: string | number;
  productPrice?: string | number;
  productStock?: number;
  virtualSales?: number;
  sales?: number;
  productSku?: unknown[];
}

/** 商品列表补齐用的摘要（ProductVO） */
interface ProductBrief {
  productId: number;
  productName?: string;
  picThumb?: string;
  picUrl?: string;
  price?: string | number;
  productPrice?: string | number;
  productStock?: number;
  virtualSales?: number;
  sales?: number;
}

interface PageResult<T> {
  records?: T[];
  total?: number;
}

interface ActiveStyle {
  borderImage?: string;
  borderPic?: string;
  borderImageUrl?: string;
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

/** 原版 FormatPrice：¥ 小号，整数 28px 加粗，小数 16px */
function splitPrice(value: number | null): { int: string; dec: string } {
  if (value === null) return { int: '--', dec: '' };
  const [int, dec] = value.toFixed(2).split('.');
  return { int: Number(int).toLocaleString('zh-CN'), dec };
}

function parseStyleMap(raw: unknown): Record<number, ActiveStyle> {
  const map: Record<number, ActiveStyle> = {};
  if (!raw || typeof raw !== 'object') return map;
  if (Array.isArray(raw)) {
    for (const entry of raw) {
      const item = entry as ActiveStyle & { productId?: number };
      if (item?.productId) map[Number(item.productId)] = item;
    }
    return map;
  }
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (Number.isNaN(Number(key)) || !value || typeof value !== 'object') continue;
    map[Number(key)] = value as ActiveStyle;
  }
  return map;
}

export default function CollectProductClient() {
    const { t } = useTranslation();
  const [rows, setRows] = useState<CollectRow[]>([]);
  const [briefs, setBriefs] = useState<Record<number, ProductBrief>>({});
  const [styles, setStyles] = useState<Record<number, ActiveStyle>>({});
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [needLogin, setNeedLogin] = useState(false);
  const [openMore, setOpenMore] = useState<string | null>(null);
  const [columns, setColumns] = useState(MIN_COLUMNS);
  const gridRef = useRef<HTMLDivElement | null>(null);
  /** 对应原版 requestGeneration：翻页/删除并发时只接受最后一次响应 */
  const generation = useRef(0);

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

  const load = useCallback(async (nextPage: number) => {
    const current = ++generation.current;
    setLoading(true);
    try {
      const result = await apiGet<PageResult<CollectRow>>('user/collectProduct/list', {
        page: nextPage,
        size: PAGE_SIZE,
      });
      if (current !== generation.current) return;
      const records = Array.isArray(result?.records) ? result.records : [];
      setRows(records);
      setTotal(Number(result?.total || 0));
      setNeedLogin(false);

      const ids = records.map((item) => Number(item.productId)).filter((id) => Number.isFinite(id) && id > 0);
      if (!ids.length) return;
      const csv = ids.join(',');

      // 补齐卡片价格/销量/库存（Rust 收藏 VO 未返回）；失败不影响主列表
      void apiGet<PageResult<ProductBrief> | ProductBrief[]>('product/product/list', {
        ids: csv,
        page: 1,
        size: ids.length,
      })
        .then((briefResult) => {
          if (current !== generation.current) return;
          const list = Array.isArray(briefResult) ? briefResult : briefResult?.records || [];
          const next: Record<number, ProductBrief> = {};
          for (const item of list) if (item?.productId) next[Number(item.productId)] = item;
          setBriefs(next);
        })
        .catch(() => undefined);

      // 生效商品样式（活动边框图），对齐原版 useProductStyle
      void apiGet<unknown>('product/productStyle/batchActiveStyle', { productIds: csv })
        .then((styleResult) => {
          if (current !== generation.current) return;
          setStyles(parseStyleMap(styleResult));
        })
        .catch(() => undefined);
    } catch (error) {
      if (current !== generation.current) return;
      const message = error instanceof Error ? error.message : '';
      setNeedLogin(message.includes('登录') || message.includes('401') || message.includes('未授权'));
      setRows([]);
      setTotal(0);
      if (!message.includes('登录') && !message.includes('401')) {
        Toast.error({ content: message || t('心愿单加载失败') });
      }
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [page, load]);

  const remove = async (row: CollectRow) => {
    setOpenMore(null);
    try {
      await apiPost('user/collectProduct/cancel', { productId: row.productId });
      Toast.success({ content: '取消收藏成功' });
      // 当前页最后一条删完时回退一页，避免停在空白页
      if (rows.length === 1 && page > 1) setPage((value) => value - 1);
      else await load(page);
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '取消收藏失败' });
    }
  };

  const addToCart = async (event: MouseEvent<HTMLButtonElement>, row: CollectRow, href: string) => {
    event.preventDefault();
    event.stopPropagation();
    // 原版：多 SKU 商品不直接加购，跳详情页选规格
    if (Array.isArray(row.productSku) && row.productSku.length > 1) {
      window.open(href, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      await apiPost('cart/cart/addToCart', { id: row.productId, number: 1 });
      Toast.success({ content: '已加入购物车' });
    } catch (error) {
      Toast.error({ content: error instanceof Error ? error.message : '加入购物车失败' });
    }
  };

  const pages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);
  const pageNumbers = useMemo(() => {
    const windowSize = 5;
    let start = Math.max(1, page - Math.floor(windowSize / 2));
    const end = Math.min(pages, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    return Array.from({ length: end - start + 1 }, (_, index) => start + index);
  }, [page, pages]);

  if (needLogin) {
    return (
      <div className="collect-product collect-product--empty">
        <div className="title-or-tabs"><span className="card-title">{t('心愿单')}</span></div>
        <div className="no-result">
          <div className="empty">
            <img className="empty-img" src="/assets/images/empty-box.png" alt="" />
            <div className="empty-text">{t('登录后查看心愿单')}</div>
            <Link className="collect-product__login" href="/login?redirect=/member/collectproduct/list">{t('去登录')}</Link>
          </div>
        </div>
      </div>
    );
  }

  const gridStyle = { '--collect-columns': columns } as CSSProperties;

  return (
    <div className="info-row collect-product mp-collect-product">
      <div className="title-or-tabs">
        <span className="card-title">{t('心愿单')}</span>
        {total > 0 ? <span className="collect-product__count">共 {total} 件商品</span> : null}
      </div>
      <div className="page-body">
        <div className="collect-list-content" ref={gridRef} style={gridStyle}>
          {rows.map((row) => {
            const brief = briefs[Number(row.productId)];
            const style = styles[Number(row.productId)];
            const key = String(row.collectId ?? row.productId);
            const href = `/product/${row.productId}`;
            const name = row.productName || brief?.productName || '';
            const pic = imageUrl(row.picThumb || row.picUrl || brief?.picThumb || brief?.picUrl);
            const price = firstNumber(row.price, row.productPrice, brief?.price, brief?.productPrice);
            const money = splitPrice(price);
            const stock = row.productStock ?? brief?.productStock;
            const soldOut = stock !== undefined && Number(stock) === 0;
            const sales = Number(row.virtualSales ?? row.sales ?? brief?.virtualSales ?? brief?.sales ?? 0);
            const shopTitle = row.shop?.shopTitle || row.shopTitle || t('官方自营');
            const borderImage = imageUrl(style?.borderImage || style?.borderPic || style?.borderImageUrl);

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
                  <Link
                    href={href}
                    target="_blank"
                    className="collect-card__pic"
                    onClick={(event) => event.stopPropagation()}
                  >
                    {pic ? (
                      <img className={soldOut ? 'is-sold-out' : ''} src={pic} alt={name} loading="lazy" />
                    ) : (
                      <span className="collect-card__pic-empty" aria-hidden="true" />
                    )}
                    {borderImage ? <img className="collect-card__border" src={borderImage} alt="" /> : null}
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
                        <button type="button" onClick={() => void remove(row)}>{t('删除')}</button>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="collect-card__body">
                  <div className="collect-card__name">{name}</div>
                  <div className="collect-card__sales">{soldOut ? t('已售罄') : t('已售 {n}', { n: sales })}</div>
                  <div className="collect-card__tag-slot" />
                  <div className="collect-card__price-row">
                    <div className="collect-card__price">
                      <span className="collect-card__currency">{currencySymbol()}</span>
                      <b>{money.int}</b>
                      {money.dec ? <span className="collect-card__decimals">.{money.dec}</span> : null}
                    </div>
                    <button
                      type="button"
                      className={`collect-card__add${soldOut ? ' is-disabled' : ''}`}
                      aria-label={t('加入购物车')}
                      disabled={soldOut}
                      onClick={(event) => void addToCart(event, row, href)}
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                        <path d="M10 4v12M4 10h12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="collect-card__shop">{shopTitle}</div>
                </div>
              </article>
            );
          })}

          {!rows.length && !loading ? (
            <div className="no-result">
              <div className="empty">
                <img className="empty-img" src="/assets/images/empty-box.png" alt="" />
                <div className="empty-text">{t('您还没有收藏的商品')}</div>
              </div>
            </div>
          ) : null}

          {total > PAGE_SIZE && !loading ? (
            <div className="el-page">
              <div className="pagination">
                <button type="button" disabled={page <= 1} aria-label={t('上一页')} onClick={() => setPage((value) => value - 1)}>
                  {'<'}
                </button>
                {pageNumbers.map((number) => (
                  <button
                    type="button"
                    key={number}
                    className={number === page ? 'is-active' : ''}
                    onClick={() => setPage(number)}
                  >
                    {number}
                  </button>
                ))}
                <button type="button" disabled={page >= pages} aria-label={t('下一页')} onClick={() => setPage((value) => value + 1)}>
                  {'>'}
                </button>
              </div>
            </div>
          ) : null}

          {loading ? (
            <div className="collect-list-loading"><Spin size="large" /></div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

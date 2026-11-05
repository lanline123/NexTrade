import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import ProductGrid from '@/components/ProductGrid';
import { getPcHeader } from '@/lib/api';
import type { ProductListItem } from '@/lib/api';
import PcFooter from '@/components/PcFooter';

export const dynamic = 'force-dynamic';

/**
 * PC 搜索页（源码对照 java-b2b2c-overseas-v5.8.61/view/pc/pages/search）
 *
 * 旧版取数（pages/search/components/api.ts）：
 * - 筛选项：POST /api/search/search/getFilter
 * - ES 属性筛选项：POST /api/search/search/getEsFilter（返回 attributes [{ name, values: [{ value }] }]）
 * - 商品列表：POST /api/search/search/getProduct，参数
 *   { keyword, cat, pId, page, size, brand(逗号), sort(sale|price|time), order(asc|desc), min, max,
 *     attrs: [{ attrName, attrValue: string[] }] }
 * - 店铺列表：GET /api/shop/shop/list?keyword=&page=&size=（旧版「店铺」Tab，SearchShopList.vue）
 * - 排序：默认 / 销量(sale) / 价格(price asc|desc) / 最新(time desc)
 * - 价格区间支持预设与自定义 min/max（旧版 SortFilter 区间下拉）
 *
 * 当前实现覆盖：关键词/分类/品牌/价格区间/销量/价格/最新排序 + 分页 +
 * ES 属性筛选（URL `attr=名称::值`，可多值）+「全部商品 / 店铺」Tab。
 */

const SERVER_API_BASE = (process.env.PC_API_BASE || 'https://battery.recy.cc').replace(/\/$/, '');

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

interface SearchFilterCategory {
  id?: string | number;
  categoryId?: string | number;
  categoryName?: string;
  name?: string;
}

interface SearchFilterBrand {
  id?: string | number;
  brandId?: string | number;
  brandName?: string;
  name?: string;
}

interface SearchFilterEnvelope {
  filter?: {
    brand?: SearchFilterBrand[];
    brands?: SearchFilterBrand[];
    category?: SearchFilterCategory[];
    categories?: SearchFilterCategory[];
    maxPrice?: number | string;
    attrs?: EsAttrItem[];
  };
  filterSelected?: { keyword?: string; brand?: string; category?: string };
}

interface EsAttrOption {
  value?: string;
  checked?: boolean;
}

interface EsAttrItem {
  name?: string;
  attrName?: string;
  values?: EsAttrOption[];
}

interface EsAttrEnvelope {
  attributes?: EsAttrItem[];
}

interface SelectedAttr {
  attrName: string;
  attrValue: string[];
}

interface SearchProductEnvelope {
  records?: Array<Record<string, any>>;
  total?: number;
}

interface ShopItem {
  shopId?: string | number;
  shopTitle?: string;
  shopLogo?: string;
  shopBanner?: string;
  shopStar?: string | number;
  productCount?: string | number;
}

interface ShopListEnvelope {
  records?: ShopItem[];
  total?: number;
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function readParams(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

async function postApi<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE}/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok || (json.code !== undefined && json.code !== 0)) return null;
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

async function getApi<T>(path: string, params: Record<string, string | number | undefined>): Promise<T | null> {
  try {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === '') return;
      search.set(key, String(value));
    });
    const response = await fetch(`${SERVER_API_BASE}/api/${path}?${search.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok || (json.code !== undefined && json.code !== 0)) return null;
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

function normalizeBrands(filter?: SearchFilterEnvelope['filter']): Array<{ id: string; name: string }> {
  const list = (Array.isArray(filter?.brand) && filter?.brand) || (Array.isArray(filter?.brands) && filter?.brands) || [];
  return list
    .map((item) => ({
      id: String(item?.id ?? item?.brandId ?? ''),
      name: String(item?.brandName ?? item?.name ?? ''),
    }))
    .filter((item) => item.id && item.name);
}

function normalizeCategories(filter?: SearchFilterEnvelope['filter']): Array<{ id: string; name: string }> {
  const list = (Array.isArray(filter?.category) && filter?.category) || (Array.isArray(filter?.categories) && filter?.categories) || [];
  return list
    .map((item) => ({
      id: String(item?.id ?? item?.categoryId ?? ''),
      name: String(item?.categoryName ?? item?.name ?? ''),
    }))
    .filter((item) => item.id && item.name);
}

/** ES attributes → 归一化（name/values），与旧版 searchFilterUtils 对齐。 */
function normalizeEsAttrs(envelope: EsAttrEnvelope | null | undefined, fallback?: EsAttrItem[]): EsAttrItem[] {
  const raw = Array.isArray(envelope?.attributes) ? envelope?.attributes : fallback || [];
  return (raw || [])
    .map((item) => ({
      name: String(item?.name ?? item?.attrName ?? ''),
      values: (item?.values || [])
        .map((value) => ({ value: String(value?.value ?? '') }))
        .filter((value) => value.value),
    }))
    .filter((item) => item.name && (item.values || []).length > 0);
}

/** `attr=名称::值` → 已选属性（同一 attrName 可多值，与旧版 SelectedAttr 结构一致）。 */
function parseSelectedAttrs(values: string[]): SelectedAttr[] {
  const map = new Map<string, string[]>();
  for (const raw of values) {
    const text = String(raw || '');
    const index = text.indexOf('::');
    if (index <= 0) continue;
    const name = text.slice(0, index).trim();
    const value = text.slice(index + 2).trim();
    if (!name || !value) continue;
    const current = map.get(name) || [];
    if (!current.includes(value)) current.push(value);
    map.set(name, current);
  }
  return Array.from(map.entries())
    .map(([attrName, attrValue]) => ({ attrName, attrValue }))
    .filter((item) => item.attrValue.length > 0);
}

function serializeSelectedAttrs(attrs: SelectedAttr[]): string[] {
  return attrs.flatMap((attr) => attr.attrValue.map((value) => `${attr.attrName}::${value}`));
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const keyword = readParam(searchParams?.keyword);
  const title = keyword ? `${keyword} · 搜索 · 万物新生` : '搜索商品 · 万物新生';
  const description = keyword ? `搜索“${keyword}”相关的动力电池回收设备与商品。` : '搜索商品、分类、品牌与回收设备。';
  return {
    title,
    description,
    alternates: { canonical: keyword ? `/search?keyword=${encodeURIComponent(keyword)}` : '/search' },
    robots: keyword ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title, description, url: keyword ? `/search?keyword=${encodeURIComponent(keyword)}` : '/search' },
  };
}

const SORTS = [
  { key: 'default', label: '默认排序' },
  { key: 'sale', label: '销量' },
  { key: 'price-asc', label: '价格 ↑' },
  { key: 'price-desc', label: '价格 ↓' },
  { key: 'time', label: '最新' },
];

const PRICE_RANGES = [
  { key: 'all', label: '全部价格', min: '', max: '' },
  { key: 'lt-1000', label: '1000 以下', min: '0', max: '1000' },
  { key: '1000-5000', label: '1000–5000', min: '1000', max: '5000' },
  { key: '5000-10000', label: '5000–1 万', min: '5000', max: '10000' },
  { key: 'gt-10000', label: '1 万以上', min: '10000', max: '' },
];

const SHOP_PAGE_SIZE = 10;

export default async function SearchPage({ searchParams }: PageProps) {
  const keyword = readParam(searchParams?.keyword);
  const cat = readParam(searchParams?.cat) || readParam(searchParams?.categoryId);
  const brand = readParam(searchParams?.brand);
  const sort = readParam(searchParams?.sort);
  const order = readParam(searchParams?.order);
  const min = readParam(searchParams?.min) || readParam(searchParams?.priceMin);
  const max = readParam(searchParams?.max) || readParam(searchParams?.priceMax);
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const size = 30;
  const tab = readParam(searchParams?.tab) === 'shop' ? 'shop' : 'goods';
  const selectedAttrs = parseSelectedAttrs(readParams(searchParams?.attr));

  const sortKey = sort === 'price' ? (order === 'asc' ? 'price-asc' : 'price-desc') : sort === 'sale' || sort === 'time' ? sort : 'default';
  const priceRange = PRICE_RANGES.find((item) => item.min === min && item.max === max)?.key || 'all';

  const basePayload: Record<string, unknown> = {
    keyword: keyword || undefined,
    cat: cat || undefined,
    brand: brand || undefined,
    min: min || undefined,
    max: max || undefined,
  };

  const [header, filterResult, shopResult] = await Promise.all([
    getPcHeader().catch(() => null),
    postApi<SearchFilterEnvelope>('search/search/getFilter', basePayload),
    tab === 'shop'
      ? getApi<ShopListEnvelope>('shop/shop/list', { keyword: keyword || undefined, page, size: SHOP_PAGE_SIZE })
      : Promise.resolve(null),
  ]);

  const [esAttrResult, productResult] = await Promise.all([
    postApi<EsAttrEnvelope>('search/search/getEsFilter', {
      ...basePayload,
      attrs: selectedAttrs,
    }),
    tab === 'goods'
      ? postApi<SearchProductEnvelope>('search/search/getProduct', {
          ...basePayload,
          page,
          size,
          sort: sort === 'sale' || sort === 'price' || sort === 'time' ? sort : undefined,
          order: order === 'asc' || order === 'desc' ? order : undefined,
          attrs: selectedAttrs,
        })
      : Promise.resolve(null),
  ]);

  const brands = normalizeBrands(filterResult?.filter);
  const categories = normalizeCategories(filterResult?.filter);
  const esAttrs = normalizeEsAttrs(esAttrResult, filterResult?.filter?.attrs);
  const records = (productResult?.records || []) as unknown as ProductListItem[];
  const total = Number(productResult?.total || 0);
  const pages = Math.max(1, Math.ceil(total / size));
  const shops = (shopResult?.records || []) as ShopItem[];
  const shopTotal = Number(shopResult?.total || 0);
  const shopPages = Math.max(1, Math.ceil(shopTotal / SHOP_PAGE_SIZE));

  const buildQuery = (overrides: Record<string, string | string[] | undefined>, basePage = page) => {
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (cat) params.set('cat', cat);
    if (brand) params.set('brand', brand);
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);
    if (min) params.set('min', min);
    if (max) params.set('max', max);
    if (tab === 'shop') params.set('tab', 'shop');
    // 已选属性（名称::值）在筛选/排序/分页之间保留
    const keptAttrs = overrides.attr !== undefined ? (overrides.attr as string[]) : serializeSelectedAttrs(selectedAttrs);
    keptAttrs.forEach((item) => params.append('attr', item));
    if (basePage > 1) params.set('page', String(basePage));
    Object.entries(overrides).forEach(([key, value]) => {
      if (key === 'attr') return;
      params.delete(key);
      if (value === undefined) return;
      if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
      else params.set(key, value);
    });
    const query = params.toString();
    return query ? `?${query}` : '';
  };

  const toggleBrand = (id: string) => {
    const selected = brand ? brand.split(',').filter(Boolean) : [];
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    return `/search${buildQuery({ brand: next.length ? next.join(',') : undefined }, 1)}`;
  };

  /** 点击属性值：同 attrName 多选切换（旧版 FilterSide 复选语义）。 */
  const toggleAttr = (name: string, value: string) => {
    const next = selectedAttrs
      .map((attr) =>
        attr.attrName === name
          ? {
              ...attr,
              attrValue: attr.attrValue.includes(value)
                ? attr.attrValue.filter((item) => item !== value)
                : [...attr.attrValue, value],
            }
          : attr,
      )
      .filter((attr) => attr.attrValue.length > 0);
    const exists = selectedAttrs.some((attr) => attr.attrName === name);
    if (!exists && value) next.push({ attrName: name, attrValue: [value] });
    return `/search${buildQuery({ attr: serializeSelectedAttrs(next) }, 1)}`;
  };

  const attrSelected = (name: string, value: string) =>
    selectedAttrs.some((attr) => attr.attrName === name && attr.attrValue.includes(value));

  const tabHref = (next: 'goods' | 'shop') => `/search${buildQuery({ tab: next === 'shop' ? 'shop' : undefined }, 1)}`;

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-list-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">首页</Link>
            <span>/</span>
            <span>{keyword ? `搜索：${keyword}` : cat ? '分类商品' : '全部商品'}</span>
          </nav>
          <div className="pc-list-head">
            <h1>{keyword ? `“${keyword}”的搜索结果` : '全部商品'}</h1>
            <span>{tab === 'shop' ? `共 ${shopTotal} 家店铺` : `共 ${total} 件商品`}</span>
          </div>

          {/* 旧版 search-tabs：全部商品 / 店铺 */}
          <div className="pc-search-tabs" style={{ display: 'flex', gap: 24, margin: '8px 0 16px', borderBottom: '1px solid #eee' }}>
            <Link
              href={tabHref('goods')}
              style={{
                padding: '10px 2px',
                color: tab === 'goods' ? '#1a1a1a' : '#666',
                fontWeight: tab === 'goods' ? 600 : 400,
                borderBottom: tab === 'goods' ? '2px solid #1a1a1a' : '2px solid transparent',
              }}
            >
              全部商品
            </Link>
            <Link
              href={tabHref('shop')}
              style={{
                padding: '10px 2px',
                color: tab === 'shop' ? '#1a1a1a' : '#666',
                fontWeight: tab === 'shop' ? 600 : 400,
                borderBottom: tab === 'shop' ? '2px solid #1a1a1a' : '2px solid transparent',
              }}
            >
              店铺
            </Link>
          </div>

          {tab === 'goods' ? (
            <>
              {/* 分类筛选（旧版 Filter 顶部类目条） */}
              {categories.length ? (
                <div className="pc-search-filter-row">
                  <span className="pc-search-filter-row__label">分类：</span>
                  <div className="pc-search-filter-row__values">
                    <Link href={`/search${buildQuery({ cat: undefined }, 1)}`} className={!cat ? 'is-active' : ''}>全部</Link>
                    {categories.map((item) => (
                      <Link key={item.id} href={`/search${buildQuery({ cat: item.id }, 1)}`} className={cat === item.id ? 'is-active' : ''}>
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 品牌筛选（旧版 Filter 品牌项） */}
              {brands.length ? (
                <div className="pc-search-filter-row">
                  <span className="pc-search-filter-row__label">品牌：</span>
                  <div className="pc-search-filter-row__values">
                    {brands.map((item) => (
                      <Link key={item.id} href={toggleBrand(item.id)} className={brand.split(',').includes(item.id) ? 'is-active' : ''}>
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* ES 属性筛选（旧版 FilterSide：属性复选，提交 attrs: [{ attrName, attrValue }]） */}
              {esAttrs.length ? (
                <div className="pc-search-attrs">
                  {esAttrs.map((attr) => (
                    <div key={attr.name} className="pc-search-filter-row">
                      <span className="pc-search-filter-row__label">{attr.name}：</span>
                      <div className="pc-search-filter-row__values">
                        {(attr.values || []).map((option) => (
                          <Link
                            key={`${attr.name}-${option.value}`}
                            href={toggleAttr(String(attr.name), String(option.value))}
                            className={attrSelected(String(attr.name), String(option.value)) ? 'is-active' : ''}
                          >
                            {option.value}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                  {selectedAttrs.length ? (
                    <div className="pc-search-filter-row">
                      <span className="pc-search-filter-row__label">已选：</span>
                      <div className="pc-search-filter-row__values">
                        <Link href={`/search${buildQuery({ attr: [] }, 1)}`}>清除全部属性</Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* 排序（旧版 SortFilter：默认/销量/价格↑↓/最新） */}
              <div className="pc-list-toolbar">
                <div className="pc-list-sorts">
                  {SORTS.map((item) => {
                    const nextQuery =
                      item.key === 'default'
                        ? buildQuery({ sort: undefined, order: undefined }, 1)
                        : item.key === 'sale'
                          ? buildQuery({ sort: 'sale', order: 'desc' }, 1)
                          : item.key === 'time'
                            ? buildQuery({ sort: 'time', order: 'desc' }, 1)
                            : buildQuery({ sort: 'price', order: item.key === 'price-asc' ? 'asc' : 'desc' }, 1);
                    return (
                      <Link key={item.key} href={`/search${nextQuery}`} className={sortKey === item.key ? 'is-active' : ''}>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
                <Link href="/search/image" className="pc-image-search-entry">以图搜图</Link>
              </div>

              {/* 价格区间（旧版 SortFilter 区间：预设 + 自定义） */}
              <div className="pc-list-toolbar">
                <div className="pc-list-sorts">
                  {PRICE_RANGES.map((item) => (
                    <Link
                      key={item.key}
                      href={`/search${buildQuery({ min: item.min || undefined, max: item.max || undefined }, 1)}`}
                      className={priceRange === item.key ? 'is-active' : ''}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
                <form action="/search" method="get" className="pc-search-price-form">
                  {keyword ? <input type="hidden" name="keyword" value={keyword} /> : null}
                  {cat ? <input type="hidden" name="cat" value={cat} /> : null}
                  {brand ? <input type="hidden" name="brand" value={brand} /> : null}
                  {sort ? <input type="hidden" name="sort" value={sort} /> : null}
                  {order ? <input type="hidden" name="order" value={order} /> : null}
                  {serializeSelectedAttrs(selectedAttrs).map((item) => (
                    <input key={item} type="hidden" name="attr" value={item} />
                  ))}
                  <input type="text" name="min" placeholder="最低价" defaultValue={min} className="pc-search-price-input" />
                  <span>-</span>
                  <input type="text" name="max" placeholder="最高价" defaultValue={max} className="pc-search-price-input" />
                  <button type="submit">确定</button>
                </form>
              </div>

              <ProductGrid products={records} />

              {pages > 1 ? (
                <nav className="pc-pagination">
                  {page > 1 ? <Link href={`/search${buildQuery({}, page - 1)}`}>上一页</Link> : <span className="is-disabled">上一页</span>}
                  {Array.from({ length: Math.min(pages, 8) }).map((_, index) => {
                    const next = index + 1;
                    return (
                      <Link key={next} href={`/search${buildQuery({}, next)}`} className={next === page ? 'is-active' : ''}>
                        {next}
                      </Link>
                    );
                  })}
                  {page < pages ? <Link href={`/search${buildQuery({}, page + 1)}`}>下一页</Link> : <span className="is-disabled">下一页</span>}
                </nav>
              ) : null}
            </>
          ) : (
            <>
              {/* 旧版 SearchShopList：GET shop/shop/list（keyword/page/size） */}
              {shops.length ? (
                <div className="pc-search-shops" style={{ display: 'grid', gap: 12 }}>
                  {shops.map((shop, index) => (
                    <div
                      key={String(shop.shopId ?? index)}
                      className="pc-search-shop"
                      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', border: '1px solid #eee', borderRadius: 8 }}
                    >
                      <Link href={`/shop/${shop.shopId}`} className="pc-search-shop__logo" style={{ flex: '0 0 64px' }}>
                        <img
                          src={shop.shopLogo || ''}
                          alt={shop.shopTitle || '店铺'}
                          style={{ width: 64, height: 64, objectFit: 'contain', border: '1px solid #f0f0f0', borderRadius: 6 }}
                        />
                      </Link>
                      <div className="pc-search-shop__info" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                        <Link href={`/shop/${shop.shopId}`} style={{ fontWeight: 600 }}>
                          {shop.shopTitle || '店铺'}
                        </Link>
                        <span style={{ color: '#888', fontSize: 12 }}>
                          商品 {Number(shop.productCount || 0)}
                          {Number(shop.shopStar || 0) > 0 ? ` · 评分 ${shop.shopStar}` : ''}
                        </span>
                      </div>
                      <Link href={`/shop/${shop.shopId}`} className="pc-search-shop__enter" style={{ color: '#1a1a1a' }}>
                        进入店铺
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pc-search-empty">没有找到相关店铺</p>
              )}

              {shopPages > 1 ? (
                <nav className="pc-pagination">
                  {page > 1 ? (
                    <Link href={`/search${buildQuery({}, page - 1)}`}>上一页</Link>
                  ) : (
                    <span className="is-disabled">上一页</span>
                  )}
                  {Array.from({ length: Math.min(shopPages, 8) }).map((_, index) => {
                    const next = index + 1;
                    return (
                      <Link key={next} href={`/search${buildQuery({}, next)}`} className={next === page ? 'is-active' : ''}>
                        {next}
                      </Link>
                    );
                  })}
                  {page < shopPages ? (
                    <Link href={`/search${buildQuery({}, page + 1)}`}>下一页</Link>
                  ) : (
                    <span className="is-disabled">下一页</span>
                  )}
                </nav>
              ) : null}
            </>
          )}
        </div>
      </main>
      <PcFooter />
    </>
  );
}

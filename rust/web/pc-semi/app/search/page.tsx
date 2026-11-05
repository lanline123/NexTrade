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
 * - 商品列表：POST /api/search/search/getProduct，参数
 *   { keyword, cat, pId, page, size, brand(逗号), sort(sale|price|time), order(asc|desc), min, max, attrs }
 * - 排序：默认 / 销量(sale) / 价格(price asc|desc) / 最新(time desc)
 * - 价格区间支持预设与自定义 min/max（旧版 SortFilter 区间下拉）
 *
 * 当前实现覆盖：关键词/分类/品牌/价格区间/销量/价格/最新排序 + 分页；
 * ES 属性筛选（getAttributeSuggestions）与「店铺」Tab 尚未迁移（见页面底部提示与任务报告）。
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
  };
  filterSelected?: { keyword?: string; brand?: string; category?: string };
}

interface SearchProductEnvelope {
  records?: Array<Record<string, any>>;
  total?: number;
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
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

  const sortKey = sort === 'price' ? (order === 'asc' ? 'price-asc' : 'price-desc') : sort === 'sale' || sort === 'time' ? sort : 'default';
  const priceRange = PRICE_RANGES.find((item) => item.min === min && item.max === max)?.key || 'all';

  const basePayload: Record<string, unknown> = {
    keyword: keyword || undefined,
    cat: cat || undefined,
    brand: brand || undefined,
    min: min || undefined,
    max: max || undefined,
  };

  const [header, filterResult, productResult] = await Promise.all([
    getPcHeader().catch(() => null),
    postApi<SearchFilterEnvelope>('search/search/getFilter', basePayload),
    postApi<SearchProductEnvelope>('search/search/getProduct', {
      ...basePayload,
      page,
      size,
      sort: sort === 'sale' || sort === 'price' || sort === 'time' ? sort : undefined,
      order: order === 'asc' || order === 'desc' ? order : undefined,
    }),
  ]);

  const brands = normalizeBrands(filterResult?.filter);
  const categories = normalizeCategories(filterResult?.filter);
  const records = (productResult?.records || []) as unknown as ProductListItem[];
  const total = Number(productResult?.total || 0);
  const pages = Math.max(1, Math.ceil(total / size));

  const buildQuery = (overrides: Record<string, string | undefined>) => {
    const current: Record<string, string> = {};
    if (keyword) current.keyword = keyword;
    if (cat) current.cat = cat;
    if (brand) current.brand = brand;
    if (sort) current.sort = sort;
    if (order) current.order = order;
    if (min) current.min = min;
    if (max) current.max = max;
    if (page > 1) current.page = String(page);
    Object.entries(overrides).forEach(([key, value]) => {
      if (value === undefined) delete current[key];
      else current[key] = value;
    });
    const query = new URLSearchParams(current).toString();
    return query ? `?${query}` : '';
  };

  const toggleBrand = (id: string) => {
    const selected = brand ? brand.split(',').filter(Boolean) : [];
    const next = selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
    return buildQuery({ brand: next.length ? next.join(',') : undefined, page: undefined });
  };

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
            <span>共 {total} 件商品</span>
          </div>

          {/* 分类筛选（旧版 Filter 顶部类目条） */}
          {categories.length ? (
            <div className="pc-search-filter-row">
              <span className="pc-search-filter-row__label">分类：</span>
              <div className="pc-search-filter-row__values">
                <Link href={buildQuery({ cat: undefined, page: undefined })} className={!cat ? 'is-active' : ''}>全部</Link>
                {categories.map((item) => (
                  <Link key={item.id} href={buildQuery({ cat: item.id, page: undefined })} className={cat === item.id ? 'is-active' : ''}>
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

          {/* 排序（旧版 SortFilter：默认/销量/价格↑↓/最新） */}
          <div className="pc-list-toolbar">
            <div className="pc-list-sorts">
              {SORTS.map((item) => {
                const nextQuery =
                  item.key === 'default'
                    ? buildQuery({ sort: undefined, order: undefined, page: undefined })
                    : item.key === 'sale'
                      ? buildQuery({ sort: 'sale', order: 'desc', page: undefined })
                      : item.key === 'time'
                        ? buildQuery({ sort: 'time', order: 'desc', page: undefined })
                        : buildQuery({ sort: 'price', order: item.key === 'price-asc' ? 'asc' : 'desc', page: undefined });
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
                  href={`/search${buildQuery({ min: item.min || undefined, max: item.max || undefined, page: undefined })}`}
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
              <input type="text" name="min" placeholder="最低价" defaultValue={min} className="pc-search-price-input" />
              <span>-</span>
              <input type="text" name="max" placeholder="最高价" defaultValue={max} className="pc-search-price-input" />
              <button type="submit">确定</button>
            </form>
          </div>

          <ProductGrid products={records} />

          {pages > 1 ? (
            <nav className="pc-pagination">
              {page > 1 ? <Link href={`/search${buildQuery({ page: String(page - 1) })}`}>上一页</Link> : <span className="is-disabled">上一页</span>}
              {Array.from({ length: Math.min(pages, 8) }).map((_, index) => {
                const next = index + 1;
                return (
                  <Link key={next} href={`/search${buildQuery({ page: next > 1 ? String(next) : undefined })}`} className={next === page ? 'is-active' : ''}>
                    {next}
                  </Link>
                );
              })}
              {page < pages ? <Link href={`/search${buildQuery({ page: String(page + 1) })}`}>下一页</Link> : <span className="is-disabled">下一页</span>}
            </nav>
          ) : null}
        </div>
      </main>
      <PcFooter />
    </>
  );
}

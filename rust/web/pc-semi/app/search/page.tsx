import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import ProductGrid from '@/components/ProductGrid';
import { getPcHeader, getProducts } from '@/lib/api';
import PcFooter from '@/components/PcFooter';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
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
  { key: 'default', label: '综合' },
  { key: 'price-asc', label: '价格升序' },
  { key: 'price-desc', label: '价格降序' },
  { key: 'new', label: '最新' },
];

const PRICE_RANGES = [
  { key: 'all', label: '全部价格', min: '', max: '' },
  { key: 'lt-10000', label: '1 万以下', min: '0', max: '10000' },
  { key: '10000-100000', label: '1–10 万', min: '10000', max: '100000' },
  { key: '100000-500000', label: '10–50 万', min: '100000', max: '500000' },
  { key: 'gt-500000', label: '50 万以上', min: '500000', max: '' },
];

export default async function SearchPage({ searchParams }: PageProps) {
  const keyword = readParam(searchParams?.keyword);
  const categoryId = readParam(searchParams?.categoryId);
  const sort = readParam(searchParams?.sort) || 'default';
  const priceMin = readParam(searchParams?.priceMin);
  const priceMax = readParam(searchParams?.priceMax);
  const priceRange = PRICE_RANGES.find((item) => item.min === priceMin && item.max === priceMax)?.key || 'all';
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const size = 24;

  const sortMap: Record<string, { sortField?: string; sortOrder?: 'asc' | 'desc' }> = {
    'price-asc': { sortField: 'productPrice', sortOrder: 'asc' },
    'price-desc': { sortField: 'productPrice', sortOrder: 'desc' },
    new: { sortField: 'add_time', sortOrder: 'desc' },
  };

  const [products, header] = await Promise.all([
    getProducts({ page, size, keyword, categoryId, priceMin, priceMax, ...(sortMap[sort] || {}) }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.ceil(products.total / size);

  const queryFor = (nextSort: string, nextPage = 1) => {
    const query = new URLSearchParams();
    if (keyword) query.set('keyword', keyword);
    if (categoryId) query.set('categoryId', categoryId);
    if (priceMin) query.set('priceMin', priceMin);
    if (priceMax) query.set('priceMax', priceMax);
    if (nextSort !== 'default') query.set('sort', nextSort);
    if (nextPage > 1) query.set('page', String(nextPage));
    return query.toString();
  };

  const queryForPrice = (min: string, max: string) => {
    const query = new URLSearchParams();
    if (keyword) query.set('keyword', keyword);
    if (categoryId) query.set('categoryId', categoryId);
    if (min) query.set('priceMin', min);
    if (max) query.set('priceMax', max);
    if (sort !== 'default') query.set('sort', sort);
    return query.toString();
  };

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-list-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">首页</Link>
            <span>/</span>
            <span>{keyword ? `搜索：${keyword}` : categoryId ? '分类商品' : '全部商品'}</span>
          </nav>
          <div className="pc-list-head">
            <h1>{keyword ? `“${keyword}”的搜索结果` : '全部商品'}</h1>
            <span>共 {products.total} 件商品</span>
          </div>

          <div className="pc-list-toolbar">
            <div className="pc-list-sorts">
              {SORTS.map((item) => (
                <Link key={item.key} href={`/search?${queryFor(item.key)}`} className={sort === item.key ? 'is-active' : ''}>
                  {item.label}
                </Link>
              ))}
            </div>
            {categoryId ? <span className="pc-list-filter-tip">分类 ID：{categoryId}</span> : null}
            <Link href="/search/image" className="pc-image-search-entry">以图搜图</Link>
          </div>

          <div className="pc-list-toolbar">
            <div className="pc-list-sorts">
              {PRICE_RANGES.map((item) => (
                <Link key={item.key} href={`/search?${queryForPrice(item.min, item.max)}`} className={priceRange === item.key ? 'is-active' : ''}>
                  {item.label}
                </Link>
              ))}
            </div>
            {priceMin || priceMax ? <span className="pc-list-filter-tip">已筛选价格区间</span> : null}
          </div>

          <ProductGrid products={products.records} />

          {pages > 1 ? (
            <nav className="pc-pagination">
              {Array.from({ length: pages }).map((_, index) => {
                const next = index + 1;
                return (
                  <Link key={next} href={`/search?${queryFor(sort, next)}`} className={next === page ? 'is-active' : ''}>
                    {next}
                  </Link>
                );
              })}
            </nav>
          ) : null}
        </div>
      </main>
      <PcFooter />
    </>
  );
}

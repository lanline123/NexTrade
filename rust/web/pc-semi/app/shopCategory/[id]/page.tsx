import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import ProductGrid from '@/components/ProductGrid';
import ShopHeader from '@/components/ShopHeader';
import { getPcHeader, getShopCategories, getShopDetail, getShopProducts, type ShopCategoryNode } from '@/lib/api';

import { getServerT } from '@/i18n/server';
/**
 * 店铺分类页（源码 java.../view/pc/pages/shopCategory/[id].vue +
 * src/ShopCategory.vue + src/ShopFilter.vue）。
 * 旧实现 re-export 到 /shop/[id]（店铺主页），导致 shopCategoryId、左侧分类树、
 * 价格区间筛选与独立 canonical 全部丢失，这里恢复为独立页面。
 */
export const dynamic = 'force-dynamic';

const SITE_URL = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');

interface PageProps {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

function read(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function flattenCategories(nodes: ShopCategoryNode[], depth = 0): Array<{ id: string; name: string; depth: number }> {
  const out: Array<{ id: string; name: string; depth: number }> = [];
  (nodes || []).forEach((node) => {
    out.push({ id: String(node.categoryId), name: String(node.categoryName || node.categoryId), depth });
    if (Array.isArray(node.children) && node.children.length) out.push(...flattenCategories(node.children, depth + 1));
  });
  return out;
}

const SORTS = [
  { key: '', label: '默认排序' },
  { key: 'sale', label: '销量' },
  { key: 'time', label: '新品' },
  { key: 'price', label: '价格' },
];

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const t = getServerT();
  const shop = await getShopDetail(Number(params.id) || 0).catch(() => null);
  const categoryId = read(searchParams?.categoryId) || read(searchParams?.shopCategoryId);
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
  return {
    title: `${shop?.shopTitle || t('店铺商品')} · 店铺分类 · 万物新生`,
    description: shop?.description || t('店铺商品分类'),
    alternates: { canonical: `${SITE_URL}/shopCategory/${params.id}${query}` },
  };
}

export default async function ShopCategoryPage({ params, searchParams }: PageProps) {
    const t = getServerT();
  const shopId = Number(params.id) || 0;
  const categoryId = read(searchParams?.categoryId) || read(searchParams?.shopCategoryId);
  const sort = read(searchParams?.sort) || read(searchParams?.sortField);
  const order = read(searchParams?.order) === 'asc' ? 'asc' : 'desc';
  const minPrice = read(searchParams?.minPrice) || read(searchParams?.pricemin);
  const maxPrice = read(searchParams?.maxPrice) || read(searchParams?.pricemax);
  const page = Math.max(1, Number(read(searchParams?.page)) || 1);
  const size = 20;

  const [categories, products, header, shop] = await Promise.all([
    getShopCategories(shopId).catch(() => [] as ShopCategoryNode[]),
    getShopProducts({
      shopId,
      page,
      size,
      categoryId: categoryId || undefined,
      sortField: sort || undefined,
      sortOrder: sort === 'price' ? order : undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
    }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
    getShopDetail(shopId).catch(() => null),
  ]);
  const flat = flattenCategories(categories);
  const pages = Math.max(1, Math.ceil(products.total / size));

  const hrefFor = (nextPage = page, nextCat = categoryId, nextSort = sort, nextOrder = order) => {
    const query = new URLSearchParams();
    if (nextCat) query.set('categoryId', nextCat);
    if (nextSort) query.set('sort', nextSort);
    if (nextSort === 'price') query.set('order', nextOrder);
    if (minPrice) query.set('minPrice', minPrice);
    if (maxPrice) query.set('maxPrice', maxPrice);
    if (nextPage > 1) query.set('page', String(nextPage));
    const suffix = query.toString();
    return suffix ? `/shopCategory/${shopId}?${suffix}` : `/shopCategory/${shopId}`;
  };

  return (
    <div className="shop-category-page">
      <PcHeader config={header as any} />
      <main className="pc-container">
        <nav className="pc-breadcrumb">
          <Link href="/">{t('首页')}</Link><span>/</span>
          <Link href="/shop">{t('店铺街')}</Link><span>/</span>
          <Link href={`/shop/${shopId}`}>{shop?.shopTitle || t('店铺')}</Link><span>/</span>
          <span>{t('店铺商品')}</span>
        </nav>

        {/* 源码 ShopCategory.vue 遍历装修 moduleList 的 shopInfo 模块 → 店头信息 */}
        <ShopHeader
          shopInfo={{
            shopId,
            shopTitle: shop?.shopTitle,
            shopLogo: shop?.shopLogo,
            collectCount: shop?.collectCount,
            tipNames: shop?.shopStar ? [`${Number(shop.shopStar).toFixed(1)} 分`] : [],
          }}
          siteLogo={undefined}
        />

        <div className="shop-category-layout">
          {/* 源码 LeftMenu：店铺分类树 */}
          <aside className="shop-category-left">
            <h3>{t('店铺分类')}</h3>
            <Link href={hrefFor(1, '')} className={!categoryId ? 'is-active' : ''}>{t('全部商品')}</Link>
            {flat.map((node) => (
              <Link
                key={node.id}
                href={hrefFor(1, node.id)}
                className={categoryId === node.id ? 'is-active' : ''}
                style={{ paddingLeft: 8 + node.depth * 12 }}
              >
                {node.depth ? '└ ' : ''}{node.name}
              </Link>
            ))}
          </aside>

          <section className="shop-category-main">
            {/* 源码 ShopFilter.vue：cat-sort 排序条 + pricemin/pricemax 价格区间 */}
            <div className="shop-category-filter">
              <div className="cat-sort">
                {SORTS.map((item) => {
                  const nextOrder = item.key === 'price' && sort === 'price' && order === 'asc' ? 'desc' : 'asc';
                  return (
                    <Link
                      key={item.key}
                      href={hrefFor(1, categoryId, item.key, item.key === 'price' ? nextOrder : order)}
                      className={`sort-link${sort === item.key ? ' cur_sort' : ''}`}
                    >
                      {item.label}{item.key === 'price' ? (order === 'desc' ? ' ↓' : ' ↑') : ''}
                    </Link>
                  );
                })}
              </div>
              <form className="priceform" action={`/shopCategory/${shopId}`} method="get">
                {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}
                {sort ? <input type="hidden" name="sort" value={sort} /> : null}
                <input type="text" name="minPrice" defaultValue={minPrice} placeholder={t('最低价')} />
                <em> - </em>
                <input type="text" name="maxPrice" defaultValue={maxPrice} placeholder={t('最高价')} />
                <button type="submit">{t('确定')}</button>
              </form>
            </div>

            <ProductGrid products={products.records} showSales showShopTag />
            {!products.records.length ? <div className="pc-list-empty">{t('该分类下暂无商品')}</div> : null}

            {pages > 1 ? (
              <nav className="pc-pagination">
                {page > 1 ? <Link href={hrefFor(page - 1)}>{t('上一页')}</Link> : <span className="is-disabled">{t('上一页')}</span>}
                <span>{page} / {pages}</span>
                {page < pages ? <Link href={hrefFor(page + 1)}>{t('下一页')}</Link> : <span className="is-disabled">{t('下一页')}</span>}
              </nav>
            ) : null}
          </section>
        </div>
      </main>
      <PcFooter />
    </div>
  );
}

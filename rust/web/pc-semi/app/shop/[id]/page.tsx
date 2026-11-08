import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getPcHeader, getShopCategories, getShopDecorate, getShopDetail, getShopHead, getShopProducts } from '@/lib/api';
import ShopHomepageClient from '@/components/ShopHomepageClient';
import ShopHeader from '@/components/ShopHeader';
import ShopCategoryMenu from '@/components/ShopCategoryMenu';
import ProductGrid from '@/components/ProductGrid';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

/**
 * 店铺页 /shop/[id]
 * 源码对照：view/pc/pages/shop/[id].vue（薄壳）→ 有装修走 ShopHomepage，否则 ShopDefaultPage
 * 样式：app/shop-page.scss → .pg-shop-default-page
 *
 * 默认页结构（ShopDefaultPage.vue <template>）：
 *   .shop-default-page
 *     > 页头
 *     > ShopRefHeader（.shop-ref-header）
 *     > .container.main-content
 *         > .sidebar > ShopCategoryMenu
 *         > .right-content
 *             > .shop-sort-bar > span.sort-link(.cur_sort) 综合/销量/新品/价格(+.sort-arrow)
 *             > CatGoodsList（.goods-list__box > .goods-list-c > .wrap）+ .pagination
 *     > 页脚
 */
interface PageProps {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = getServerT();
  const shop = await getShopDetail(Number(params.id)).catch(() => null);
  return {
    title: shop?.shopTitle ? `${shop.shopTitle} · 万物新生` : '店铺详情 · 万物新生',
    description: shop?.description || t('店铺详情'),
    alternates: { canonical: `/shop/${params.id}` },
    openGraph: {
      type: 'website',
      url: `/shop/${params.id}`,
      title: shop?.shopTitle || t('店铺详情'),
      description: shop?.description || t('店铺详情'),
      images: shop?.shopLogo ? [shop.shopLogo] : undefined,
    },
  };
}

export default async function ShopDetailPage({ params, searchParams }: PageProps) {
  const t = getServerT();
  const shopId = Number(params.id) || 0;
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const categoryId = readParam(searchParams?.categoryId);
  const sort = readParam(searchParams?.sort);
  const order = readParam(searchParams?.order);
  // 旧版 ShopFilter：店内商品价格区间筛选
  const minPrice = readParam(searchParams?.minPrice);
  const maxPrice = readParam(searchParams?.maxPrice);
  const size = 20;
  const sortMap: Record<string, { sortField?: string; sortOrder?: 'asc' | 'desc' }> = {
    sale: { sortField: 'sale' },
    time: { sortField: 'time' },
    price: { sortField: 'price', sortOrder: order === 'asc' ? 'asc' : 'desc' },
  };
  const [shop, categories, products, header, head, decorate] = await Promise.all([
    getShopDetail(shopId).catch(() => null),
    getShopCategories(shopId).catch(() => []),
    getShopProducts({
      shopId,
      page,
      size,
      categoryId,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      ...(sortMap[sort] || {}),
    }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
    getShopHead(shopId).catch(() => null),
    getShopDecorate(shopId).catch(() => null),
  ]);
  const hasDecorate = head?.pcDefaultStyle !== '1' && Boolean(decorate?.moduleList?.length);
  const pages = Math.max(1, Math.ceil(products.total / size));
  const siteUrl = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');
  const shopJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Store',
    name: shop?.shopTitle || t('店铺详情'),
    image: shop?.shopLogo || undefined,
    description: shop?.description || undefined,
    url: `${siteUrl}/shop/${shopId}`,
    ...(Number(shop?.shopStar || 0) > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(shop?.shopStar), bestRating: 5 } } : {}),
  };
  const shopBreadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: '店铺街', item: `${siteUrl}/shop` },
      { '@type': 'ListItem', position: 3, name: shop?.shopTitle || t('店铺详情') },
    ],
  };
  const shopSchema = <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([shopJsonLd, shopBreadcrumbJsonLd]) }} />;
  const hrefFor = (nextPage = page, nextCat = categoryId, nextSort = sort, nextOrder = order) => {
    const query = new URLSearchParams();
    if (nextCat) query.set('categoryId', nextCat);
    if (nextSort) query.set('sort', nextSort);
    if (nextSort === 'price' && nextOrder) query.set('order', nextOrder);
    if (minPrice) query.set('minPrice', minPrice);
    if (maxPrice) query.set('maxPrice', maxPrice);
    if (nextPage > 1) query.set('page', String(nextPage));
    return query.toString() ? `/shop/${shopId}?${query.toString()}` : `/shop/${shopId}`;
  };
  const sortHref = (key: string) => hrefFor(1, categoryId, key, key === 'price' ? 'desc' : '');
  const priceAsc = sort === 'price' && order === 'asc';

  if (hasDecorate) {
    return (
      <div className="pg-shop-default-page">
        {shopSchema}
        <PcHeader config={header as any} />
        <main className="shop-decoration-page">
          <div className="shop-decoration-container">
            <ShopHomepageClient shopId={shopId} shop={shop} data={decorate} />
          </div>
        </main>
        <PcFooter />
      </div>
    );
  }

  return (
    <div className="pg-shop-default-page">
      {shopSchema}
      <div className="shop-default-page">
        <PcHeader config={header as any} />
        {/* 源码 pages/shop/src/ShopRefHeader.vue：店铺头部（logo/搜索/资质/粉丝/客服/关注） */}
        <ShopHeader
          shopInfo={{
            shopId,
            shopTitle: shop?.shopTitle,
            shopLogo: shop?.shopLogo,
            collectCount: shop?.collectCount,
            collectShop: Boolean((shop as any)?.collectShop),
            businessLicensePic: (shop as any)?.businessLicensePic,
            shopStar: Number(shop?.shopStar || 0),
            tipNames: shop?.shopStar ? [`${Number(shop.shopStar).toFixed(1)} 分`] : [],
          }}
          siteLogo={undefined}
          showShopSearch={false}
        />

        <div className="container main-content">
          <div className="sidebar">
            <ShopCategoryMenu shopId={shopId} categories={categories as any} currentCategoryId={categoryId} />
          </div>

          <div className="right-content">
            <div className="shop-sort-bar">
              <Link href={sortHref('')} className={`sort-link${!sort ? ' cur_sort' : ''}`}>
                {t('综合')}
              </Link>
              <Link href={sortHref('sale')} className={`sort-link${sort === 'sale' ? ' cur_sort' : ''}`}>
                {t('销量')}
              </Link>
              <Link href={sortHref('time')} className={`sort-link${sort === 'time' ? ' cur_sort' : ''}`}>
                {t('新品')}
              </Link>
              <Link
                href={priceAsc ? sortHref('price') : hrefFor(1, categoryId, 'price', 'asc')}
                className={`sort-link${sort === 'price' ? ' cur_sort' : ''}`}
              >
                {t('价格')}
                <span className="sort-arrow">
                  <i className={`iconfont-pc icon-shangjiantou1${priceAsc ? ' active' : ''}`} />
                  <i className={`iconfont-pc icon-xiajiantou1${sort === 'price' && !priceAsc ? ' active' : ''}`} />
                </span>
              </Link>
            </div>

            {/* 旧版 CatGoodsList.vue：.goods-list__box > .goods-list-c > .wrap */}
            <div className={`goods-list__box${products.records.length ? '' : ' goods-list__box--empty'}`}>
              <div className="goods-list-c">
                <ProductGrid products={products.records as any} gridClassName="wrap" />
              </div>
            </div>

            {products.records.length > 0 && pages > 1 ? (
              <div className="pagination">
                <nav className="el-pagination">
                  {page > 1 ? (
                    <Link href={hrefFor(page - 1)} className="btn-prev">
                      {'<'}
                    </Link>
                  ) : (
                    <span className="btn-prev disabled">{'<'}</span>
                  )}
                  {Array.from({ length: Math.min(pages, 8) }).map((_, index) => {
                    const next = index + 1;
                    return next === page ? (
                      <span className="number active" key={next}>
                        {next}
                      </span>
                    ) : (
                      <Link href={hrefFor(next)} className="number" key={next}>
                        {next}
                      </Link>
                    );
                  })}
                  {page < pages ? (
                    <Link href={hrefFor(page + 1)} className="btn-next">
                      {'>'}
                    </Link>
                  ) : (
                    <span className="btn-next disabled">{'>'}</span>
                  )}
                </nav>
              </div>
            ) : null}
          </div>
        </div>

        <PcFooter />
      </div>
    </div>
  );
}

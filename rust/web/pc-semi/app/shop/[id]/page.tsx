import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getPcHeader, getShopCategories, getShopDecorate, getShopDetail, getShopHead, getShopProducts } from '@/lib/api';
import ShopHomepageClient from '@/components/ShopHomepageClient';
import ShopHeader from '@/components/ShopHeader';
import ShopCategoryMenu from '@/components/ShopCategoryMenu';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

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
  const hrefFor = (nextPage = page, nextCat = categoryId, nextSort = sort) => {
    const query = new URLSearchParams();
    if (nextCat) query.set('categoryId', nextCat);
    if (nextSort) query.set('sort', nextSort);
    if (minPrice) query.set('minPrice', minPrice);
    if (maxPrice) query.set('maxPrice', maxPrice);
    if (nextPage > 1) query.set('page', String(nextPage));
    return query.toString() ? `/shop/${shopId}?${query.toString()}` : `/shop/${shopId}`;
  };
  const sortHref = (key: string) => hrefFor(1, categoryId, key);

  if (hasDecorate) {
    return (
      <div className="shop-detail-page">
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
    <div className="shop-detail-page">
      {shopSchema}
      <PcHeader config={header as any} />
      <main className="shop-detail-main">
        <div className="shop-detail-container">
          {/* 源码 pages/shop/src/ShopRefHeader.vue：店铺头部（logo/搜索/资质/粉丝/客服/关注） */}
          <ShopHeader
            shopInfo={{
              shopId,
              shopTitle: shop?.shopTitle,
              shopLogo: shop?.shopLogo,
              collectCount: shop?.collectCount,
              collectShop: Boolean((shop as any)?.collectShop),
              businessLicensePic: (shop as any)?.businessLicensePic,
              tipNames: shop?.shopStar ? [`${Number(shop.shopStar).toFixed(1)} 分`] : [],
            }}
            siteLogo={undefined}
          />

          <div className="shop-detail-body">
            <ShopCategoryMenu shopId={shopId} categories={categories as any} currentCategoryId={categoryId} />

            <section className="shop-detail-products">
              <div className="shop-detail-sort">
                <Link href={sortHref('')} className={!sort ? 'is-active' : ''}>{t('综合')}</Link>
                <Link href={sortHref('sale')} className={sort === 'sale' ? 'is-active' : ''}>{t('销量')}</Link>
                <Link href={sortHref('time')} className={sort === 'time' ? 'is-active' : ''}>{t('新品')}</Link>
                <Link href={sortHref('price')} className={sort === 'price' ? 'is-active' : ''}>{t('价格')}</Link>
                {/* 旧版 ShopFilter：店内商品价格区间筛选 */}
                <form action={`/shop/${shopId}`} method="get" className="shop-detail-priceform">
                  {categoryId ? <input type="hidden" name="categoryId" value={categoryId} /> : null}
                  {sort ? <input type="hidden" name="sort" value={sort} /> : null}
                  {order ? <input type="hidden" name="order" value={order} /> : null}
                  <input type="number" name="minPrice" placeholder={t('最低价')} defaultValue={minPrice} min="0" />
                  <span>—</span>
                  <input type="number" name="maxPrice" placeholder={t('最高价')} defaultValue={maxPrice} min="0" />
                  <button type="submit">{t('确定')}</button>
                </form>
              </div>
              {products.records.length ? (
                <ul className="shop-detail-grid">
                  {products.records.map((product: any) => (
                    <li key={product.productId}>
                      {/* 源码 pages/shop/src/CatGoodsList.vue 商品卡字段 */}
                      <Link href={`/product/${product.productId}`} className="shop-detail-card" target="_blank">
                        <div className="shop-detail-card__img">
                          <img src={product.picThumb || product.picUrl || ''} alt={product.productName || ''} loading="lazy" />
                          {Number(product.productSaleMode || 0) > 0 ? <span className="shop-detail-card__badge">{t('预售')}</span> : null}
                        </div>
                        <div className="shop-detail-card__name">{product.productName}</div>
                        <div className="shop-detail-card__price">
                          ¥ {Number(product.productPrice || product.price || 0).toFixed(2)}
                          {Number(product.marketPrice || 0) > Number(product.productPrice || 0) ? (
                            <s className="shop-detail-card__market">¥ {Number(product.marketPrice).toFixed(2)}</s>
                          ) : null}
                        </div>
                        <div className="shop-detail-card__meta">
                          {product.saleCount !== undefined ? <span>已售 {Number(product.saleCount || 0)}</span> : null}
                          {Array.isArray(product.promotionList) && product.promotionList.length ? (
                            <span className="shop-detail-card__promo">
                              {product.promotionList.slice(0, 2).map((promo: any, index: number) => (
                                <em key={index}>{String(promo?.type === 2 ? t('券') : promo?.name || promo?.title || t('促销'))}</em>
                              ))}
                            </span>
                          ) : null}
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="shop-detail-empty">{t('暂无商品')}</div>
              )}
              {products.records.length > 0 && pages > 1 ? (
                <nav className="shop-detail-pagination">
                  {page > 1 ? <Link href={hrefFor(page - 1)}>{t('上一页')}</Link> : <span className="is-disabled">{t('上一页')}</span>}
                  <span>{page} / {pages}</span>
                  {page < pages ? <Link href={hrefFor(page + 1)}>{t('下一页')}</Link> : <span className="is-disabled">{t('下一页')}</span>}
                </nav>
              ) : null}
            </section>
          </div>
        </div>
      </main>
      <PcFooter />
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getPcHeader, getShopCategories, getShopDecorate, getShopDetail, getShopHead, getShopProducts } from '@/lib/api';
import ShopHomepageClient from '@/components/ShopHomepageClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const shop = await getShopDetail(Number(params.id)).catch(() => null);
  return {
    title: shop?.shopTitle ? `${shop.shopTitle} · 万物新生` : '店铺详情 · 万物新生',
    description: shop?.description || '店铺详情',
    alternates: { canonical: `/shop/${params.id}` },
    openGraph: {
      type: 'website',
      url: `/shop/${params.id}`,
      title: shop?.shopTitle || '店铺详情',
      description: shop?.description || '店铺详情',
      images: shop?.shopLogo ? [shop.shopLogo] : undefined,
    },
  };
}

export default async function ShopDetailPage({ params, searchParams }: PageProps) {
  const shopId = Number(params.id) || 0;
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const categoryId = readParam(searchParams?.categoryId);
  const sort = readParam(searchParams?.sort);
  const order = readParam(searchParams?.order);
  const size = 20;
  const sortMap: Record<string, { sortField?: string; sortOrder?: 'asc' | 'desc' }> = {
    sale: { sortField: 'sale' },
    time: { sortField: 'time' },
    price: { sortField: 'price', sortOrder: order === 'asc' ? 'asc' : 'desc' },
  };
  const [shop, categories, products, header, head, decorate] = await Promise.all([
    getShopDetail(shopId).catch(() => null),
    getShopCategories(shopId).catch(() => []),
    getShopProducts({ shopId, page, size, categoryId, ...(sortMap[sort] || {}) }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
    getShopHead(shopId).catch(() => null),
    getShopDecorate(shopId).catch(() => null),
  ]);
  const hasDecorate = head?.pcDefaultStyle !== '1' && Boolean(decorate?.moduleList?.length);
  const pages = Math.max(1, Math.ceil(products.total / size));
  const hrefFor = (nextPage = page, nextCat = categoryId, nextSort = sort) => {
    const query = new URLSearchParams();
    if (nextCat) query.set('categoryId', nextCat);
    if (nextSort) query.set('sort', nextSort);
    if (nextPage > 1) query.set('page', String(nextPage));
    return query.toString() ? `/shop/${shopId}?${query.toString()}` : `/shop/${shopId}`;
  };
  const sortHref = (key: string) => hrefFor(1, categoryId, key);

  if (hasDecorate) {
    return (
      <div className="shop-detail-page">
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
      <PcHeader config={header as any} />
      <main className="shop-detail-main">
        <div className="shop-detail-container">
          <section className="shop-detail-header">
            <Link href={`/shop/${shopId}`} className="shop-detail-logo">
              <img src={shop?.shopLogo || ''} alt={shop?.shopTitle || ''} />
            </Link>
            <div className="shop-detail-meta">
              <h1>{shop?.shopTitle || '店铺详情'}</h1>
              <div className="shop-detail-rating">
                <span>{shop?.shopStar ? `${Number(shop.shopStar).toFixed(1)} 分` : '暂无评分'}</span>
                <span>{Number(shop?.collectCount || 0)} 粉丝</span>
              </div>
              {shop?.description ? <p>{shop.description}</p> : null}
            </div>
          </section>

          <div className="shop-detail-body">
            <aside className="shop-category-menu">
              <Link href={hrefFor(1, '', sort)} className={!categoryId ? 'is-active' : ''}>全部商品</Link>
              {categories.map((category: any) => (
                <div className="shop-category-group" key={category.categoryId}>
                  <Link href={hrefFor(1, String(category.categoryId), sort)} className={String(category.categoryId) === categoryId ? 'is-active' : ''}>
                    {category.categoryName}
                  </Link>
                  {(category.children || []).map((child: any) => (
                    <Link key={child.categoryId} className={`shop-category-child${String(child.categoryId) === categoryId ? ' is-active' : ''}`} href={hrefFor(1, String(child.categoryId), sort)}>
                      {child.categoryName}
                    </Link>
                  ))}
                </div>
              ))}
            </aside>

            <section className="shop-detail-products">
              <div className="shop-detail-sort">
                <Link href={sortHref('')} className={!sort ? 'is-active' : ''}>综合</Link>
                <Link href={sortHref('sale')} className={sort === 'sale' ? 'is-active' : ''}>销量</Link>
                <Link href={sortHref('time')} className={sort === 'time' ? 'is-active' : ''}>新品</Link>
                <Link href={sortHref('price')} className={sort === 'price' ? 'is-active' : ''}>价格</Link>
              </div>
              {products.records.length ? (
                <ul className="shop-detail-grid">
                  {products.records.map((product: any) => (
                    <li key={product.productId}>
                      <Link href={`/product/${product.productId}`} className="shop-detail-card" target="_blank">
                        <div className="shop-detail-card__img">
                          <img src={product.picThumb || product.picUrl || ''} alt={product.productName || ''} loading="lazy" />
                        </div>
                        <div className="shop-detail-card__name">{product.productName}</div>
                        <div className="shop-detail-card__price">¥ {Number(product.productPrice || 0).toFixed(2)}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="shop-detail-empty">暂无商品</div>
              )}
              {products.records.length > 0 && pages > 1 ? (
                <nav className="shop-detail-pagination">
                  {page > 1 ? <Link href={hrefFor(page - 1)}>上一页</Link> : <span className="is-disabled">上一页</span>}
                  <span>{page} / {pages}</span>
                  {page < pages ? <Link href={hrefFor(page + 1)}>下一页</Link> : <span className="is-disabled">下一页</span>}
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

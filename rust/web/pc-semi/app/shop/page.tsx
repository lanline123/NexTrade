import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import { getPcHeader, getShopList, type ShopListItem } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '店铺街 · 万物新生',
  description: '平台入驻店铺列表，查看店铺热销商品。',
};

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function formatFans(count?: number): string {
  const n = Number(count || 0);
  return n > 999999 ? `${Math.floor(n / 100) / 100}w` : String(n);
}

function shopHref(shop: ShopListItem): string {
  return `/shop/${shop.shopId}`;
}

export default async function ShopListPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const size = 10;
  const keyword = readParam(searchParams?.keyword);
  const sort = readParam(searchParams?.sort) === 'shopStar' ? 'shopStar' : '';
  const [data, header] = await Promise.all([
    getShopList({ page, size, keyword, sortField: sort || undefined }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const hrefFor = (nextPage: number, nextSort = sort) => {
    const query = new URLSearchParams();
    if (keyword) query.set('keyword', keyword);
    if (nextSort) query.set('sort', nextSort);
    if (nextPage > 1) query.set('page', String(nextPage));
    return query.toString() ? `/shop?${query.toString()}` : '/shop';
  };

  return (
    <div className="shop-list-page">
      <PcHeader config={header as any} />
      <main className="shop-list-main">
        <div className="shop-list-container">
          <div className="shop-list-toolbar">
            <div className="shop-list-tabs">
              <Link href={hrefFor(1, '')} className={!sort ? 'is-active' : ''}>综合</Link>
              <Link href={hrefFor(1, 'shopStar')} className={sort === 'shopStar' ? 'is-active' : ''}>评分</Link>
            </div>
            <form action="/shop" method="get" className="shop-list-search">
              <input name="keyword" defaultValue={keyword} placeholder="搜索店铺" />
              {sort ? <input type="hidden" name="sort" value={sort} /> : null}
              <button type="submit">搜索</button>
            </form>
          </div>

          {data.records.length ? (
            <div className="shop-rows">
              {data.records.map((shop) => (
                <article className="shop-row" key={shop.shopId}>
                  <div className="shop-info-card">
                    <Link href={shopHref(shop)} className="shop-logo" target="_blank">
                      <img src={shop.shopLogo || ''} alt={shop.shopTitle || ''} loading="lazy" />
                    </Link>
                    <div className="shop-content">
                      <Link href={shopHref(shop)} target="_blank" className="shop-name">{shop.shopTitle || '未命名店铺'}</Link>
                      <div className="shop-rating-row">
                        <span>{shop.shopStar ? `${Number(shop.shopStar).toFixed(1)} 分` : '暂无评分'}</span>
                        <span>{formatFans(shop.collectCount)} 粉丝</span>
                      </div>
                      <Link href={shopHref(shop)} target="_blank" className="enter-shop-btn">进入店铺</Link>
                    </div>
                  </div>
                  <div className="shop-product-list">
                    {(shop.listingProduct || []).slice(0, 6).map((product) => (
                      <Link className="shop-product-item" key={`${shop.shopId}-${product.productId}`} href={`/product/${product.productId || ''}`} target="_blank">
                        <div className="shop-product-img">
                          <img src={product.picThumb || product.picUrl || ''} alt={product.productName || ''} loading="lazy" />
                        </div>
                        <div className="shop-product-price">¥ {Number(product.productPrice || 0).toFixed(2)}</div>
                      </Link>
                    ))}
                    {!(shop.listingProduct || []).length ? <div className="shop-product-empty">暂无商品</div> : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="shop-list-empty">暂无店铺数据</div>
          )}

          {data.records.length > 0 && pages > 1 ? (
            <nav className="shop-pagination">
              {page > 1 ? <Link href={hrefFor(page - 1)}>上一页</Link> : <span className="is-disabled">上一页</span>}
              <span>{page} / {pages}</span>
              {page < pages ? <Link href={hrefFor(page + 1)}>下一页</Link> : <span className="is-disabled">下一页</span>}
            </nav>
          ) : null}
        </div>
      </main>
      <PcFooter />
    </div>
  );
}

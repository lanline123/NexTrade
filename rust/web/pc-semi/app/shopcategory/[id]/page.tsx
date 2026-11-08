import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import ProductGrid from '@/components/ProductGrid';
import ShopHeader from '@/components/ShopHeader';
import { getShopCategories, getShopDetail, getShopProducts, type ShopCategoryNode } from '@/lib/api';

import { getServerT } from '@/i18n/server';
/**
 * 店铺分类页。
 * 源码对照：
 *   pages/shopCategory/[id].vue（薄壳）→ pages/shopCategory/src/ShopCategory.vue
 *   + components/shopCategory/LeftMenu.vue（左侧折叠分类树）
 * 样式：app/shop-page.scss → .pg-shop-category / .pg-shop-left-menu
 *
 * 结构（ShopCategory.vue <template>）：
 *   页头 + （装修 shopInfo 模块 → ShopHeader）+ .page-info > LeftMenu(.menu-list) + .product-list > CatGoodsList + 页脚
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

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const t = getServerT();
  const shop = await getShopDetail(Number(params.id) || 0).catch(() => null);
  const categoryId = read(searchParams?.categoryId) || read(searchParams?.shopCategoryId);
  const query = categoryId ? `?categoryId=${encodeURIComponent(categoryId)}` : '';
  return {
    title: `${shop?.shopTitle || t('店铺商品')} · 店铺分类 · 万物新生`,
    description: shop?.description || t('店铺商品分类'),
    alternates: { canonical: `${SITE_URL}/shopcategory/${params.id}${query}` },
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

  const [categories, products, shop] = await Promise.all([
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
    getShopDetail(shopId).catch(() => null),
  ]);
  const flat = flattenCategories(categories);
  const pages = Math.max(1, Math.ceil(products.total / size));

  const hrefFor = (nextPage = page, nextCat = categoryId) => {
    const query = new URLSearchParams();
    if (nextCat) query.set('categoryId', nextCat);
    if (nextPage > 1) query.set('page', String(nextPage));
    const suffix = query.toString();
    return suffix ? `/shopcategory/${shopId}?${suffix}` : `/shopcategory/${shopId}`;
  };

  return (
    <div className="pg-shop-category">
      <PcHeader />
      {/* 装修 shopInfo 模块 → ShopHeader（与店铺主页同一套 .shop-ref-header 类名） */}
      <ShopHeader
        shopInfo={{
          shopId,
          shopTitle: shop?.shopTitle,
          shopLogo: shop?.shopLogo,
          collectCount: shop?.collectCount,
          businessLicensePic: (shop as any)?.businessLicensePic,
          shopStar: Number(shop?.shopStar || 0),
          tipNames: shop?.shopStar ? [`${Number(shop.shopStar).toFixed(1)} 分`] : [],
        }}
        siteLogo={undefined}
        showShopSearch={false}
      />

      <div className="container">
        <div className="page-info">
          {/* components/shopCategory/LeftMenu.vue：.menu-list > .ico(.sub-title/.title) + .menu > .el-collapse */}
          <div className="pg-shop-left-menu">
            <div className="menu-list">
              <div className="ico">
                <div className="sub-title">CLASSIFICATION</div>
                <div className="title">▪︎ {t('商品分类')} ▪︎</div>
              </div>
              <div className="menu">
                <div className="el-collapse">
                  <div className="el-collapse-item">
                    <div className="el-collapse-item__header">
                      <Link href={hrefFor(1, '')} className={`title${!categoryId ? ' pitch-on' : ''}`}>
                        {t('全部商品')}
                      </Link>
                    </div>
                  </div>
                  {flat
                    .filter((node) => node.depth === 0)
                    .map((node) => {
                      const children = (categories || []).find((item) => String(item.categoryId) === node.id)?.children || [];
                      const open = categoryId === node.id || children.some((child) => String(child.categoryId) === categoryId);
                      return (
                        <div className={`el-collapse-item${open ? ' is-active' : ''}`} key={node.id}>
                          <div className={`el-collapse-item__header${open ? ' is-active' : ''}`}>
                            <Link href={hrefFor(1, node.id)} className="title">
                              {node.name}
                            </Link>
                          </div>
                          <div className="el-collapse-item__wrap" style={open ? undefined : { display: 'none' }}>
                            <div className="min-menu">
                              {(children || []).map((child) => {
                                const childId = String(child.categoryId);
                                return (
                                  <Link
                                    key={childId}
                                    href={hrefFor(1, childId)}
                                    className={`item-menu${categoryId === childId ? ' pitch-on' : ''}`}
                                  >
                                    {child.categoryName}
                                  </Link>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>

          <div className="product-list">
            <div className={`goods-list__box${products.records.length ? '' : ' goods-list__box--empty'}`}>
              <div className="goods-list-c">
                <ProductGrid products={products.records} showSales showShopTag gridClassName="wrap" />
              </div>
            </div>

            {pages > 1 ? (
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
      </div>

      <PcFooter />
    </div>
  );
}

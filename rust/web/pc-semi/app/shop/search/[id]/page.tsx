import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import ShopHeader from '@/components/ShopHeader';
import ShopCategoryMenu from '@/components/ShopCategoryMenu';
import ProductGrid from '@/components/ProductGrid';
import { getPcHeader, getShopCategories, getShopDetail, getShopProducts } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
  title: t('店内搜索 · 万物新生'),
  description: t('店铺内商品搜索，支持综合 / 销量 / 新品 / 价格排序与属性筛选。'),
};
}

/**
 * 店内搜索页（真实 SSR 页面，不再 redirect 到 /search）。
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/shop/search/[id].vue +
 * ShopSearchLayoutClassic.vue / ShopSearchLayoutModern.vue / ShopRefHeader.vue。
 * - shopId 取自路径 [id]，getShopProducts 始终带 shopId 限定店内范围
 * - ?ui=new|old 在 Modern（无左侧分类）/ Classic（左侧分类树）两套布局间切换，默认 new
 * - 综合/销量/新品/价格排序、分类、attrs 属性、关键词、分页全部通过 URL query 保持状态
 */
function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

const SORT_TABS = [
  { key: '', label: '综合' },
  { key: 'sale', label: '销量' },
  { key: 'time', label: '新品' },
  { key: 'price', label: '价格' },
];

export default async function ShopSearchRedirect({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
    const t = getServerT();
  const shopId = Number(params.id) || 0;
  const ui = readParam(searchParams?.ui) === 'old' ? 'old' : 'new';
  const isClassic = ui === 'old';
  const keyword = readParam(searchParams?.keyword);
  const cat = readParam(searchParams?.cat) || readParam(searchParams?.categoryId);
  const sort = readParam(searchParams?.sort);
  const order = readParam(searchParams?.order) === 'asc' ? 'asc' : 'desc';
  const minPrice = readParam(searchParams?.minPrice);
  const maxPrice = readParam(searchParams?.maxPrice);
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const size = 24;

  /**
   * attrs：源码 ShopSearchLayoutModern 传给 CatGoodsList 的属性数组，后端 getShopProducts
   * 暂未透传属性过滤，这里把已选属性串（形如 "颜色:红色,尺寸:M"）保持在 URL query，
   * 通过 GET 表单追加属性、通过 Link 移除属性，SSR 渲染不依赖客户端 hook。
   */
  const rawAttrs = readParam(searchParams?.attrs);
  const attrAdd = readParam(searchParams?.attr).trim();
  const attrList = rawAttrs.split(',').map((pair) => pair.trim()).filter(Boolean);
  const attrs = attrAdd && !attrList.includes(attrAdd)
    ? (rawAttrs ? `${rawAttrs},${attrAdd}` : attrAdd)
    : rawAttrs;
  const attrPairs = attrs.split(',').map((pair) => pair.trim()).filter(Boolean);

  const sortMap: Record<string, { sortField?: string; sortOrder?: 'asc' | 'desc' }> = {
    sale: { sortField: 'sale' },
    time: { sortField: 'time' },
    price: { sortField: 'price', sortOrder: order },
  };

  const [shop, categories, products, header] = await Promise.all([
    getShopDetail(shopId).catch(() => null),
    getShopCategories(shopId).catch(() => []),
    getShopProducts({
      shopId,
      page,
      size,
      categoryId: cat || undefined,
      keyword: keyword || undefined,
      minPrice: minPrice || undefined,
      maxPrice: maxPrice || undefined,
      ...(sortMap[sort] || {}),
    }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(products.total / size));

  /** 排序 / 筛选 / 分页通过 URL query 保持状态 */
  const hrefFor = (patch: Record<string, string | number | undefined> = {}) => {
    const query = new URLSearchParams();
    const merged: Record<string, string | number | undefined> = {
      ui: isClassic ? 'old' : '',
      keyword,
      cat,
      sort,
      order: sort === 'price' ? order : '',
      attrs,
      minPrice,
      maxPrice,
      ...patch,
    };
    Object.entries(merged).forEach(([key, value]) => {
      if (value === undefined || value === '') return;
      if (key === 'page' && Number(value) <= 1) return;
      query.set(key, String(value));
    });
    const qs = query.toString();
    return qs ? `/shop/search/${shopId}?${qs}` : `/shop/search/${shopId}`;
  };

  const priceNextOrder = sort === 'price' && order === 'asc' ? 'desc' : 'asc';
  const sortHref = (key: string) => hrefFor({ sort: key, order: key === 'price' ? priceNextOrder : '', page: 1 });
  const removeAttrHref = (target: string) => hrefFor({
    attrs: attrPairs.filter((pair) => pair !== target).join(','),
    page: 1,
  });

  const shopInfo = {
    shopId,
    shopTitle: shop?.shopTitle,
    shopLogo: shop?.shopLogo,
    collectCount: shop?.collectCount,
    collectShop: Boolean((shop as any)?.collectShop),
    businessLicensePic: (shop as any)?.businessLicensePic,
    tipNames: shop?.shopStar ? [`${Number(shop.shopStar).toFixed(1)} 分`] : [],
  };

  /** 源码 ShopSearchLayoutModern.vue：shop-sort-bar 综合 / 销量 / 新品 / 价格 */
  const sortBar = (
    <div className="shop-sort-bar" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
      {SORT_TABS.map((tab) => {
        const active = sort === tab.key;
        return (
          <Link
            key={tab.key || 'default'}
            href={sortHref(tab.key)}
            className={`sort-link${active ? ' cur_sort' : ''}`}
            style={{
              display: 'inline-flex', alignItems: 'center', height: 31, boxSizing: 'border-box',
              padding: '9px 12px', fontSize: 14, borderRadius: 4, textDecoration: 'none',
              background: active ? 'var(--primary-light-9, #fff0f3)' : '#f5f5f5',
              color: active ? 'var(--pc-primary, #e01222)' : '#333',
            }}
          >
            {tab.label}
            {tab.key === 'price' ? (
              <span className="sort-arrow" style={{ display: 'inline-flex', flexDirection: 'column', marginLeft: 6, lineHeight: 1 }}>
                <i style={{ fontSize: 10, fontStyle: 'normal', color: active && order === 'asc' ? 'var(--pc-primary, #e01222)' : '#ccc' }}>▲</i>
                <i style={{ fontSize: 10, fontStyle: 'normal', color: active && order === 'desc' ? 'var(--pc-primary, #e01222)' : '#ccc' }}>▼</i>
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );

  /** 分类筛选（真实透传 categoryId）+ attrs 属性筛选（URL query 状态 / 已选 tag） */
  const attrsBar = (
    <div className="shop-search-attrs" style={{ borderTop: '1px solid #f0f0f0', padding: '12px 0', marginBottom: 12 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 13, color: '#888' }}>{t('分类：')}</span>
        <Link href={hrefFor({ cat: '', page: 1 })} style={{ fontSize: 13, padding: '4px 10px', borderRadius: 4, textDecoration: 'none', background: cat ? '#f5f5f5' : 'var(--primary-light-9, #fff0f3)', color: cat ? '#333' : 'var(--pc-primary, #e01222)' }}>{t('全部')}</Link>
        {categories.map((category) => (
          <Link
            key={String(category.categoryId)}
            href={hrefFor({ cat: String(category.categoryId), page: 1 })}
            style={{ fontSize: 13, padding: '4px 10px', borderRadius: 4, textDecoration: 'none', background: cat === String(category.categoryId) ? 'var(--primary-light-9, #fff0f3)' : '#f5f5f5', color: cat === String(category.categoryId) ? 'var(--pc-primary, #e01222)' : '#333' }}
          >
            {category.categoryName}
          </Link>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <span style={{ fontSize: 13, color: '#888' }}>{t('属性：')}</span>
        {attrPairs.length ? attrPairs.map((pair) => (
          <span key={pair} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '3px 8px', border: '1px solid var(--pc-primary, #e01222)', borderRadius: 12, color: 'var(--pc-primary, #e01222)' }}>
            {pair}
            <Link href={removeAttrHref(pair)} style={{ color: 'inherit', textDecoration: 'none' }}>×</Link>
          </span>
        )) : <span style={{ fontSize: 12, color: '#bbb' }}>{t('未选择')}</span>}
        <form action={`/shop/search/${shopId}`} method="get" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          {isClassic ? <input type="hidden" name="ui" value="old" /> : null}
          {keyword ? <input type="hidden" name="keyword" value={keyword} /> : null}
          {cat ? <input type="hidden" name="cat" value={cat} /> : null}
          {sort ? <input type="hidden" name="sort" value={sort} /> : null}
          {sort === 'price' ? <input type="hidden" name="order" value={order} /> : null}
          {attrs ? <input type="hidden" name="attrs" value={attrs} /> : null}
          {minPrice ? <input type="hidden" name="minPrice" value={minPrice} /> : null}
          {maxPrice ? <input type="hidden" name="maxPrice" value={maxPrice} /> : null}
          <input name="attr" placeholder={t('属性:值')} style={{ width: 96, height: 26, padding: '0 8px', border: '1px solid #ddd', borderRadius: 4, fontSize: 12 }} />
          <button type="submit" style={{ height: 26, padding: '0 10px', border: '1px solid #ddd', borderRadius: 4, background: '#fff', fontSize: 12, cursor: 'pointer' }}>{t('添加')}</button>
        </form>
      </div>
    </div>
  );

  const pagination = products.records.length > 0 && pages > 1 ? (
    <nav className="shop-search-pagination" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, padding: '16px 0', fontSize: 14 }}>
      {page > 1 ? <Link href={hrefFor({ page: page - 1 })}>{t('上一页')}</Link> : <span style={{ color: '#bbb' }}>{t('上一页')}</span>}
      <span>{page} / {pages}</span>
      {page < pages ? <Link href={hrefFor({ page: page + 1 })}>{t('下一页')}</Link> : <span style={{ color: '#bbb' }}>{t('下一页')}</span>}
    </nav>
  ) : null;

  /**
   * 旧版 UI（?ui=old）：源码 ShopSearchLayoutClassic.vue 的模板是
   *   页头 + ShopHeader（.shop-ref-header）+ .container > .page-info > CatGoodsList + 页脚
   * 没有左侧分类树、没有属性栏、没有排序条（排序/筛选都在 CatGoodsList 自己的筛选面板里），
   * 所以旧版这里直接出 .goods-list__box > .goods-list-c > .wrap（复用 ProductGrid）＋分页。
   */
  if (isClassic) {
    return (
      <div className="pg-shop-search-classic">
        <PcHeader config={header as any} />
        <ShopHeader shopInfo={shopInfo} siteLogo={undefined} isShopSearchPage showShopSearch={false} />
        <div className="container">
          <div className="page-info">
            <div className={`goods-list__box${products.records.length ? '' : ' goods-list__box--empty'}`}>
              <div className="goods-list-c">
                <ProductGrid products={products.records} gridClassName="wrap" />
              </div>
            </div>
            {products.records.length > 0 && pages > 1 ? (
              <div className="pagination">
                <nav className="el-pagination">
                  {page > 1 ? (
                    <Link href={hrefFor({ page: page - 1 })} className="btn-prev">
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
                      <Link href={hrefFor({ page: next })} className="number" key={next}>
                        {next}
                      </Link>
                    );
                  })}
                  {page < pages ? (
                    <Link href={hrefFor({ page: page + 1 })} className="btn-next">
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
    );
  }

  return (
    <div className="shop-search-page" style={{ background: '#f5f5f5', minHeight: '100vh' }}>
      <PcHeader config={header as any} />
      <main className={isClassic ? 'shop-search-main shop-search-main--classic' : 'shop-search-main shop-search-main--modern'} style={{ maxWidth: 1700, margin: '0 auto', padding: '16px 50px 40px' }}>
        {/* 源码 ShopRefHeader.vue / ShopHeader.tsx：店铺资质 / 粉丝 / 评分 / 搜索 */}
        <ShopHeader shopInfo={shopInfo} siteLogo={undefined} />

        {/* 关注 / 客服入口 + 店内搜索关键词 + 新旧布局切换（全部走 URL query） */}
        <div className="shop-search-actions" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, background: '#fff', padding: '10px 16px', borderRadius: 12, marginBottom: 16 }}>
          <Link href={`/shop/${shopId}`} style={{ fontSize: 13, color: '#333', textDecoration: 'none' }}>{t('店铺首页')}</Link>
          <Link href={`/chat?shopId=${shopId}`} style={{ fontSize: 13, color: '#333', textDecoration: 'none' }}>{t('客服')}</Link>
          <Link href="/member/collectshop" style={{ fontSize: 13, color: 'var(--pc-primary, #e01222)', textDecoration: 'none' }}>{shopInfo.collectShop ? t('已关注') : '+ 关注'}</Link>
          <form action={`/shop/search/${shopId}`} method="get" style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
            {isClassic ? <input type="hidden" name="ui" value="old" /> : null}
            {cat ? <input type="hidden" name="cat" value={cat} /> : null}
            <input name="keyword" defaultValue={keyword} placeholder={t('搜索本店商品')} style={{ width: 180, height: 28, padding: '0 8px', border: '1px solid #e2e4e6', borderRadius: 6, fontSize: 13 }} />
            <button type="submit" style={{ height: 28, padding: '0 14px', border: 0, borderRadius: 6, background: 'var(--pc-primary, #e01222)', color: '#fff', fontSize: 13, cursor: 'pointer' }}>{t('搜本店')}</button>
          </form>
          <span style={{ fontSize: 12, color: '#999', marginLeft: 'auto' }}>{t('布局：')}</span>
          <Link href={hrefFor({ ui: '' })} style={{ fontSize: 12, color: isClassic ? '#999' : 'var(--pc-primary, #e01222)', textDecoration: 'none' }}>{t('新版')}</Link>
          <Link href={hrefFor({ ui: 'old' })} style={{ fontSize: 12, color: isClassic ? 'var(--pc-primary, #e01222)' : '#999', textDecoration: 'none' }}>{t('旧版')}</Link>
        </div>

        <div className="shop-search-body" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          {/* Classic：左侧店铺分类树（源码 ShopSearchLayoutClassic + ShopCategoryMenu） */}
          {isClassic ? (
            <aside className="shop-search-side" style={{ width: 220, flexShrink: 0, background: '#fff', padding: 12, borderRadius: 12 }}>
              <ShopCategoryMenu shopId={shopId} categories={categories as any} currentCategoryId={cat} />
            </aside>
          ) : null}

          {/* Modern：右侧全宽内容；Classic：右侧商品区 */}
          <section className="shop-search-content" style={{ flex: 1, minWidth: 0, background: '#fff', padding: 16, borderRadius: 16, overflow: 'hidden' }}>
            {sortBar}
            {attrsBar}
            {/* 源码 CatGoodsList.vue 商品卡：统一复用 ProductGrid */}
            <ProductGrid products={products.records} showSales showShopTag />
            {pagination}
          </section>
        </div>
      </main>
      <PcFooter />
    </div>
  );
}

/**
 * 搜索页多版式布局（纯服务端组件，不引入客户端 hook）。
 *
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/search/
 *   - filterStyle=1 侧栏版：SearchLayoutSide.vue + FilterSide.vue + SortFilterSide.vue
 *   - filterStyle=2 顶部版：search.vue 内联 + Filter.vue + SortFilter.vue（主页面自带）
 * 经典版 /search.v1：
 *   - uiVersion=old  → SearchLayoutClassic.vue（已选条件回显 + 分类导航 + 商品列表）
 *   - uiVersion=new  → SearchLayoutModern.vue（横向分类条 + 顶部翻页 + 排序条）
 *
 * 三套共用同一份取数结果，差异体现在结构与交互入口，不靠同一个 DOM 换 CSS 类。
 */

import Link from 'next/link';
import ProductGrid from '@/components/ProductGrid';
import type { ProductListItem } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export interface SearchAttrItem {
  name?: string;
  values?: Array<{ value?: string }>;
}

export interface SearchSelectedAttr {
  attrName: string;
  attrValue: string[];
}

export interface SearchLayoutContext {
  listPath: string;
  keyword: string;
  cat: string;
  brand: string;
  min: string;
  max: string;
  page: number;
  total: number;
  pages: number;
  sortKey: string;
  priceRange: string;
  categories: Array<{ id: string; name: string }>;
  brands: Array<{ id: string; name: string; firstWord: string; logo: string }>;
  esAttrs: SearchAttrItem[];
  selectedAttrs: SearchSelectedAttr[];
  records: ProductListItem[];
  showSales: boolean;
  showShopTag: boolean;
  showPriceRange: boolean;
  filterTemplate: number;
  buildQuery: (overrides: Record<string, string | string[] | undefined>, basePage?: number) => string;
  toggleAttr: (name: string, value: string) => string;
  attrSelected: (name: string, value: string) => boolean;
  serializeSelectedAttrs: (attrs: SearchSelectedAttr[]) => string[];
}

/** 与 app/search/page.tsx 的 SORTS / PRICE_RANGES 保持一致。 */
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

function sortHref(ctx: SearchLayoutContext, key: string): string {
  const overrides =
    key === 'default'
      ? { sort: undefined, order: undefined }
      : key === 'sale'
        ? { sort: 'sale', order: 'desc' }
        : key === 'time'
          ? { sort: 'time', order: 'desc' }
          : { sort: 'price', order: key === 'price-asc' ? 'asc' : 'desc' };
  return `${ctx.listPath}${ctx.buildQuery(overrides, 1)}`;
}

/** 原版 CommonCategoryNavigation / nav-selected：已选条件 chips，可逐项点击清除。 */
function SelectedChips({ ctx }: { ctx: SearchLayoutContext }) {
    const t = getServerT();
  const chips: Array<{ label: string; href: string }> = [];
  if (ctx.keyword) chips.push({ label: t('关键词：{kw}', { kw: ctx.keyword }), href: `${ctx.listPath}${ctx.buildQuery({ keyword: undefined }, 1)}` });
  if (ctx.cat) {
    const name = ctx.categories.find((item) => item.id === ctx.cat)?.name || ctx.cat;
    chips.push({ label: t('分类：{name}', { name }), href: `${ctx.listPath}${ctx.buildQuery({ cat: undefined }, 1)}` });
  }
  if (ctx.brand) {
    ctx.brand.split(',').filter(Boolean).forEach((id) => {
      const name = ctx.brands.find((item) => item.id === id)?.name || id;
      const rest = ctx.brand.split(',').filter((entry) => entry && entry !== id).join(',');
      chips.push({ label: t('品牌：{name}', { name }), href: `${ctx.listPath}${ctx.buildQuery({ brand: rest || undefined }, 1)}` });
    });
  }
  if (ctx.min || ctx.max) {
    chips.push({ label: t('价格：{a} - {b}', { a: ctx.min || '0', b: ctx.max || t('不限') }), href: `${ctx.listPath}${ctx.buildQuery({ min: undefined, max: undefined }, 1)}` });
  }
  ctx.selectedAttrs.forEach((attr) => {
    attr.attrValue.forEach((value) => {
      const rest = ctx.selectedAttrs
        .map((entry) => ({ ...entry, attrValue: entry.attrName === attr.attrName ? entry.attrValue.filter((item) => item !== value) : entry.attrValue }))
        .filter((entry) => entry.attrValue.length > 0);
      chips.push({ label: `${attr.attrName}：${value}`, href: `${ctx.listPath}${ctx.buildQuery({ attr: ctx.serializeSelectedAttrs(rest) }, 1)}` });
    });
  });
  if (!chips.length) return null;
  return (
    <div className="pc-search-selected">
      <span className="pc-search-selected__label">{t('已选条件：')}</span>
      {chips.map((chip, index) => (
        <Link className="pc-search-selected__chip" key={`${chip.label}-${index}`} href={chip.href}>
          {chip.label}<i>×</i>
        </Link>
      ))}
      <Link className="pc-search-selected__clear" href={`${ctx.listPath}${ctx.buildQuery({ keyword: undefined, cat: undefined, brand: undefined, min: undefined, max: undefined, attr: [] }, 1)}`}>{t('清除全部')}</Link>
    </div>
  );
}

function SortBar({ ctx, extra }: { ctx: SearchLayoutContext; extra?: React.ReactNode }) {
  return (
    <div className="pc-list-toolbar pc-search-variant-sort">
      <div className="pc-list-sorts">
        {SORTS.map((item) => (
          <Link key={item.key} href={sortHref(ctx, item.key)} className={ctx.sortKey === item.key ? 'is-active' : ''}>
            {item.label}
          </Link>
        ))}
      </div>
      {extra ?? <span className="pc-list-filter-tip">共 {ctx.total} 件商品</span>}
    </div>
  );
}

function PriceForm({ ctx, className = '' }: { ctx: SearchLayoutContext; className?: string }) {
    const t = getServerT();
  /* 传入自定义 className 时视为「自带皮肤」（经典版/侧栏版）：
     不再挂 modern.scss 全局皮肤类（.pc-search-price-form/.pc-search-price-input
     带 !important 会盖掉自定义样式） */
  const bare = className.trim().length > 0;
  return (
    <form action={ctx.listPath} method="get" className={bare ? className : 'pc-search-price-form'}>
      {ctx.keyword ? <input type="hidden" name="keyword" value={ctx.keyword} /> : null}
      {ctx.cat ? <input type="hidden" name="cat" value={ctx.cat} /> : null}
      {ctx.brand ? <input type="hidden" name="brand" value={ctx.brand} /> : null}
      {ctx.serializeSelectedAttrs(ctx.selectedAttrs).map((item) => (
        <input key={item} type="hidden" name="attr" value={item} />
      ))}
      <input type="text" name="min" placeholder={t('¥最低价')} defaultValue={ctx.min} className={bare ? '' : 'pc-search-price-input'} />
      <span> - </span>
      <input type="text" name="max" placeholder={t('¥最高价')} defaultValue={ctx.max} className={bare ? '' : 'pc-search-price-input'} />
      <button type="submit">{t('确定')}</button>
    </form>
  );
}

function Results({ ctx }: { ctx: SearchLayoutContext }) {
    const t = getServerT();
  return (
    <>
      <ProductGrid products={ctx.records} showSales={ctx.showSales} showShopTag={ctx.showShopTag} />
      {!ctx.records.length ? <div className="pc-list-empty">{t('没有找到符合条件的商品')}</div> : null}
      {ctx.pages > 1 ? (
        <nav className="pc-pagination">
          {ctx.page > 1 ? <Link href={`${ctx.listPath}${ctx.buildQuery({}, ctx.page - 1)}`}>{t('上一页')}</Link> : <span className="is-disabled">{t('上一页')}</span>}
          {Array.from({ length: Math.min(ctx.pages, 8) }).map((_, index) => {
            const next = index + 1;
            return (
              <Link key={next} href={`${ctx.listPath}${ctx.buildQuery({}, next)}`} className={next === ctx.page ? 'is-active' : ''}>
                {next}
              </Link>
            );
          })}
          {ctx.page < ctx.pages ? <Link href={`${ctx.listPath}${ctx.buildQuery({}, ctx.page + 1)}`}>{t('下一页')}</Link> : <span className="is-disabled">{t('下一页')}</span>}
        </nav>
      ) : null}
    </>
  );
}

/** 侧栏筛选版（filterStyle=1）：240px aside + 精简排序条。 */
export function SearchSideLayout({ ctx }: { ctx: SearchLayoutContext }) {
    const t = getServerT();
  const brandIds = ctx.brand.split(',').filter(Boolean);
  const toggleBrand = (id: string) => {
    const next = brandIds.includes(id) ? brandIds.filter((item) => item !== id) : [...brandIds, id];
    return `${ctx.listPath}${ctx.buildQuery({ brand: next.join(',') || undefined }, 1)}`;
  };
  return (
    <div className="pg-catalog-search-side pc-search-side-layout">
      <aside className="pc-search-side-filter">
        <div className="pc-search-side-filter__head">
          <h3>{t('筛选')}</h3>
          <Link href={`${ctx.listPath}${ctx.buildQuery({ cat: undefined, brand: undefined, min: undefined, max: undefined, attr: [] }, 1)}`}>{t('清空')}</Link>
        </div>

        {ctx.showPriceRange ? (
          <section className="pc-search-side-block">
            <h4>{t('价格区间')}</h4>
            <div className="pc-search-side-presets">
              {PRICE_RANGES.map((item) => (
                <Link
                  key={item.key}
                  href={`${ctx.listPath}${ctx.buildQuery({ min: item.min || undefined, max: item.max || undefined }, 1)}`}
                  className={ctx.priceRange === item.key ? 'is-active' : ''}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            <PriceForm ctx={ctx} className="pc-search-side-price" />
          </section>
        ) : null}

        {ctx.categories.length ? (
          <section className="pc-search-side-block">
            <h4>{t('分类')}</h4>
            <div className="pc-search-side-values">
              <Link href={`${ctx.listPath}${ctx.buildQuery({ cat: undefined }, 1)}`} className={!ctx.cat ? 'is-active' : ''}>{t('全部')}</Link>
              {ctx.categories.map((item) => (
                <Link key={item.id} href={`${ctx.listPath}${ctx.buildQuery({ cat: item.id }, 1)}`} className={ctx.cat === item.id ? 'is-active' : ''}>
                  {item.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {ctx.brands.length ? (
          <section className="pc-search-side-block">
            <h4>{t('品牌')}</h4>
            <div className="pc-search-side-values">
              {ctx.brands.map((item) => (
                <Link key={item.id} href={toggleBrand(item.id)} className={brandIds.includes(item.id) ? 'is-active' : ''}>
                  {item.firstWord ? <em>{item.firstWord}</em> : null}{item.name}
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {ctx.esAttrs.map((attr) => (
          <section className="pc-search-side-block" key={String(attr.name)}>
            <h4>{attr.name}</h4>
            <div className="pc-search-side-values">
              {(attr.values || []).map((option) => (
                <Link
                  key={String(option.value)}
                  href={ctx.toggleAttr(String(attr.name), String(option.value))}
                  className={ctx.attrSelected(String(attr.name), String(option.value)) ? 'is-active' : ''}
                >
                  {option.value}
                </Link>
              ))}
            </div>
          </section>
        ))}
      </aside>

      <main className="pc-search-side-main">
        <SelectedChips ctx={ctx} />
        <SortBar ctx={ctx} extra={<span className="pc-list-filter-tip">共 {ctx.total} 件商品 · {ctx.filterTemplate === 2 ? 6 : 5} 列</span>} />
        <Results ctx={ctx} />
      </main>
    </div>
  );
}

/**
 * 经典版 Classic：已选条件回显 + 商品筛选区 + 排序条 + 商品列表。
 * 源码对照 search.v1/src/SearchLayoutClassic.vue + components/common/{Filter,EsFilter}.vue：
 * 灰底「商品筛选」标题条 + 分类/品牌/属性行（纯文本项、品牌 Logo 卡片）+ 灰底排序条
 * （白底描边排序组 + ¥最低价-¥最高价 + 共 N 个商品 + N/M 翻页）。
 */
export function SearchClassicLayout({ ctx }: { ctx: SearchLayoutContext }) {
    const t = getServerT();
  const catName = ctx.categories.find((item) => item.id === ctx.cat)?.name || '';
  const brandIds = ctx.brand.split(',').filter(Boolean);
  const toggleBrandHref = (id: string) => {
    const next = brandIds.includes(id) ? brandIds.filter((item) => item !== id) : [...brandIds, id];
    return `${ctx.listPath}${ctx.buildQuery({ brand: next.join(',') || undefined }, 1)}`;
  };
  const priceNextKey = ctx.sortKey === 'price-asc' ? 'price-desc' : 'price-asc';
  return (
    <div className="pc-search-classic">
      <SelectedChips ctx={ctx} />

      {/* 原版 CommonFilter.vue：.filter__box */}
      <div className="classic-filter__box">
        {/* .sear-title：分类名 + 商品筛选 | 共 N 个商品 */}
        <div className="classic-sear-title">
          <h3>{catName ? <b>{catName}</b> : null}<em>{t('商品筛选')}</em></h3>
          <div className="st-ext">{t('共')}&nbsp;<span>{ctx.total}</span>&nbsp;{t('个商品')}</div>
        </div>

        <div className="classic-filter">
          {/* 分类行：纯文本项，hover/选中主题色 */}
          {ctx.categories.length ? (
            <div className="cf-list">
              <div className="cf-attr-name">{t('分类：')}</div>
              <div className="cf-attr-box">
                <div className="cf-category-link">
                  <Link href={`${ctx.listPath}${ctx.buildQuery({ cat: undefined }, 1)}`} className={`cf-item${!ctx.cat ? ' selected' : ''}`}>{t('全部')}</Link>
                  {ctx.categories.map((item) => (
                    <Link key={item.id} href={`${ctx.listPath}${ctx.buildQuery({ cat: item.id }, 1)}`} className={`cf-item${ctx.cat === item.id ? ' selected' : ''}`}>{item.name}</Link>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* 品牌行：110×45 Logo 卡片，hover 显名称，选中描边 + 右下角标 */}
          {ctx.brands.length ? (
            <div className="cf-list cf-brand">
              <div className="cf-attr-name">{t('品牌：')}</div>
              <div className="cf-attr-box">
                <div className="cf-brand-wrap">
                  {ctx.brands.map((item) => (
                    <Link key={item.id} href={toggleBrandHref(item.id)} className={`cf-brand-item${brandIds.includes(item.id) ? ' selected' : ''}`}>
                      {item.logo ? (
                        <span className="cf-brand-pic"><img src={item.logo} alt={item.name} /></span>
                      ) : (
                        <span className="cf-brand-nopic">{item.name}</span>
                      )}
                      <span className="cf-brand-name">{item.name}</span>
                      <i aria-hidden />
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* ES 属性行（原版 CommonEsFilter.vue）：标签 80px + 纯文本值 */}
          {ctx.esAttrs.map((attr) => (
            <div className="cf-list cf-attr" key={String(attr.name)}>
              <div className="cf-attr-list">
                <div className="cf-attr-name">{attr.name}：</div>
                <div className="cf-attr-box">
                  <div className="cf-category-link">
                    {(attr.values || []).map((option) => (
                      <Link
                        key={String(option.value)}
                        href={ctx.toggleAttr(String(attr.name), String(option.value))}
                        className={`cf-item${ctx.attrSelected(String(attr.name), String(option.value)) ? ' selected' : ''}`}
                      >
                        {option.value}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* 原版排序条：.cat-sort 灰底，白底描边排序组 + 价格表单 | 共 N 个商品 + N/M 翻页 */}
        <div className="classic-cat-sort">
          <div className="ccs-left">
            <div className="ccs-sorts">
              <Link href={sortHref(ctx, 'default')} className={ctx.sortKey === 'default' ? 'cur_sort' : ''}>{t('默认排序')}</Link>
              <Link href={sortHref(ctx, 'sale')} className={ctx.sortKey === 'sale' ? 'cur_sort' : ''}>{t('销量')}</Link>
              <Link href={sortHref(ctx, 'time')} className={ctx.sortKey === 'time' ? 'cur_sort' : ''}>{t('新品')}</Link>
              <Link href={sortHref(ctx, priceNextKey)} className={ctx.sortKey === 'price-asc' || ctx.sortKey === 'price-desc' ? 'cur_sort' : ''}>
                {t('价格')}
                <span className={`ccs-arrow${ctx.sortKey === 'price-desc' ? ' ccs-arrow--down' : ''}`} aria-hidden />
              </Link>
            </div>
            {ctx.showPriceRange ? <PriceForm ctx={ctx} className="ccs-priceform" /> : null}
          </div>
          <div className="ccs-right">
            <div className="ccs-productsNO">{t('共')}<em>{ctx.total}</em>{t('个商品')}</div>
            <div className="ccs-pageInfo">
              <span className="ccs-page_number">{ctx.page}/{ctx.pages}</span>
              {ctx.page > 1 ? (
                <Link className="ccs-page-btn" href={`${ctx.listPath}${ctx.buildQuery({}, ctx.page - 1)}`}>&lt;</Link>
              ) : (
                <span className="ccs-page-btn is-disabled">&lt;</span>
              )}
              {ctx.page < ctx.pages ? (
                <Link className="ccs-page-btn" href={`${ctx.listPath}${ctx.buildQuery({}, ctx.page + 1)}`}>&gt;</Link>
              ) : (
                <span className="ccs-page-btn is-disabled">&gt;</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <Results ctx={ctx} />
    </div>
  );
}

/** 经典版 Modern：横向分类条 + 顶部翻页器 + 排序条 + 商品列表。 */
export function SearchModernLayout({ ctx }: { ctx: SearchLayoutContext }) {
    const t = getServerT();
  return (
    <div className="pc-search-modern">
      <div className="pc-search-modern-cats">
        <Link href={`${ctx.listPath}${ctx.buildQuery({ cat: undefined }, 1)}`} className={!ctx.cat ? 'is-active' : ''}>{t('全部商品')}</Link>
        {ctx.categories.map((item) => (
          <Link key={item.id} href={`${ctx.listPath}${ctx.buildQuery({ cat: item.id }, 1)}`} className={ctx.cat === item.id ? 'is-active' : ''}>{item.name}</Link>
        ))}
      </div>

      <div className="pc-search-modern-tabs">
        <span>共 {ctx.total} 件商品</span>
        <div className="pc-search-modern-pager">
          {ctx.page > 1 ? <Link href={`${ctx.listPath}${ctx.buildQuery({}, ctx.page - 1)}`}>{t('‹ 上一页')}</Link> : <span className="is-disabled">{t('‹ 上一页')}</span>}
          <b>{ctx.page} / {ctx.pages}</b>
          {ctx.page < ctx.pages ? <Link href={`${ctx.listPath}${ctx.buildQuery({}, ctx.page + 1)}`}>{t('下一页 ›')}</Link> : <span className="is-disabled">{t('下一页 ›')}</span>}
        </div>
      </div>

      <SelectedChips ctx={ctx} />
      <SortBar ctx={ctx} extra={ctx.showPriceRange ? <PriceForm ctx={ctx} /> : undefined} />
      <Results ctx={ctx} />
    </div>
  );
}

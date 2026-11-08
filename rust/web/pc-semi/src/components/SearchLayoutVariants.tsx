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
  brands: Array<{ id: string; name: string; firstWord: string }>;
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
  return (
    <form action={ctx.listPath} method="get" className={`pc-search-price-form ${className}`}>
      {ctx.keyword ? <input type="hidden" name="keyword" value={ctx.keyword} /> : null}
      {ctx.cat ? <input type="hidden" name="cat" value={ctx.cat} /> : null}
      {ctx.brand ? <input type="hidden" name="brand" value={ctx.brand} /> : null}
      {ctx.serializeSelectedAttrs(ctx.selectedAttrs).map((item) => (
        <input key={item} type="hidden" name="attr" value={item} />
      ))}
      <input type="text" name="min" placeholder={t('最低价')} defaultValue={ctx.min} className="pc-search-price-input" />
      <span> - </span>
      <input type="text" name="max" placeholder={t('最高价')} defaultValue={ctx.max} className="pc-search-price-input" />
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

/** 经典版 Classic：已选条件回显 + 分类导航条 + 筛选 + 商品列表。 */
export function SearchClassicLayout({ ctx }: { ctx: SearchLayoutContext }) {
    const t = getServerT();
  return (
    <div className="pc-search-classic">
      <SelectedChips ctx={ctx} />
      <div className="pc-search-classic-nav">
        <span className="pc-search-filter-row__label">{t('商品分类：')}</span>
        <div className="pc-search-filter-row__values">
          <Link href={`${ctx.listPath}${ctx.buildQuery({ cat: undefined }, 1)}`} className={!ctx.cat ? 'is-active' : ''}>{t('全部')}</Link>
          {ctx.categories.map((item) => (
            <Link key={item.id} href={`${ctx.listPath}${ctx.buildQuery({ cat: item.id }, 1)}`} className={ctx.cat === item.id ? 'is-active' : ''}>{item.name}</Link>
          ))}
        </div>
      </div>

      {ctx.brands.length ? (
        <div className="pc-search-filter-row">
          <span className="pc-search-filter-row__label">{t('品牌：')}</span>
          <div className="pc-search-filter-row__values">
            {ctx.brands.map((item) => {
              const ids = ctx.brand.split(',').filter(Boolean);
              const next = ids.includes(item.id) ? ids.filter((id) => id !== item.id) : [...ids, item.id];
              return (
                <Link key={item.id} href={`${ctx.listPath}${ctx.buildQuery({ brand: next.join(',') || undefined }, 1)}`} className={ids.includes(item.id) ? 'is-active' : ''}>
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}

      {ctx.esAttrs.length ? (
        <div className="pc-search-attrs">
          {ctx.esAttrs.map((attr) => (
            <div key={String(attr.name)} className="pc-search-filter-row">
              <span className="pc-search-filter-row__label">{attr.name}：</span>
              {/* 旧版 pages/search/components/Tag.vue：<div class="tag" :class="{active}">；
                  .pg-catalog-search-tag 是该 .vue 的 <style> 作用域替身 */}
              <div className="pg-catalog-search-tag pc-search-filter-row__values">
                {(attr.values || []).map((option) => (
                  <Link key={String(option.value)} href={ctx.toggleAttr(String(attr.name), String(option.value))} className={`tag${ctx.attrSelected(String(attr.name), String(option.value)) ? ' active' : ''}`}>
                    {option.value}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <SortBar ctx={ctx} extra={ctx.showPriceRange ? <PriceForm ctx={ctx} /> : undefined} />
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

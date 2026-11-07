import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import ProductGrid from '@/components/ProductGrid';
import SearchBrandFilter from '@/components/SearchBrandFilter';
import SearchAllFilterPanel from '@/components/SearchAllFilterPanel';
import { SearchSideLayout, SearchClassicLayout, SearchModernLayout, type SearchLayoutContext } from '@/components/SearchLayoutVariants';
import { getPcHeader } from '@/lib/api';
import type { ProductListItem } from '@/lib/api';
import PcFooter from '@/components/PcFooter';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

/**
 * PC 搜索页（源码对照 java-b2b2c-overseas-v5.8.61/view/pc/pages/search）
 *
 * 旧版取数（pages/search/components/api.ts）：
 * - 筛选项：POST /api/search/search/getFilter
 * - ES 属性筛选项：POST /api/search/search/getEsFilter（返回 attributes [{ name, values: [{ value }] }]）
 * - 商品列表：POST /api/search/search/getProduct，参数
 *   { keyword, cat, pId, page, size, brand(逗号), sort(sale|price|time), order(asc|desc), min, max,
 *     attrs: [{ attrName, attrValue: string[] }] }
 * - 店铺列表：GET /api/shop/shop/list?keyword=&page=&size=（旧版「店铺」Tab，SearchShopList.vue）
 * - 排序：默认 / 销量(sale) / 价格(price asc|desc) / 最新(time desc)
 * - 价格区间支持预设与自定义 min/max（旧版 SortFilter 区间下拉）
 *
 * 当前实现覆盖：关键词/分类/品牌/价格区间/销量/价格/最新排序 + 分页 +
 * ES 属性筛选（URL `attr=名称::值`，可多值）+「全部商品 / 店铺」Tab。
 */

const SERVER_API_BASE = (process.env.PC_API_BASE || 'https://battery.recy.cc').replace(/\/$/, '');

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

/** 复用路由传入的额外参数。Next 要求 generateMetadata 只用 PageProps，故单独定义。 */
interface SearchPageProps extends PageProps {
  /** 原版 pageType：/list、/category/* 复用同一套搜索组件时保持站内路径 */
  pageType?: string;
  /** 经典版 /search.v1 的两套布局：?ui=new 走 modern，默认 classic */
  variant?: 'classic' | 'modern';
}

interface SearchFilterCategory {
  id?: string | number;
  categoryId?: string | number;
  categoryName?: string;
  name?: string;
}

interface SearchFilterBrand {
  id?: string | number;
  brandId?: string | number;
  brandName?: string;
  name?: string;
  firstWord?: string;
  first_word?: string;
}

interface SearchFilterEnvelope {
  filter?: {
    brand?: SearchFilterBrand[];
    brands?: SearchFilterBrand[];
    category?: SearchFilterCategory[];
    categories?: SearchFilterCategory[];
    maxPrice?: number | string;
    attrs?: EsAttrItem[];
  };
  filterSelected?: { keyword?: string; brand?: string; category?: string };
}

interface EsAttrOption {
  value?: string;
  checked?: boolean;
}

interface EsAttrItem {
  name?: string;
  attrName?: string;
  values?: EsAttrOption[];
}

interface EsAttrEnvelope {
  attributes?: EsAttrItem[];
}

interface SelectedAttr {
  attrName: string;
  attrValue: string[];
}

interface SearchProductEnvelope {
  records?: Array<Record<string, any>>;
  total?: number;
}

interface ShopItem {
  shopId?: string | number;
  shopTitle?: string;
  shopLogo?: string;
  shopBanner?: string;
  shopStar?: string | number;
  productCount?: string | number;
}

interface ShopListEnvelope {
  records?: ShopItem[];
  total?: number;
}

/** PC 搜索页装修配置（旧版 store/decorateRuntime.ts PcSearchModuleData + home/home/pcSearch）。 */
interface PcSearchConfig {
  backgroundColor: string;
  themeColor: string;
  filterStyle: number;
  filterTemplate: number;
  showFilterPanel: boolean;
  showPriceRange: boolean;
  showShopTag: boolean;
  showSales: boolean;
  showCartButton: boolean;
  goodsStyle: number;
  goodsRadiusStyle: number;
  buyStyle: number;
  componentMarginTop: number;
  componentMarginBottom: number;
}

interface PcSearchModule {
  type?: string;
  url?: string;
  module?: Partial<PcSearchConfig> | null;
}

interface PcSearchEnvelope {
  moduleList?: PcSearchModule[];
  data?: { moduleList?: PcSearchModule[] };
}

const PC_SEARCH_DEFAULTS: PcSearchConfig = {
  backgroundColor: '#fff',
  themeColor: '#ff4d4f',
  filterStyle: 2,
  filterTemplate: 2,
  showFilterPanel: true,
  showPriceRange: true,
  showShopTag: true,
  showSales: true,
  showCartButton: true,
  goodsStyle: 1,
  goodsRadiusStyle: 1,
  buyStyle: 1,
  componentMarginTop: 8,
  componentMarginBottom: 8,
};

function normalizeBoolLike(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (value === false || value === 0 || value === '0' || value === 'false') return false;
  if (value === true || value === 1 || value === '1' || value === 'true') return true;
  return Boolean(value);
}

function normalizeNumberLike(value: unknown, fallback: number): number {
  if (value === undefined || value === null || value === '') return fallback;
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

/** 旧版 resolvePcSearchModuleData：只认 pcSearchResult/pc-search-result 且 url 为空或 pcSearch。 */
function resolvePcSearchModule(result: PcSearchEnvelope | null): Partial<PcSearchConfig> | null {
  const list = Array.isArray(result?.moduleList)
    ? result?.moduleList
    : Array.isArray(result?.data?.moduleList)
      ? result?.data?.moduleList
      : [];
  const matched = (list || []).find(
    (item) =>
      (item?.type === 'pcSearchResult' || item?.type === 'pc-search-result') &&
      (!item?.url || item.url === 'pcSearch') &&
      item?.module,
  );
  return matched?.module || null;
}

function normalizePcSearchConfig(raw: Partial<PcSearchConfig> | null): PcSearchConfig {
  const config = raw ? { ...PC_SEARCH_DEFAULTS, ...raw } : { ...PC_SEARCH_DEFAULTS };
  return {
    ...config,
    backgroundColor: String(config.backgroundColor || PC_SEARCH_DEFAULTS.backgroundColor),
    themeColor: String(config.themeColor || PC_SEARCH_DEFAULTS.themeColor),
    filterStyle: Number(normalizeNumberLike(config.filterStyle, 2)) === 1 ? 1 : 2,
    filterTemplate: normalizeNumberLike(config.filterTemplate, 2),
    goodsStyle: normalizeNumberLike(config.goodsStyle, 1),
    goodsRadiusStyle: normalizeNumberLike(config.goodsRadiusStyle, 1),
    buyStyle: normalizeNumberLike(config.buyStyle, 1),
    componentMarginTop: normalizeNumberLike(config.componentMarginTop, 8),
    componentMarginBottom: normalizeNumberLike(config.componentMarginBottom, 8),
    showFilterPanel: normalizeBoolLike(config.showFilterPanel, true),
    showPriceRange: normalizeBoolLike(config.showPriceRange, true),
    showShopTag: normalizeBoolLike(config.showShopTag, true),
    showSales: normalizeBoolLike(config.showSales, true),
    showCartButton: normalizeBoolLike(config.showCartButton, true),
  };
}

function pcSearchClassNames(config: PcSearchConfig): string {
  const classes = ['search-page'];
  classes.push(config.filterStyle === 1 ? 'search-page--filter-side' : 'search-page--filter-top');
  classes.push(
    config.goodsStyle === 2 ? 'search-page--goods-card' : config.goodsStyle === 3 ? 'search-page--goods-outline' : 'search-page--goods-flat',
  );
  classes.push(
    config.goodsRadiusStyle === 2 ? 'search-page--radius-8' : config.goodsRadiusStyle === 3 ? 'search-page--radius-16' : 'search-page--radius-0',
  );
  return classes.join(' ');
}

function pcSearchStyleVars(config: PcSearchConfig): Record<string, string> {
  const radiusMap: Record<number, string> = { 1: '0px', 2: '8px', 3: '16px' };
  return {
    '--search-bg-color': config.backgroundColor,
    '--search-margin-top': `${config.componentMarginTop}px`,
    '--search-margin-bottom': `${config.componentMarginBottom}px`,
    '--search-item-radius': radiusMap[config.goodsRadiusStyle] || '0px',
    '--search-grid-columns': config.filterTemplate === 2 ? '6' : '5',
    '--search-theme-color': config.themeColor,
  };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

function readParams(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) return value;
  return value ? [value] : [];
}

async function postApi<T>(path: string, body: Record<string, unknown>): Promise<T | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE}/api/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok || (json.code !== undefined && json.code !== 0)) return null;
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

async function getApi<T>(path: string, params: Record<string, string | number | undefined>): Promise<T | null> {
  try {
    const search = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === '') return;
      search.set(key, String(value));
    });
    const response = await fetch(`${SERVER_API_BASE}/api/${path}?${search.toString()}`, {
      headers: { 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    const text = await response.text();
    const json = text ? JSON.parse(text) : {};
    if (!response.ok || (json.code !== undefined && json.code !== 0)) return null;
    return (json.data ?? json) as T;
  } catch {
    return null;
  }
}

function brandInitial(name: string): string {
  const first = (name || '').trim().charAt(0).toUpperCase();
  return /^[A-Z]$/.test(first) ? first : '';
}

function normalizeBrands(filter?: SearchFilterEnvelope['filter']): Array<{ id: string; name: string; firstWord: string }> {
  const list = (Array.isArray(filter?.brand) && filter?.brand) || (Array.isArray(filter?.brands) && filter?.brands) || [];
  return list
    .map((item) => {
      const name = String(item?.brandName ?? item?.name ?? '');
      const firstWordRaw = String(item?.firstWord ?? item?.first_word ?? '').trim().toUpperCase();
      const firstWord = /^[A-Z]$/.test(firstWordRaw) ? firstWordRaw : brandInitial(name);
      return { id: String(item?.id ?? item?.brandId ?? ''), name, firstWord };
    })
    .filter((item) => item.id && item.name);
}

function normalizeCategories(filter?: SearchFilterEnvelope['filter']): Array<{ id: string; name: string }> {
  const list = (Array.isArray(filter?.category) && filter?.category) || (Array.isArray(filter?.categories) && filter?.categories) || [];
  return list
    .map((item) => ({
      id: String(item?.id ?? item?.categoryId ?? ''),
      name: String(item?.categoryName ?? item?.name ?? ''),
    }))
    .filter((item) => item.id && item.name);
}

/** ES attributes → 归一化（name/values），与旧版 searchFilterUtils 对齐。 */
function normalizeEsAttrs(envelope: EsAttrEnvelope | null | undefined, fallback?: EsAttrItem[]): EsAttrItem[] {
  const raw = Array.isArray(envelope?.attributes) ? envelope?.attributes : fallback || [];
  return (raw || [])
    .map((item) => ({
      name: String(item?.name ?? item?.attrName ?? ''),
      values: (item?.values || [])
        .map((value) => ({ value: String(value?.value ?? '') }))
        .filter((value) => value.value),
    }))
    .filter((item) => item.name && (item.values || []).length > 0);
}

/** `attr=名称::值` → 已选属性（同一 attrName 可多值，与旧版 SelectedAttr 结构一致）。 */
function parseSelectedAttrs(values: string[]): SelectedAttr[] {
  const map = new Map<string, string[]>();
  for (const raw of values) {
    const text = String(raw || '');
    const index = text.indexOf('::');
    if (index <= 0) continue;
    const name = text.slice(0, index).trim();
    const value = text.slice(index + 2).trim();
    if (!name || !value) continue;
    const current = map.get(name) || [];
    if (!current.includes(value)) current.push(value);
    map.set(name, current);
  }
  return Array.from(map.entries())
    .map(([attrName, attrValue]) => ({ attrName, attrValue }))
    .filter((item) => item.attrValue.length > 0);
}

function serializeSelectedAttrs(attrs: SelectedAttr[]): string[] {
  return attrs.flatMap((attr) => attr.attrValue.map((value) => `${attr.attrName}::${value}`));
}

export async function generateMetadata({ searchParams }: PageProps): Promise<Metadata> {
  const t = getServerT();
  const keyword = readParam(searchParams?.keyword);
  const title = keyword ? t('{kw} · 搜索 · 万物新生', { kw: keyword }) : t('搜索商品 · 万物新生');
  const description = keyword ? t('搜索“{kw}”相关的动力电池回收设备与商品。', { kw: keyword }) : t('搜索商品、分类、品牌与回收设备。');
  return {
    title,
    description,
    alternates: { canonical: keyword ? `/search?keyword=${encodeURIComponent(keyword)}` : '/search' },
    robots: keyword ? { index: false, follow: true } : { index: true, follow: true },
    openGraph: { title, description, url: keyword ? `/search?keyword=${encodeURIComponent(keyword)}` : '/search' },
  };
}

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

const SHOP_PAGE_SIZE = 10;
const SHOP_SORTS = [
  { key: 'comprehensive', label: '综合', sortField: '' },
  { key: 'shopStar', label: '评分', sortField: 'shopStar' },
];

/**
 * /search 页面入口。Next 校验页面默认导出的 props 只能是标准 PageProps，
 * 复用路由（/list、/search.v1）的 pageType / variant 通过内部断言读取。
 */
export default async function SearchPage(props: PageProps) {
  const { searchParams, pageType, variant } = props as SearchPageProps;
    const t = getServerT();
  /** 所有筛选/排序/分页链接都写回当前路由，避免 /list、/search.v1 跳回 /search。 */
  const listPath = pageType || '/search';
  const keyword = readParam(searchParams?.keyword);
  const cat = readParam(searchParams?.cat) || readParam(searchParams?.categoryId);
  const brand = readParam(searchParams?.brand);
  const sort = readParam(searchParams?.sort);
  const order = readParam(searchParams?.order);
  const min = readParam(searchParams?.min) || readParam(searchParams?.priceMin);
  const max = readParam(searchParams?.max) || readParam(searchParams?.priceMax);
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const size = 30;
  const tab = readParam(searchParams?.tab) === 'shop' ? 'shop' : 'goods';
  const shopSortParam = readParam(searchParams?.shopSort) || readParam(searchParams?.sortField);
  const shopSortKey = shopSortParam === 'shopStar' || shopSortParam === 'star' ? 'shopStar' : 'comprehensive';
  const selectedAttrs = parseSelectedAttrs(readParams(searchParams?.attr));
  // 旧版 /shop/search/{id} 店内搜索（ShopSearch.vue filter.shopId 透传）：getFilter/getProduct 均带 shopId
  const shopIdParam = Number(readParam(searchParams?.shopId)) || 0;
  // 原版 search.vue 透传：优惠券/活动/图搜 token/装修预览
  const couponId = readParam(searchParams?.couponId);
  const pId = readParam(searchParams?.pId);
  const searchToken = readParam(searchParams?.searchToken);
  const previewId = readParam(searchParams?.previewId);

  const sortKey = sort === 'price' ? (order === 'asc' ? 'price-asc' : 'price-desc') : sort === 'sale' || sort === 'time' ? sort : 'default';
  const priceRange = PRICE_RANGES.find((item) => item.min === min && item.max === max)?.key || 'all';

  const basePayload: Record<string, unknown> = {
    keyword: keyword || undefined,
    cat: cat || undefined,
    brand: brand || undefined,
    min: min || undefined,
    max: max || undefined,
    shopId: shopIdParam > 0 ? shopIdParam : undefined,
    couponId: couponId || undefined,
    pId: pId || undefined,
    searchToken: searchToken || undefined,
  };

  const [header, searchDecorate, filterResult, shopResult] = await Promise.all([
    getPcHeader().catch(() => null),
    getApi<PcSearchEnvelope>('home/home/pcSearch', { previewId: previewId || undefined }).catch(() => null),
    postApi<SearchFilterEnvelope>('search/search/getFilter', basePayload),
    tab === 'shop'
      ? getApi<ShopListEnvelope>('shop/shop/list', {
          keyword: keyword || undefined,
          page,
          size: SHOP_PAGE_SIZE,
          sortField: SHOP_SORTS.find((item) => item.key === shopSortKey)?.sortField || undefined,
        })
      : Promise.resolve(null),
  ]);
  const searchConfig = normalizePcSearchConfig(resolvePcSearchModule(searchDecorate));
  /** 装修预览：与详情页 ?uiStyle= 同性质，?filterStyle=1|2 可本地强制切换侧栏版/顶部筛选版。 */
  const filterStylePreview = Number(readParam(searchParams?.filterStyle));
  if (filterStylePreview === 1 || filterStylePreview === 2) searchConfig.filterStyle = filterStylePreview;

  const [esAttrResult, productResult] = await Promise.all([
    postApi<EsAttrEnvelope>('search/search/getEsFilter', {
      ...basePayload,
      attrs: selectedAttrs,
    }),
    tab === 'goods'
      ? postApi<SearchProductEnvelope>('search/search/getProduct', {
          ...basePayload,
          page,
          size,
          sort: sort === 'sale' || sort === 'price' || sort === 'time' ? sort : undefined,
          order: order === 'asc' || order === 'desc' ? order : undefined,
          attrs: selectedAttrs,
        })
      : Promise.resolve(null),
  ]);

  const brands = normalizeBrands(filterResult?.filter);
  const categories = normalizeCategories(filterResult?.filter);
  const esAttrs = normalizeEsAttrs(esAttrResult, filterResult?.filter?.attrs);
  const records = (productResult?.records || []) as unknown as ProductListItem[];
  const total = Number(productResult?.total || 0);
  const pages = Math.max(1, Math.ceil(total / size));
  const shops = (shopResult?.records || []) as ShopItem[];
  const shopTotal = Number(shopResult?.total || 0);
  const shopPages = Math.max(1, Math.ceil(shopTotal / SHOP_PAGE_SIZE));

  const buildQuery = (overrides: Record<string, string | string[] | undefined>, basePage = page) => {
    const params = new URLSearchParams();
    if (keyword) params.set('keyword', keyword);
    if (cat) params.set('cat', cat);
    if (brand) params.set('brand', brand);
    if (sort) params.set('sort', sort);
    if (order) params.set('order', order);
    if (min) params.set('min', min);
    if (max) params.set('max', max);
    // 旧版 /shop/search/{id} 店内搜索：筛选/排序/分页之间保留 shopId 范围
    if (shopIdParam > 0) params.set('shopId', String(shopIdParam));
    if (couponId) params.set('couponId', couponId);
    if (pId) params.set('pId', pId);
    if (searchToken) params.set('searchToken', searchToken);
    if (previewId) params.set('previewId', previewId);
    // 预览态在筛选/排序/分页之间保持，避免点一次筛选就退回后台默认版式
    if (filterStylePreview === 1 || filterStylePreview === 2) params.set('filterStyle', String(filterStylePreview));
    if (tab === 'shop') params.set('tab', 'shop');
    if (shopSortKey === 'shopStar') params.set('shopSort', 'shopStar');
    // 已选属性（名称::值）在筛选/排序/分页之间保留
    const keptAttrs = overrides.attr !== undefined ? (overrides.attr as string[]) : serializeSelectedAttrs(selectedAttrs);
    keptAttrs.forEach((item) => params.append('attr', item));
    if (basePage > 1) params.set('page', String(basePage));
    Object.entries(overrides).forEach(([key, value]) => {
      if (key === 'attr') return;
      params.delete(key);
      if (value === undefined) return;
      if (Array.isArray(value)) value.forEach((entry) => params.append(key, entry));
      else params.set(key, value);
    });
    const query = params.toString();
    return query ? `?${query}` : '';
  };

  /** 品牌首字母组件的基准查询串：保留筛选条件，剔除 brand/page，由组件自行拼接品牌。 */
  const brandBaseQuery = buildQuery({ brand: undefined, shopSort: undefined }, 1).replace(/^\?/, '');

  /** 点击属性值：同 attrName 多选切换（旧版 FilterSide 复选语义）。 */
  const toggleAttr = (name: string, value: string) => {
    const next = selectedAttrs
      .map((attr) =>
        attr.attrName === name
          ? {
              ...attr,
              attrValue: attr.attrValue.includes(value)
                ? attr.attrValue.filter((item) => item !== value)
                : [...attr.attrValue, value],
            }
          : attr,
      )
      .filter((attr) => attr.attrValue.length > 0);
    const exists = selectedAttrs.some((attr) => attr.attrName === name);
    if (!exists && value) next.push({ attrName: name, attrValue: [value] });
    return `${listPath}${buildQuery({ attr: serializeSelectedAttrs(next) }, 1)}`;
  };

  const attrSelected = (name: string, value: string) =>
    selectedAttrs.some((attr) => attr.attrName === name && attr.attrValue.includes(value));

  const tabHref = (next: 'goods' | 'shop') => `${listPath}${buildQuery({ tab: next === 'shop' ? 'shop' : undefined }, 1)}`;

  const layoutCtx: SearchLayoutContext = {
    listPath, keyword, cat, brand, min, max, page, total, pages, sortKey, priceRange,
    categories, brands, esAttrs, selectedAttrs, records,
    showSales: searchConfig.showSales,
    showShopTag: searchConfig.showShopTag,
    showPriceRange: searchConfig.showPriceRange,
    filterTemplate: searchConfig.filterTemplate,
    buildQuery, toggleAttr, attrSelected, serializeSelectedAttrs,
  };

  return (
    <>
      <PcHeader config={header as any} />
      <main className={`pc-list-page ${pcSearchClassNames(searchConfig)}`} style={pcSearchStyleVars(searchConfig) as any}>
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">{t('首页')}</Link>
            <span>/</span>
            <span>{keyword ? t('搜索：{kw}', { kw: keyword }) : cat ? t('分类商品') : t('全部商品')}</span>
          </nav>
          <div className="pc-list-head">
            <h1>
              {keyword ? t('“{kw}”的搜索结果', { kw: keyword }) : t('全部商品')}
              {shopIdParam > 0 ? <span className="pc-search-shop-scope">（限店铺 #{shopIdParam}）</span> : null}
            </h1>
            <span>{tab === 'shop' ? t('共 {n} 家店铺', { n: shopTotal }) : t('共 {n} 件商品', { n: total })}</span>
          </div>

          {/* 旧版 search-tabs：全部商品 / 店铺 */}
          <div className="pc-search-tabs" style={{ display: 'flex', gap: 24, margin: '8px 0 16px', borderBottom: '1px solid #eee' }}>
            <Link
              href={tabHref('goods')}
              style={{
                padding: '10px 2px',
                color: tab === 'goods' ? '#1a1a1a' : '#666',
                fontWeight: tab === 'goods' ? 600 : 400,
                borderBottom: tab === 'goods' ? '2px solid #1a1a1a' : '2px solid transparent',
              }}
            >{t('全部商品')}</Link>
            <Link
              href={tabHref('shop')}
              style={{
                padding: '10px 2px',
                color: tab === 'shop' ? '#1a1a1a' : '#666',
                fontWeight: tab === 'shop' ? 600 : 400,
                borderBottom: tab === 'shop' ? '2px solid #1a1a1a' : '2px solid transparent',
              }}
            >{t('店铺')}</Link>
          </div>

          {variant ? (
            variant === 'modern' ? <SearchModernLayout ctx={layoutCtx} /> : <SearchClassicLayout ctx={layoutCtx} />
          ) : tab === 'goods' && searchConfig.filterStyle === 1 ? (
            <SearchSideLayout ctx={layoutCtx} />
          ) : tab === 'goods' ? (
            <>
              {/* 分类筛选（旧版 Filter 顶部类目条） */}
              {categories.length ? (
                <div className="pc-search-filter-row">
                  <span className="pc-search-filter-row__label">{t('分类：')}</span>
                  <div className="pc-search-filter-row__values">
                    <Link href={`${listPath}${buildQuery({ cat: undefined }, 1)}`} className={!cat ? 'is-active' : ''}>{t('全部')}</Link>
                    {categories.map((item) => (
                      <Link key={item.id} href={`${listPath}${buildQuery({ cat: item.id }, 1)}`} className={cat === item.id ? 'is-active' : ''}>
                        {item.name}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* 品牌筛选（旧版 Filter：firstWord 首字母分组 + 更多/收起） */}
              {brands.length ? (
                <SearchBrandFilter
                  brands={brands}
                  selected={brand ? brand.split(',').filter(Boolean) : []}
                  baseQuery={brandBaseQuery}
                  maxVisible={8}
                />
              ) : null}

              {/* ES 属性筛选（旧版 FilterSide：属性复选，提交 attrs: [{ attrName, attrValue }]） */}
              {esAttrs.length ? (
                <div className="pc-search-attrs">
                  {esAttrs.map((attr) => (
                    <div key={attr.name} className="pc-search-filter-row">
                      <span className="pc-search-filter-row__label">{attr.name}：</span>
                      <div className="pc-search-filter-row__values">
                        {(attr.values || []).map((option) => (
                          <Link
                            key={`${attr.name}-${option.value}`}
                            href={toggleAttr(String(attr.name), String(option.value))}
                            className={attrSelected(String(attr.name), String(option.value)) ? 'is-active' : ''}
                          >
                            {option.value}
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                  {selectedAttrs.length ? (
                    <div className="pc-search-filter-row">
                      <span className="pc-search-filter-row__label">{t('已选：')}</span>
                      <div className="pc-search-filter-row__values">
                        <Link href={`${listPath}${buildQuery({ attr: [] }, 1)}`}>{t('清除全部属性')}</Link>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* 排序（旧版 SortFilter：默认/销量/价格↑↓/最新） */}
              <div className="pc-list-toolbar">
                <div className="pc-list-sorts">
                  {SORTS.map((item) => {
                    const nextQuery =
                      item.key === 'default'
                        ? buildQuery({ sort: undefined, order: undefined }, 1)
                        : item.key === 'sale'
                          ? buildQuery({ sort: 'sale', order: 'desc' }, 1)
                          : item.key === 'time'
                            ? buildQuery({ sort: 'time', order: 'desc' }, 1)
                            : buildQuery({ sort: 'price', order: item.key === 'price-asc' ? 'asc' : 'desc' }, 1);
                    return (
                      <Link key={item.key} href={`/search${nextQuery}`} className={sortKey === item.key ? 'is-active' : ''}>
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
                {/* 「全部筛选」浮层面板（旧版 SortFilter.vue filterPanel 区块）：
                    顶部筛选版右侧触发器 + 浮层（品牌 / ES 属性分区 tab、可展开收起、重置）。 */}
                <SearchAllFilterPanel
                  brands={brands}
                  attrs={esAttrs}
                  selectedBrands={brand ? brand.split(',').filter(Boolean) : []}
                  selectedAttrs={Object.fromEntries(selectedAttrs.map((item) => [item.attrName, item.attrValue]))}
                  baseQuery={brandBaseQuery}
                  basePath={listPath}
                />
                <Link href="/search/image" className="pc-image-search-entry">{t('以图搜图')}</Link>
              </div>

              {/* 价格区间（旧版 SortFilter 区间：预设 + 自定义；装修 showPriceRange 可关闭） */}
              {searchConfig.showPriceRange ? (
              <div className="pc-list-toolbar">
                <div className="pc-list-sorts">
                  {PRICE_RANGES.map((item) => (
                    <Link
                      key={item.key}
                      href={`${listPath}${buildQuery({ min: item.min || undefined, max: item.max || undefined }, 1)}`}
                      className={priceRange === item.key ? 'is-active' : ''}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
                <form action={listPath} method="get" className="pc-search-price-form">
                  {keyword ? <input type="hidden" name="keyword" value={keyword} /> : null}
                  {cat ? <input type="hidden" name="cat" value={cat} /> : null}
                  {brand ? <input type="hidden" name="brand" value={brand} /> : null}
                  {sort ? <input type="hidden" name="sort" value={sort} /> : null}
                  {order ? <input type="hidden" name="order" value={order} /> : null}
                  {shopIdParam > 0 ? <input type="hidden" name="shopId" value={String(shopIdParam)} /> : null}
                  {serializeSelectedAttrs(selectedAttrs).map((item) => (
                    <input key={item} type="hidden" name="attr" value={item} />
                  ))}
                  <input type="text" name="min" placeholder={t('最低价')} defaultValue={min} className="pc-search-price-input" />
                  <span>-</span>
                  <input type="text" name="max" placeholder={t('最高价')} defaultValue={max} className="pc-search-price-input" />
                  <button type="submit">{t('确定')}</button>
                </form>
              </div>
              ) : null}

              <ProductGrid
                products={records}
                showSales={searchConfig.showSales}
                showShopTag={searchConfig.showShopTag}
              />

              {pages > 1 ? (
                <nav className="pc-pagination">
                  {page > 1 ? <Link href={`${listPath}${buildQuery({}, page - 1)}`}>{t('上一页')}</Link> : <span className="is-disabled">{t('上一页')}</span>}
                  {Array.from({ length: Math.min(pages, 8) }).map((_, index) => {
                    const next = index + 1;
                    return (
                      <Link key={next} href={`${listPath}${buildQuery({}, next)}`} className={next === page ? 'is-active' : ''}>
                        {next}
                      </Link>
                    );
                  })}
                  {page < pages ? <Link href={`${listPath}${buildQuery({}, page + 1)}`}>{t('下一页')}</Link> : <span className="is-disabled">{t('下一页')}</span>}
                </nav>
              ) : null}
            </>
          ) : (
            <>
              {/* 旧版 SearchShopList：sortField=shopStar（综合/评分） */}
              <div className="pc-search-shop-sorts" style={{ display: 'flex', gap: 24, margin: '4px 0 16px' }}>
                {SHOP_SORTS.map((item) => (
                  <Link
                    key={item.key}
                    href={`${listPath}${buildQuery({ shopSort: item.key === 'shopStar' ? 'shopStar' : undefined }, 1)}`}
                    style={{
                      color: shopSortKey === item.key ? '#1a1a1a' : '#666',
                      fontWeight: shopSortKey === item.key ? 600 : 400,
                      borderBottom: shopSortKey === item.key ? '2px solid #1a1a1a' : '2px solid transparent',
                      paddingBottom: 4,
                    }}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>

              {/* 旧版 SearchShopList：GET shop/shop/list（keyword/page/size/sortField） */}
              {shops.length ? (
                <div className="pc-search-shops" style={{ display: 'grid', gap: 12 }}>
                  {shops.map((shop, index) => (
                    <div
                      key={String(shop.shopId ?? index)}
                      className="pc-search-shop"
                      style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', border: '1px solid #eee', borderRadius: 8 }}
                    >
                      <Link href={`/shop/${shop.shopId}`} className="pc-search-shop__logo" style={{ flex: '0 0 64px' }}>
                        <img
                          src={shop.shopLogo || ''}
                          alt={shop.shopTitle || t('店铺')}
                          style={{ width: 64, height: 64, objectFit: 'contain', border: '1px solid #f0f0f0', borderRadius: 6 }}
                        />
                      </Link>
                      <div className="pc-search-shop__info" style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1 }}>
                        <Link href={`/shop/${shop.shopId}`} style={{ fontWeight: 600 }}>
                          {shop.shopTitle || t('店铺')}
                        </Link>
                        <span style={{ color: '#888', fontSize: 12 }}>
                          商品 {Number(shop.productCount || 0)}
                          {Number(shop.shopStar || 0) > 0 ? t('· 评分 {v} 星', { v: Number(shop.shopStar || 0) }) : ''}
                        </span>
                      </div>
                      <Link href={`/shop/${shop.shopId}`} className="pc-search-shop__enter" style={{ color: '#1a1a1a' }}>{t('进入店铺')}</Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="pc-search-empty">{t('没有找到相关店铺')}</p>
              )}

              {shopPages > 1 ? (
                <nav className="pc-pagination">
                  {page > 1 ? (
                    <Link href={`${listPath}${buildQuery({}, page - 1)}`}>{t('上一页')}</Link>
                  ) : (
                    <span className="is-disabled">{t('上一页')}</span>
                  )}
                  {Array.from({ length: Math.min(shopPages, 8) }).map((_, index) => {
                    const next = index + 1;
                    return (
                      <Link key={next} href={`${listPath}${buildQuery({}, next)}`} className={next === page ? 'is-active' : ''}>
                        {next}
                      </Link>
                    );
                  })}
                  {page < shopPages ? (
                    <Link href={`${listPath}${buildQuery({}, page + 1)}`}>{t('下一页')}</Link>
                  ) : (
                    <span className="is-disabled">{t('下一页')}</span>
                  )}
                </nav>
              ) : null}
            </>
          )}
        </div>
      </main>
      <PcFooter />
    </>
  );
}

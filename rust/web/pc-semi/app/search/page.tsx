import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import ProductGrid from '@/components/ProductGrid';
import SearchAllFilterPanel from '@/components/SearchAllFilterPanel';
import SearchSortBar from '@/components/SearchSortBar';
import SearchCategoryStrip from '@/components/SearchCategoryStrip';
import { getPcHeader, getSearchStyle } from '@/lib/api';
import type { ProductListItem } from '@/lib/api';
import { SearchClassicLayout, type SearchLayoutContext } from '@/components/SearchLayoutVariants';
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
  brandLogo?: string;
  logo?: string;
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

function normalizeBrands(filter?: SearchFilterEnvelope['filter']): Array<{ id: string; name: string; firstWord: string; logo: string }> {
  const list = (Array.isArray(filter?.brand) && filter?.brand) || (Array.isArray(filter?.brands) && filter?.brands) || [];
  return list
    .map((item) => {
      const name = String(item?.brandName ?? item?.name ?? '');
      const firstWordRaw = String(item?.firstWord ?? item?.first_word ?? '').trim().toUpperCase();
      const firstWord = /^[A-Z]$/.test(firstWordRaw) ? firstWordRaw : brandInitial(name);
      const logo = String(item?.brandLogo ?? item?.logo ?? '');
      return { id: String(item?.id ?? item?.brandId ?? ''), name, firstWord, logo };
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

  const [header, searchDecorate, filterResult, shopResult, searchStyle] = await Promise.all([
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
    getSearchStyle(),
  ]);
  const searchConfig = normalizePcSearchConfig(resolvePcSearchModule(searchDecorate));
  /** 装修预览：与详情页 ?uiStyle= 同性质，?filterStyle=1|2 可本地强制切换侧栏版/顶部筛选版。 */
  const filterStylePreview = Number(readParam(searchParams?.filterStyle));
  /** ?ui=new|old 版式预览（buildQuery 也要保留它，故先于 buildQuery 定义） */
  const uiParam = readParam(searchParams?.ui);
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
    // ?ui=new|old 版式预览参数同样全程保持
    if (uiParam) params.set('ui', uiParam);
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


  /* 旧版 SortFilter.vue 面板按「名称 → 值数组」取已选属性 */
  const selectedAttrsMap: Record<string, string[]> = {};
  for (const attr of selectedAttrs) selectedAttrsMap[attr.attrName] = attr.attrValue;

  /* ---------- 旧版 SortFilter.vue / Filter.vue 需要的链接（服务端先算好） ---------- */
  const sortDefaultHref = `${listPath}${buildQuery({ sort: undefined, order: undefined }, 1)}`;
  const sortSaleHref = `${listPath}${buildQuery({ sort: 'sale', order: undefined }, 1)}`;
  const sortTimeHref = `${listPath}${buildQuery({ sort: 'time', order: undefined }, 1)}`;
  const sortPriceOptions = [
    {
      key: 'asc',
      label: t('价格从低到高'),
      href: `${listPath}${buildQuery({ sort: 'price', order: 'asc' }, 1)}`,
      active: sortKey === 'price-asc',
    },
    {
      key: 'desc',
      label: t('价格从高到低'),
      href: `${listPath}${buildQuery({ sort: 'price', order: 'desc' }, 1)}`,
      active: sortKey === 'price-desc',
    },
  ];
  /* 旧版「区间」下拉的预设：沿用页面既有的价格区间，每项各自带 min/max */
  const intervalPresets = PRICE_RANGES.filter((item) => item.key !== 'all').map((item) => ({
    key: item.label,
    label: item.label,
    href: `${listPath}${buildQuery({ min: item.min || undefined, max: item.max || undefined }, 1)}`,
    active: priceRange === item.key,
  }));
  /* 区间表单要带上的其它条件（旧版是 submit 时在 JS 里拼查询串，这里用 GET 隐藏域） */
  const intervalHidden = Array.from(
    new URLSearchParams(
      buildQuery({ min: undefined, max: undefined, page: undefined }, 1).replace(/^\?/, '')
    ).entries()
  ).map(([name, value]) => ({ name, value }));
  const intervalResetHref = `${listPath}${buildQuery({ min: undefined, max: undefined }, 1)}`;
  /* 旧版 Filter.vue 一级分类：第一项固定是「全部」 */
  const categoryStripItems = [
    { key: 'all', label: t('全部'), href: tabHref('goods'), active: !cat },
    ...categories.map((item) => {
      const id = String(item.id ?? '');
      return {
        key: id || String(item.name ?? ''),
        label: String(item.name ?? ''),
        href: `${listPath}${buildQuery({ cat: id }, 1)}`,
        active: cat === id,
      };
    }),
  ];

  /* 旧版品牌下拉：点一项就切到该品牌，再点一次取消 */
  const sortBrandOptions = brands.map((item) => {
    const id = String(item.id ?? '');
    return {
      key: id,
      label: String(item.name ?? ''),
      href: `${listPath}${buildQuery({ brand: id === brand ? undefined : id }, 1)}`,
      active: id === brand,
    };
  });
  /* 旧版 CatGoodsList.vue：商品在加载中时给 .goods-list__box 加 --loading */
  const goodsLoading = false;

  /**
   * 搜索页风格（旧版 pages/search.v1/src/search.vue：uiVersion 在新旧两套布局间切换）：
   * - admin「搜索页风格」装修写入系统配置 searchStyleType（1=经典版 classic，2=新版 modern），
   *   经 GET /common/config/searchStyle 读取，决定 /search 的默认版式；
   * - /search.v1 路由固定经典版（旧版入口硬编码 ui-version="old"）；
   * - ?ui=new|old 仅作本地预览强制，与详情页 ?uiStyle= 同性质。
   */
  const effectiveVariant: 'classic' | 'modern' =
    uiParam === 'new'
      ? 'modern'
      : uiParam === 'old' || uiParam === 'classic'
        ? 'classic'
        : pageType === '/search.v1'
          ? 'classic'
          : searchStyle.searchStyleType === 2
            ? 'modern'
            : 'classic';

  /** 经典版布局上下文（三套布局共用同一份取数结果，见 SearchLayoutVariants.tsx）。 */
  const searchLayoutCtx: SearchLayoutContext = {
    listPath,
    keyword,
    cat,
    brand,
    min,
    max,
    page,
    total,
    pages,
    sortKey,
    priceRange,
    categories,
    brands,
    esAttrs,
    selectedAttrs,
    records,
    showSales: searchConfig.showSales,
    showShopTag: searchConfig.showShopTag,
    showPriceRange: searchConfig.showPriceRange,
    filterTemplate: searchConfig.filterTemplate,
    buildQuery,
    toggleAttr,
    attrSelected,
    serializeSelectedAttrs,
  };

  /** 旧版 CatGoodsList.vue：.goods-list__box > .goods-list-c > .wrap + Element Plus 分页。
      顶部版与侧栏版共用同一份商品列表（原版两者都渲染 CatGoodsList）。
      生成样式 .mp-search-goods 是外层包裹（后代选择器），这里补齐包裹结构。 */
  const goodsListNode = (
    <div className="mp-search-goods">
      <div className="goods-list-wrap">
        <div
          className={`goods-list__box${goodsLoading ? ' goods-list__box--loading' : ''}${records.length ? '' : ' goods-list__box--empty'}`}
        >
          <div className="goods-list-c">
            <ProductGrid
              products={records}
              showSales={Boolean(searchConfig?.showSales)}
              showShopTag={Boolean(searchConfig?.showShopTag)}
              gridClassName="wrap mp-search-card"
              fixedNameTwoLines
            />
          </div>
        </div>
        {/* 旧版 CatGoodsList.vue 底部：Element Plus 分页 */}
        {pages > 1 ? (
          <div className="pagination">
            <nav className="el-pagination">
              {page > 1 ? (
                <Link href={`${listPath}${buildQuery({}, page - 1)}`} className="btn-prev">
                  {t('上一页')}
                </Link>
              ) : (
                <span className="btn-prev disabled">{t('上一页')}</span>
              )}
              <ul className="el-pager">
                {Array.from({ length: Math.min(pages, 8) }).map((_, index) => {
                  const next = index + 1;
                  return (
                    <li key={next}>
                      <Link href={`${listPath}${buildQuery({}, next)}`} className={`number${next === page ? ' active' : ''}`}>
                        {next}
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {page < pages ? (
                <Link href={`${listPath}${buildQuery({}, page + 1)}`} className="btn-next">
                  {t('下一页')}
                </Link>
              ) : (
                <span className="btn-next disabled">{t('下一页')}</span>
              )}
            </nav>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <PcHeader config={header as any} />
      {/* 旧版 pages/search/index.vue：.search-page > CommonHeader / Search / CommonFooter */}
      <main
        className={`search-page mp-search ${pcSearchClassNames(searchConfig)}`}
        style={pcSearchStyleVars(searchConfig) as any}
      >
        {/* 旧版 search.v1/src/search.vue：uiVersion 在 SearchLayoutClassic / Modern（当前内联 DOM）间切换 */}
        {effectiveVariant === 'classic' ? (
          <div className="page-body">
            <div className="container">
              <SearchClassicLayout ctx={searchLayoutCtx} />
            </div>
          </div>
        ) : (
        <div className="page-body">
          <div className="container">
            <div className="top-filter-wrap">
              {/* 旧版 Filter.vue：一条分类横条 .filter-container--top。
                  生成样式 .mp-search-filter 是外层包裹（后代选择器），这里补齐包裹结构 */}
              <div className="mp-search-filter">
                <div className="filter-container filter-container--top">
                  <div className="filter-top">
                    <div className="filter-top-body">
                      <div className="list">
                        <div className="attr-box">
                          <SearchCategoryStrip items={categoryStripItems} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 旧版 search.vue：.search-tabs（商品/店铺切换 + 右侧翻页） */}
              <div className="search-tabs">
                <div className="search-tabs__left">
                  <div>
                    <Link
                      href={tabHref('goods')}
                      className={`search-tabs__item${tab === 'goods' ? ' active' : ''}`}
                    >
                      {t('全部商品')}
                    </Link>
                    <Link
                      href={tabHref('shop')}
                      className={`search-tabs__item${tab === 'shop' ? ' active' : ''}`}
                    >
                      {t('店铺')}
                    </Link>
                  </div>
                </div>
                {tab === 'goods' && total > 0 ? (
                  <div className="search-tabs__right">
                    <div className="pageInfo">
                      {page > 1 ? (
                        <Link href={`${listPath}${buildQuery({}, page - 1)}`} className="noPage">
                          <span className="page-arrow page-arrow--prev" />
                        </Link>
                      ) : (
                        <span className="noPage disabled">
                          <span className="page-arrow page-arrow--prev" />
                        </span>
                      )}
                      <span className="page_number">
                        <em className="page_current">{page}</em>
                        <span className="page_separator">/</span>
                        <span className="page_total">{pages}</span>
                      </span>
                      {page < pages ? (
                        <Link href={`${listPath}${buildQuery({}, page + 1)}`} className="noPage">
                          <span className="page-arrow" />
                        </Link>
                      ) : (
                        <span className="noPage disabled">
                          <span className="page-arrow" />
                        </span>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {/* 旧版 search.vue：.right-wrap 里放 SortFilter / CatGoodsList / SearchShopList */}
            <div className="right-wrap">
              {tab === 'goods' ? (
                <>
                  <SearchSortBar
                    defaultHref={sortDefaultHref}
                    defaultActive={sortKey === 'default'}
                    saleHref={sortSaleHref}
                    saleActive={sortKey === 'sale'}
                    priceOptions={sortPriceOptions}
                    priceActive={sortKey === 'price-asc' || sortKey === 'price-desc'}
                    timeHref={sortTimeHref}
                    timeActive={sortKey === 'time'}
                    intervalPresets={intervalPresets}
                    intervalActive={Boolean(min || max)}
                    intervalAction={listPath}
                    intervalHidden={intervalHidden}
                    minValue={min}
                    maxValue={max}
                    resetHref={intervalResetHref}
                    brandOptions={sortBrandOptions}
                    brandActive={Boolean(brand)}
                    filterPanel={
                      <SearchAllFilterPanel
                        brands={brands}
                        attrs={esAttrs}
                        selectedBrands={brand ? [brand] : []}
                        selectedAttrs={selectedAttrsMap}
                        baseQuery={brandBaseQuery}
                        basePath={listPath}
                        collapsedCount={8}
                      />
                    }
                  />

                  {goodsListNode}
                </>
              ) : (
                /* 旧版 SearchShopList.vue：.search-shop-panel > .shop-sort-tabs + .shop-list-container/.shop-row
                   （.pg-catalog-search-shop-list 是旧版该 .vue 的 <style> 作用域替身） */
                <div className="pg-catalog-search-shop-list">
                <div className="mp-search-shop">
                <div className="search-shop-panel">
                  <div className="shop-sort-tabs">
                    <Link
                      href={`${listPath}${buildQuery({ tab: 'shop', shopSort: undefined }, 1)}`}
                      className={`tab-item${shopSortKey === 'comprehensive' ? ' active' : ''}`}
                    >
                      {t('综合排序')}
                    </Link>
                    <Link
                      href={`${listPath}${buildQuery({ tab: 'shop', shopSort: 'shopStar' }, 1)}`}
                      className={`tab-item${shopSortKey === 'shopStar' ? ' active' : ''}`}
                    >
                      {t('店铺评分')}
                    </Link>
                  </div>

                  {shops.length ? (
                    <div className="shop-list-container">
                      {shops.map((shop, index) => (
                        <div className="shop-row" key={String(shop.shopId ?? index)}>
                          {/* 旧版 components/product/overseas/ShopInfo.vue。
                              生成样式 .mp-search-shopinfo 是外层包裹（后代选择器） */}
                          <div className="mp-search-shopinfo">
                          <div className="shop-info-wrap">
                            <div className="shop-logo">
                              <Link href={`/shop/${shop.shopId}`} className="shop-link">
                                <img
                                  className="img"
                                  src={shop.shopLogo || ''}
                                  alt={shop.shopTitle || t('店铺')}
                                />
                              </Link>
                            </div>
                            <div className="shop-detail">
                              <div className="name-warp">
                                <Link href={`/shop/${shop.shopId}`} className="name-link">
                                  <div className="name">{shop.shopTitle || t('店铺')}</div>
                                </Link>
                              </div>
                              <div className="button-wrap">
                                <Link
                                  href={`/shop/${shop.shopId}`}
                                  className="tig-button-no-ripple"
                                >
                                  <span className="button-content">{t('进入店铺')}</span>
                                </Link>
                              </div>
                            </div>
                          </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="search-empty">
                      <span className="search-empty__text">{t('没有找到相关店铺')}</span>
                    </div>
                  )}

                  {shopPages > 1 ? (
                    <div className="el-page">
                      <nav className="el-pagination">
                        {page > 1 ? (
                          <Link href={`${listPath}${buildQuery({}, page - 1)}`} className="btn-prev">
                            {t('上一页')}
                          </Link>
                        ) : (
                          <span className="btn-prev disabled">{t('上一页')}</span>
                        )}
                        <ul className="el-pager">
                          {Array.from({ length: Math.min(shopPages, 8) }).map((_, index) => {
                            const next = index + 1;
                            return (
                              <li key={next}>
                                <Link
                                  href={`${listPath}${buildQuery({}, next)}`}
                                  className={`number${next === page ? ' active' : ''}`}
                                >
                                  {next}
                                </Link>
                              </li>
                            );
                          })}
                        </ul>
                        {page < shopPages ? (
                          <Link href={`${listPath}${buildQuery({}, page + 1)}`} className="btn-next">
                            {t('下一页')}
                          </Link>
                        ) : (
                          <span className="btn-next disabled">{t('下一页')}</span>
                        )}
                      </nav>
                    </div>
                  ) : null}
                </div>
                </div>
                </div>
              )}
            </div>
          </div>
        </div>
        )}
        {/* 旧版 search.vue：底部占位 .search-footer-spacer */}
        <div className="search-footer-spacer" />
      </main>
      <PcFooter />
    </>
  );
}

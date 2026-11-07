import type { HomeDecorateResponse } from '@/decorate/types';
import type { HeaderBootstrapCurrency, HeaderBootstrapLocale, PcHeaderBootstrap } from '@/lib/header-bootstrap';
import i18n from '@/i18n';

const SERVER_API_BASE = (process.env.PC_API_BASE || 'https://battery.recy.cc').replace(/\/$/, '');

interface RequestOptions {
  previewId?: number;
  revalidate?: number;
}

async function readData<T>(response: Response): Promise<T> {
  const text = await response.text();
  let json: any;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(i18n.t('接口返回不是 JSON（HTTP {code}）', { code: response.status }) as string);
  }
  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || json.message || (i18n.t('请求失败（HTTP {code}）', { code: response.status }) as string));
  }
  return (json.data ?? json) as T;
}

/** PC 首页装修：服务端直连后端，客户端可经 Next rewrite 走 /api。 */
export async function getHomeDecorate(options: RequestOptions = {}): Promise<HomeDecorateResponse> {
  const params = new URLSearchParams();
  if (options.previewId) params.set('previewId', String(options.previewId));
  const query = params.toString() ? `?${params.toString()}` : '';
  const response = await fetch(`${SERVER_API_BASE}/api/home/home/pcIndex${query}`, {
    ...(options.previewId ? { cache: 'no-store' as const } : { next: { revalidate: options.revalidate ?? 60 } }),
  });
  return readData<HomeDecorateResponse>(response);
}

/**
 * 头部公共数据：服务端并发预取 base / locales / currencies，由 RootLayout 内联给客户端，
 * 保证 Logo、语言/货币与「我的」「购物车」在同一次渲染中出现，不再各自等 hydration 后的请求。
 * 单个接口失败不影响其它字段（客户端仍会按需回退请求）。
 */
export async function getHeaderBootstrap(): Promise<PcHeaderBootstrap> {
  const request = async <T,>(path: string): Promise<T | null> => {
    try {
      const response = await fetch(`${SERVER_API_BASE}/api/${path}`, {
        next: { revalidate: 300 },
        signal: AbortSignal.timeout(3000),
      });
      if (!response.ok) return null;
      const json: any = await response.json().catch(() => null);
      const data = json?.data ?? json ?? null;
      return (data ?? null) as T | null;
    } catch {
      return null;
    }
  };

  const [base, locales, currencies] = await Promise.all([
    request<Record<string, any>>('common/config/base'),
    request<HeaderBootstrapLocale[]>('common/i18n/getLocales'),
    request<HeaderBootstrapCurrency[]>('common/currency/getCurrency'),
  ]);

  return {
    base: base && typeof base === 'object' ? base : null,
    locales: Array.isArray(locales) ? locales : [],
    currencies: Array.isArray(currencies) ? currencies : [],
  };
}

/**
 * 后台「装修/设置 → 主题风格」配置。
 *
 * 返回 `{ themeStyle: "{\"--general\":\"#65c4aa\",...}" }`，`themeStyle` 是整串 CSS 变量
 * 的字符串化 JSON，与旧版 `view/pc/store/common.ts#loadThemeSettings` 消费同一份数据。
 * 这里不做解析，交由 `@/lib/theme-style` 统一处理（过滤 + 派生 `--general-rgb`）。
 *
 * 主题色属于低频变更的全站配置，用 300s ISR 缓存；接口不可用时返回 null，
 * 页面自动回落到 globals.scss 的 `--pc-primary` 兜底值。
 */
export async function getThemeSettings(): Promise<{ themeStyle?: string } | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE}/api/common/config/themeSettings`, {
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return null;
    const json: any = await response.json().catch(() => null);
    const data = json?.data ?? json ?? null;
    return data && typeof data === 'object' ? (data as { themeStyle?: string }) : null;
  } catch {
    return null;
  }
}

/** 站点积分名称（旧版 commonStore.integralName，后台可配置，缺省「积分」）。 */
export async function getIntegralName(fallback = '积分'): Promise<string> {
  try {
    const response = await fetch(`${SERVER_API_BASE}/api/common/config/base`, { next: { revalidate: 300 } });
    const config = await readData<{ integralName?: string }>(response);
    return (config?.integralName || '').trim() || fallback;
  } catch {
    return fallback;
  }
}

/** PC 公共头部：通常已经包含在 pageModule.pcHeader 中，此接口用于独立刷新。 */export async function getPcHeader(previewId?: number): Promise<Record<string, unknown> | null> {
  const query = previewId ? `?previewId=${previewId}` : '';
  const [headerResponse, configResponse] = await Promise.all([
    fetch(`${SERVER_API_BASE}/api/home/home/pcHeader${query}`, {
      ...(previewId ? { cache: 'no-store' as const } : { next: { revalidate: 60 } }),
    }),
    fetch(`${SERVER_API_BASE}/api/common/config/base`, {
      next: { revalidate: 300 },
    }).catch(() => null),
  ]);
  const data = await readData<{ pcHeader?: Record<string, unknown> | null }>(headerResponse);
  const header = data?.pcHeader ?? null;
  if (!header) return null;

  const logo = header.logoPic as { picUrl?: string; picThumb?: string } | undefined;
  if (!logo?.picUrl && !logo?.picThumb && configResponse) {
    try {
      const config = await readData<{ shopLogo?: string }>(configResponse);
      if (config?.shopLogo) header.logoPic = { picUrl: config.shopLogo };
    } catch {
      // 站点配置失败时保留原装修配置
    }
  }
  if (!header.logoWidth) header.logoWidth = 160;
  if (!header.logoHeight) header.logoHeight = 49;
  return header;
}

export interface ProductDetailResponse {
  item: Record<string, any>;
  skuList: Array<Record<string, any>>;
  picList: Array<Record<string, any>>;
  attrList?: {
    normal?: Array<Record<string, any>>;
    spe?: Array<Record<string, any>>;
    extra?: Array<Record<string, any>>;
  };
  descArr?: Array<{ type?: string; pic?: string; html?: string }>;
  serviceList?: Array<Record<string, any>>;
  deliveryModeText?: string;
  shopId?: number;
}

/** 商品详情：服务端 SSR 拉取，SEO 和首屏都走服务端。 */
/**
 * 商品详情（按商品编号 sn 取数）
 * 源码对照：pages/product/[...slug].vue + pages/item/src/Product.vue
 * —— 旧版前台 URL 使用商品 SN，后端 `product/product/detail` 支持 `sn` 参数。
 */
/**
 * 商品详情页风格（后台「装修 → PC端装修 → 商品页风格」productDetailStyleType）
 * 源码对照：api/common.getProductDetailStyle → GET /api/common/config/productDetailStyle
 * 1=经典版(old) / 2=国内标准版(new) / 3=跨境简约版(overseas)
 * 后台未配置时 Java / Rust 后端均回落 1，故这里异常兜底也统一为 old，避免端上风格与后台不一致。
 */
export type ProductUiStyle = 'old' | 'new' | 'overseas';

export async function getProductDetailStyle(): Promise<ProductUiStyle> {
  try {
    const response = await fetch(`${SERVER_API_BASE}/api/common/config/productDetailStyle`, { cache: 'no-store' });
    const json: any = await response.json().catch(() => null);
    const value = Number(json?.data ?? json);
    if (value === 2) return 'new';
    if (value === 3) return 'overseas';
    return 'old';
  } catch {
    return 'old';
  }
}

/** 源码：本地可通过 ?uiStyle=old|new|overseas 预览三种风格 */
export function resolveUiStyle(param: string | undefined | null, configured: ProductUiStyle): ProductUiStyle {
  const value = String(param || '').toLowerCase();
  if (value === 'old' || value === 'new' || value === 'overseas') return value;
  return configured;
}

export async function getProductDetailBySn(sn: string): Promise<ProductDetailResponse> {
  const response = await fetch(`${SERVER_API_BASE}/api/product/product/detail?sn=${encodeURIComponent(sn)}`, {
    cache: 'no-store',
  });
  return readData<ProductDetailResponse>(response);
}

/** 源码 utils/seo-url.ts extractProductSnFromSlug：取最后一段，若含 "." 则取点后部分 */
export function extractProductSnFromSlug(slug?: string | string[] | null): string {
  const segments = (Array.isArray(slug) ? slug : typeof slug === 'string' ? [slug] : [])
    .map((item) => String(item || '').trim())
    .filter(Boolean);
  const last = segments[segments.length - 1] || '';
  if (!last) return '';
  const dot = last.lastIndexOf('.');
  if (dot < 0 || dot === last.length - 1) return last;
  return last.slice(dot + 1);
}

/** 数字则按 id 取，否则按 sn 取；id 失败再回落 sn，sn 失败再回落 id */
export async function loadProductBySlug(sn: string): Promise<ProductDetailResponse | null> {
  if (!sn) return null;
  const numeric = Number(sn);
  if (Number.isFinite(numeric) && numeric > 0) {
    const byId = await getProductDetail(numeric).catch(() => null);
    if (byId?.item) return byId;
  }
  const bySn = await getProductDetailBySn(sn).catch(() => null);
  if (bySn?.item) return bySn;
  return null;
}

/**
 * PC 登录页装修配置
 * 源码对照：composables/usePcLoginDecorate.ts + api/decorate/pcHeader.getPcLogin
 * 接口 home/home/pcLogin → moduleList[].module（type=pcLogin）
 * - loginMode 1=经典(BaseLogin) / 2=现代(OverseasLogin)
 * - backgroundPic / backgroundColor / headerHeight / logoWidth / logoHeight / headerShadow / showWelcome
 */
export interface PcLoginDecorate {
  loginMode?: number | string;
  backgroundPic?: { picUrl?: string; picThumb?: string } | null;
  backgroundColor?: string;
  headerHeight?: number | string;
  logoWidth?: number | string;
  logoHeight?: number | string;
  headerShadow?: boolean | number | string;
  showWelcome?: boolean | number | string;
  warpHeight?: number | string;
  [key: string]: unknown;
}

export async function getPcLoginDecorate(): Promise<PcLoginDecorate | null> {
  try {
    const response = await fetch(`${SERVER_API_BASE}/api/home/home/pcLogin`, { cache: 'no-store' });
    const json: any = await response.json().catch(() => null);
    const list = json?.data?.moduleList || json?.moduleList || [];
    const item = (Array.isArray(list) ? list : []).find((row: any) => row?.type === 'pcLogin') || list?.[0];
    const module = item?.module || item;
    return module && typeof module === 'object' && Object.keys(module).length ? (module as PcLoginDecorate) : null;
  } catch {
    return null;
  }
}

export async function getProductDetail(id: number): Promise<ProductDetailResponse> {
  const response = await fetch(`${SERVER_API_BASE}/api/product/product/detail?id=${id}`, {
    cache: 'no-store',
  });
  return readData<ProductDetailResponse>(response);
}

/** 加入购物车：客户端调用，依赖登录 cookie。 */
export async function addToCart(payload: {
  id: number;
  number: number;
  skuId?: number;
  isQuick?: number;
  /** 带价附加属性 id 串（attr_type=2），对齐旧版 checkedAttrs.filter(Boolean).join(",") */
  extraAttrIds?: string;
  /** 拼团上下文（参团/开团） */
  grouponData?: Record<string, any>;
}): Promise<Record<string, unknown>> {
  const response = await fetch('/api/cart/cart/addToCart', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  return readData<Record<string, unknown>>(response);
}

export interface ProductListItem {
  productId: number;
  productName?: string;
  productSn?: string;
  productPrice?: number | string;
  picThumb?: string;
  picUrl?: string;
  brief?: string;
  productStock?: number;
  sales?: number;
}

export interface ProductListResponse {
  records: ProductListItem[];
  total: number;
}

/** 商品列表：搜索页 / 分类页 SSR 共用。 */
export async function getProducts(params: {
  page?: number;
  size?: number;
  keyword?: string;
  categoryId?: number | string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  priceMin?: string | number;
  priceMax?: string | number;
}): Promise<ProductListResponse> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 24));
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.categoryId) query.set('categoryId', String(params.categoryId));
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.priceMin !== undefined && params.priceMin !== '') query.set('priceMin', String(params.priceMin));
  if (params.priceMax !== undefined && params.priceMax !== '') query.set('priceMax', String(params.priceMax));
  const response = await fetch(`${SERVER_API_BASE}/api/product/product/list?${query.toString()}`, {
    cache: 'no-store',
  });
  const data = await readData<{ records?: ProductListItem[]; total?: number }>(response);
  return { records: data.records || [], total: Number(data.total || 0) };
}

export interface FooterData {
  config: Record<string, any> | null;
  bottomNav: Array<Record<string, any>>;
  friendLinks: Array<Record<string, any>>;
  helpCategories: Array<Record<string, any>>;
  currencies: Array<Record<string, any>>;
}

async function fetchJson<T>(path: string): Promise<T | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/${path}`, {
    next: { revalidate: 300 },
  }).catch(() => null);
  if (!response) return null;
  try {
    return await readData<T>(response);
  } catch {
    return null;
  }
}

/** PC 脚注：站点信息 / 底部导航 / 友情链接 / 帮助分类 / 货币列表（Footer 语言货币 toolbar 用）。 */
export async function getFooterData(): Promise<FooterData> {
  const [config, nav, friendLinks, helpCategories, currencies] = await Promise.all([
    fetchJson<Record<string, any>>('common/config/initConfigSettings'),
    fetchJson<Record<string, any>>('common/pc/getNav'),
    fetchJson<Array<Record<string, any>>>('home/home/friendLinks'),
    fetchJson<Array<Record<string, any>>>('article/category/indexBzzxList?categorySize=5&articleSize=4'),
    fetchJson<Array<Record<string, any>>>('common/currency/getCurrency').catch(() => []),
  ]);
  return {
    config,
    bottomNav: Array.isArray(nav?.bottomNav) ? nav.bottomNav : [],
    friendLinks: Array.isArray(friendLinks) ? friendLinks : [],
    helpCategories: Array.isArray(helpCategories) ? helpCategories : [],
    currencies: Array.isArray(currencies) ? currencies : [],
  };
}

export async function getArticleIssueInfo(articleId: number): Promise<Record<string, any> | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/article/article/issueInfo?id=${articleId}`, {
    next: { revalidate: 300 },
  }).catch(() => null);
  if (!response) return null;
  try {
    return await readData<Record<string, any>>(response);
  } catch {
    return null;
  }
}

export interface ArticleItem {
  articleId: number;
  articleTitle: string;
  articleCategoryId: number;
  articleThumb?: string;
  articleAuthor?: string;
  description?: string;
  clickCount?: number;
  addTime?: number;
}

export interface ArticleListResponse {
  records: ArticleItem[];
  total: number;
  page?: number;
  pageSize?: number;
}

/** 资讯列表：服务端直连后端。 */
export async function getArticleList(
  params: { page?: number; pageSize?: number; categoryId?: number; keyword?: string } = {},
): Promise<ArticleListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set('page', String(params.page));
  if (params.pageSize) query.set('size', String(params.pageSize));
  if (params.categoryId) query.set('articleCategoryId', String(params.categoryId));
  if (params.keyword) query.set('keyword', params.keyword);
  const response = await fetch(`${SERVER_API_BASE}/api/article/article/list?${query.toString()}`, {
    cache: 'no-store',
  });
  return readData<ArticleListResponse>(response);
}


export interface SeckillRecord {
  productId: number;
  productName?: string;
  productSn?: string;
  skuSn?: string;
  seoLink?: string;
  picThumb?: string;
  picUrl?: string;
  productPrice?: number | string;
  seckillPrice?: number | string;
  seckillSales?: number;
  seckillStock?: number;
  canJoin?: boolean;
  restrictTip?: string;
  shopId?: number;
  [key: string]: unknown;
}

export interface SeckillListResponse {
  records: SeckillRecord[];
  total: number;
}

/** 限时秒杀列表：服务端 SSR 拉取。 */
export async function getSeckill(params: { page?: number; size?: number } = {}): Promise<SeckillListResponse> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 20));
  const response = await fetch(`${SERVER_API_BASE}/api/home/home/getSeckill?${query.toString()}`, {
    cache: 'no-store',
  });
  const data = await readData<any>(response);
  return {
    records: Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : [],
    total: Number(data?.total || (Array.isArray(data) ? data.length : 0)),
  };
}


export interface ShopListingProduct {
  productId?: number;
  productSn?: string;
  productName?: string;
  productPrice?: number | string;
  picThumb?: string;
  picUrl?: string;
  seoLink?: string;
}

export interface ShopListItem {
  shopId: number;
  shopTitle?: string;
  shopLogo?: string;
  shopStar?: number;
  collectCount?: number;
  seoLink?: string;
  listingProduct?: ShopListingProduct[];
  [key: string]: unknown;
}

export interface ShopListResponse {
  records: ShopListItem[];
  total: number;
}

/** 店铺街列表：服务端 SSR 拉取。 */
export async function getShopList(params: { page?: number; size?: number; keyword?: string; sortField?: string } = {}): Promise<ShopListResponse> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 10));
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.sortField) query.set('sortField', params.sortField);
  const response = await fetch(`${SERVER_API_BASE}/api/shop/shop/list?${query.toString()}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return {
    records: Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : [],
    total: Number(data?.total || (Array.isArray(data) ? data.length : 0)),
  };
}


export interface ShopDetail {
  shopId?: number;
  shopTitle?: string;
  shopLogo?: string;
  shopStar?: number;
  collectCount?: number;
  collectShop?: boolean;
  description?: string;
  seoLink?: string;
  [key: string]: unknown;
}

export async function getShopDetail(shopId: number): Promise<ShopDetail> {
  const response = await fetch(`${SERVER_API_BASE}/api/shop/shop/detail?shopId=${shopId}`, { cache: 'no-store' });
  return readData<ShopDetail>(response);
}

export interface ShopCategoryNode {
  categoryId: number;
  categoryName?: string;
  children?: ShopCategoryNode[];
}

export async function getShopCategories(shopId: number): Promise<ShopCategoryNode[]> {
  const response = await fetch(`${SERVER_API_BASE}/api/shop/category/tree?shopId=${shopId}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return Array.isArray(data) ? data : Array.isArray(data?.records) ? data.records : [];
}

export async function getShopProducts(params: {
  shopId: number;
  page?: number;
  size?: number;
  categoryId?: number | string;
  keyword?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
  /** 价格区间（旧版 shopcategory/ShopFilter 价格筛选） */
  minPrice?: number | string;
  maxPrice?: number | string;
}): Promise<ProductListResponse> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 20));
  query.set('shopId', String(params.shopId));
  if (params.categoryId) query.set('categoryId', String(params.categoryId));
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
  if (params.minPrice !== undefined && params.minPrice !== '') query.set('minPrice', String(params.minPrice));
  if (params.maxPrice !== undefined && params.maxPrice !== '') query.set('maxPrice', String(params.maxPrice));
  const response = await fetch(`${SERVER_API_BASE}/api/product/product/list?${query.toString()}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return {
    records: Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : [],
    total: Number(data?.total || 0),
  };
}


export interface ShopHeadConfig {
  pcDefaultStyle?: string | number;
  [key: string]: unknown;
}

export async function getShopHead(shopId: number): Promise<ShopHeadConfig | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/shop/shop/head?shopId=${shopId}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return data || null;
}

export interface ShopDecorateData {
  decorateId?: number;
  moduleList?: Array<{
    type: string;
    url?: string;
    /** 模块标题（旧版装修契约字段，contract.ts 适配层会消费） */
    label?: string;
    moduleIndex?: number | string;
    isShow?: boolean;
    fixed?: boolean;
    module?: Record<string, any>;
  }>;
  pageModule?: Record<string, any>;
  [key: string]: unknown;
}

export async function getShopDecorate(shopId: number): Promise<ShopDecorateData | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/shop/shop/decorate?shopId=${shopId}`, { cache: 'no-store' });
  return readData<ShopDecorateData>(response);
}

export async function getShopModuleProducts(shopId: number, size = 8): Promise<ProductListResponse> {
  return getShopProducts({ shopId, page: 1, size });
}


export interface ExchangeItem {
  id: number;
  productId?: number;
  productName?: string;
  picThumb?: string;
  picUrl?: string;
  productPrice?: number | string;
  discountsPrice?: number | string;
  exchangeIntegral?: number;
  [key: string]: unknown;
}

export async function getExchangeList(params: { page?: number; size?: number } = {}): Promise<{ records: ExchangeItem[]; total: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 20));
  query.set('sortField', 'id');
  query.set('sortOrder', 'desc');
  query.set('isEnabled', '1');
  const response = await fetch(`${SERVER_API_BASE}/api/product/exchange/list?${query.toString()}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return {
    records: Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : [],
    total: Number(data?.total || 0),
  };
}


export async function getExchangeDetail(id: number): Promise<Record<string, any> | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/product/exchange/detail?id=${id}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return data || null;
}


export async function getActivityDecorate(params: { id?: number; previewId?: number } = {}): Promise<HomeDecorateResponse> {
  const query = new URLSearchParams();
  if (params.id) query.set('id', String(params.id));
  if (params.previewId) query.set('previewId', String(params.previewId));
  const suffix = query.toString() ? `?${query.toString()}` : '';
  const response = await fetch(`${SERVER_API_BASE}/api/home/home/pcIndex${suffix}`, { cache: 'no-store' });
  return readData<HomeDecorateResponse>(response);
}


export interface JoinNavItem {
  title?: string;
  content?: string;
  image?: string;
  images?: Array<{ picUrl?: string; picThumb?: string; picLink?: string }>;
}

export async function getJoinData(): Promise<JoinNavItem[]> {
  const response = await fetch(`${SERVER_API_BASE}/api/home/home/mobileNav?decorateSn=investmentPromotionHomepage`, { cache: 'no-store' });
  const data = await readData<any>(response);
  const list = data?.data || data;
  return Array.isArray(list) ? list : [];
}


export async function getJoinSection(decorateSn: string): Promise<JoinNavItem[]> {
  const response = await fetch(`${SERVER_API_BASE}/api/home/home/mobileNav?decorateSn=${encodeURIComponent(decorateSn)}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  const list = data?.data || data;
  return Array.isArray(list) ? list : [];
}


export interface GiftCardProduct {
  productId: number;
  productName?: string;
  picUrl?: string;
  skuPrice?: number | string;
  productPrice?: number | string;
  seoLink?: string;
}

export interface GiftCardInfo {
  giftCardSn?: string;
  cardNumber?: string;
  cardGroupName?: string;
  cardGroupsId?: number;
  shopTitle?: string;
  shopId?: number;
  imageUrl?: string;
  expiredTime?: number | string;
  status?: number;
  isExchange?: string;
  giftCardProducts?: GiftCardProduct[];
  giftCardGroups?: {
    cardGroupsId?: number;
    cardGroupName?: string;
    imageUrl?: string;
    giftCardProducts?: GiftCardProduct[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export async function getGiftCardDetail(giftCardSn: string): Promise<GiftCardInfo | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/promotion/giftCardGroups/detail?giftCardSn=${encodeURIComponent(giftCardSn)}`, { cache: 'no-store' });
  return readData<GiftCardInfo>(response);
}


export interface ArticleListItem {
  articleId: number;
  articleTitle?: string;
  articleThumb?: string;
  description?: string;
  articleTag?: string;
  addTime?: string;
  [key: string]: unknown;
}

export async function getArticleNewsList(params: { page?: number; size?: number; categorySn?: string } = {}): Promise<{ records: ArticleListItem[]; total: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 20));
  if (params.categorySn) query.set('categorySn', params.categorySn);
  const response = await fetch(`${SERVER_API_BASE}/api/article/article/list?${query.toString()}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return {
    records: Array.isArray(data?.records) ? data.records : [],
    total: Number(data?.total || 0),
  };
}

export async function getArticleNewsDetail(articleId: number): Promise<Record<string, any> | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/article/article/newsInfo?id=${articleId}`, { cache: 'no-store' });
  return readData<Record<string, any>>(response);
}


export interface AccountChangeItem {
  changeTime?: string;
  balance?: number | string;
  frozenBalance?: number | string;
  changeTypeName?: string;
  changeDesc?: string;
}

export async function getAccountChanges(params: { page?: number; size?: number } = {}): Promise<{ records: AccountChangeItem[]; total: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 15));
  const response = await fetch(`${SERVER_API_BASE}/api/user/account/list?${query.toString()}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return {
    records: Array.isArray(data?.records) ? data.records : [],
    total: Number(data?.total || 0),
  };
}


export async function getUserDetail(): Promise<Record<string, any> | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/user/user/detail`, { cache: 'no-store' });
  return readData<Record<string, any>>(response);
}


export interface RechargeOrderItem {
  addTime?: string;
  amount?: number | string;
  type?: string;
  postscript?: string;
  statusType?: string;
  [key: string]: unknown;
}

export async function getRechargeOrders(params: { page?: number; size?: number } = {}): Promise<{ records: RechargeOrderItem[]; total: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 15));
  const response = await fetch(`${SERVER_API_BASE}/api/user/rechargeOrder/list?${query.toString()}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return {
    records: Array.isArray(data?.records) ? data.records : [],
    total: Number(data?.total || 0),
  };
}


export interface InquiryItem {
  id: number;
  content?: string;
  status?: number;
  createTime?: string;
  product?: { productId?: number; productName?: string; picThumb?: string };
  replies?: Array<{ content?: string; createTime?: string; replyType?: number }>;
  [key: string]: unknown;
}

export async function getInquiryList(params: { page?: number; size?: number; status?: number } = {}): Promise<{ records: InquiryItem[]; total: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 10));
  if (params.status !== undefined) query.set('status', String(params.status));
  const response = await fetch(`${SERVER_API_BASE}/api/user/priceInquiry/list?${query.toString()}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return { records: Array.isArray(data?.records) ? data.records : [], total: Number(data?.total || 0) };
}

export async function getInquiryDetail(id: number): Promise<Record<string, any> | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/user/priceInquiry/detail?id=${id}`, { cache: 'no-store' });
  return readData<Record<string, any>>(response);
}


export interface CreditOrderItem {
  orderId: number;
  orderSn?: string;
  orderTime?: string;
  creditAmount?: number | string;
  totalQuantity?: number;
  settlementStatus?: number;
  settlementStatusText?: string;
  riskStatus?: number;
  riskStatusText?: string;
  items?: Array<{ productId?: number; productName?: string; picThumb?: string; quantity?: number; price?: number | string }>;
}

export interface CreditDetail {
  creditLimit?: number | string;
  usedAmount?: number | string;
  availableAmount?: number | string;
  settlementType?: number;
  settlementDays?: number;
  remainingDays?: number;
  pendingOrders?: CreditOrderItem[];
  settledOrders?: CreditOrderItem[];
}

export async function getCreditDetail(): Promise<CreditDetail | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/user/user/creditDetail`, { cache: 'no-store' });
  return readData<CreditDetail>(response);
}


export interface GrouponRecordDetail {
  grouponPromotionRecordId?: number;
  productId?: number;
  productName?: string;
  picThumb?: string;
  grouponImage?: string;
  productPrice?: number | string;
  minGrouponPrice?: number | string;
  minGroupNum?: number;
  joinNumCount?: number;
  joinStatus?: number;
  joinStatusDesc?: string;
  endTime?: string;
  orderId?: number;
  shopTitle?: string;
  joinUsers?: Array<{ userId?: number; nickname?: string; avatar?: string; leader?: boolean; classIcon?: string }>;
  [key: string]: unknown;
}

export async function getGrouponRecordDetail(recordId: number): Promise<GrouponRecordDetail | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/promotion/groupon/record/details?grouponPromotionRecordId=${recordId}`, { cache: 'no-store' });
  return readData<GrouponRecordDetail>(response);
}


export async function getGrouponBanners(): Promise<string[]> {
  const response = await fetch(`${SERVER_API_BASE}/api/promotion/groupon/imageList`, { cache: 'no-store' });
  const data = await readData<any>(response);
  const records = Array.isArray(data?.records) ? data.records : Array.isArray(data) ? data : [];
  return records.map((item: any) => String(item?.pcGrouponImage || '')).filter(Boolean);
}

export interface GrouponListItem {
  productId?: number;
  grouponPromotionItemId?: number;
  productName?: string;
  picThumb?: string;
  grouponPrice?: number | string;
  productPrice?: number | string;
  minGroupNum?: number;
  joinNumCount?: number;
  /** 拼团活动结束时间（旧版 JoiningGoodsList 倒计时用） */
  endTime?: string;
  /** 是否允许参与（false 显示「仅限会员」灰态） */
  canJoin?: boolean;
  restrictTip?: string;
  /** 阶梯团档位 JSON（[{groupNumKey, groupNum}]） */
  groupNum?: string;
  [key: string]: unknown;
}

export async function getGrouponItems(params: { page?: number; size?: number; keyword?: string } = {}): Promise<{ records: GrouponListItem[]; total: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 20));
  if (params.keyword) query.set('keyword', params.keyword);
  const response = await fetch(`${SERVER_API_BASE}/api/promotion/groupon/itemList?${query.toString()}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return { records: Array.isArray(data?.records) ? data.records : [], total: Number(data?.total || 0) };
}


export interface FeedbackListItem {
  id?: number;
  content?: string;
  addTime?: string;
  reply?: { content?: string; addTime?: string };
  [key: string]: unknown;
}

export async function getFeedbackList(params: { page?: number; size?: number; orderId?: number; orderSn?: string } = {}): Promise<{ records: FeedbackListItem[]; total: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 10));
  if (params.orderId) query.set('orderId', String(params.orderId));
  if (params.orderSn) query.set('orderSn', params.orderSn);
  const response = await fetch(`${SERVER_API_BASE}/api/user/feedback/list?${query.toString()}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return { records: Array.isArray(data?.records) ? data.records : [], total: Number(data?.total || 0) };
}


export interface AftersalesRecordItem {
  aftersalesId?: number;
  /** 售后单号（Rust AftersalesVO.aftersales_sn） */
  aftersalesSn?: string;
  /** 售后类型名（Rust AftersalesVO.aftersales_type_name） */
  aftersalesTypeName?: string;
  orderSn?: string;
  addTime?: string;
  statusName?: string;
  /** 退款金额（Rust AftersalesVO.refund_amount，字符串） */
  refundAmount?: string;
  aftersalesItems?: Array<{ productId?: number; productName?: string; productSn?: string; picThumb?: string; quantity?: number }>;
  [key: string]: unknown;
}

export async function getAftersalesRecords(params: { page?: number; size?: number } = {}): Promise<{ records: AftersalesRecordItem[]; total: number }> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 10));
  const response = await fetch(`${SERVER_API_BASE}/api/user/aftersales/getRecord?${query.toString()}`, { cache: 'no-store' });
  const data = await readData<any>(response);
  return { records: Array.isArray(data?.records) ? data.records : [], total: Number(data?.total || 0) };
}

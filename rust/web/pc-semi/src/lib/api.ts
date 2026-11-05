import type { HomeDecorateResponse } from '@/decorate/types';

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
    throw new Error(`接口返回不是 JSON（HTTP ${response.status}）`);
  }
  if (!response.ok || (json.code !== undefined && json.code !== 0)) {
    throw new Error(json.msg || json.message || `请求失败（HTTP ${response.status}）`);
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

/** PC 公共头部：通常已经包含在 pageModule.pcHeader 中，此接口用于独立刷新。 */
export async function getPcHeader(previewId?: number): Promise<Record<string, unknown> | null> {
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

/** PC 脚注：站点信息 / 底部导航 / 友情链接 / 帮助分类。 */
export async function getFooterData(): Promise<FooterData> {
  const [config, nav, friendLinks, helpCategories] = await Promise.all([
    fetchJson<Record<string, any>>('common/config/initConfigSettings'),
    fetchJson<Record<string, any>>('common/pc/getNav'),
    fetchJson<Array<Record<string, any>>>('home/home/friendLinks'),
    fetchJson<Array<Record<string, any>>>('article/category/indexBzzxList?categorySize=5&articleSize=4'),
  ]);
  return {
    config,
    bottomNav: Array.isArray(nav?.bottomNav) ? nav.bottomNav : [],
    friendLinks: Array.isArray(friendLinks) ? friendLinks : [],
    helpCategories: Array.isArray(helpCategories) ? helpCategories : [],
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
}): Promise<ProductListResponse> {
  const query = new URLSearchParams();
  query.set('page', String(params.page || 1));
  query.set('size', String(params.size || 20));
  query.set('shopId', String(params.shopId));
  if (params.categoryId) query.set('categoryId', String(params.categoryId));
  if (params.keyword) query.set('keyword', params.keyword);
  if (params.sortField) query.set('sortField', params.sortField);
  if (params.sortOrder) query.set('sortOrder', params.sortOrder);
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
    moduleIndex?: number | string;
    isShow?: boolean;
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
  joinUsers?: Array<{ userId?: number; nickname?: string; avatar?: string }>;
  [key: string]: unknown;
}

export async function getGrouponRecordDetail(recordId: number): Promise<GrouponRecordDetail | null> {
  const response = await fetch(`${SERVER_API_BASE}/api/promotion/groupon/record/details?grouponPromotionRecordId=${recordId}`, { cache: 'no-store' });
  return readData<GrouponRecordDetail>(response);
}

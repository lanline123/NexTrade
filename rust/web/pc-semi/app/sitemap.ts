import type { MetadataRoute } from 'next';
import { getArticleList, getProducts, getShopList } from '@/lib/api';

const BASE = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');

/** sitemap 单次生成最多翻页数（避免列表接口慢时拖垮 /sitemap.xml；规模变大后可拆 sitemap index）。 */
const MAX_LIST_PAGES = 5;
/** 列表接口单页条数。 */
const PAGE_SIZE = 200;

export const revalidate = 3600;

/** 静态可索引路由：均为真实 200 页面（/category 会 307 → /search，/login、/register 已在 robots 中禁止抓取，故不入 sitemap）。 */
const STATIC_ROUTES: Array<{
  path: string;
  changeFrequency: NonNullable<MetadataRoute.Sitemap[number]['changeFrequency']>;
  priority: number;
}> = [
  { path: '', changeFrequency: 'hourly', priority: 1 },
  { path: '/search', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/article', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/article/news/list', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/article/issue', changeFrequency: 'monthly', priority: 0.5 },
  { path: '/help', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/coupon/list', changeFrequency: 'weekly', priority: 0.5 },
  { path: '/activity', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/seckill', changeFrequency: 'daily', priority: 0.8 },
  { path: '/exchange', changeFrequency: 'weekly', priority: 0.6 },
  { path: '/shop', changeFrequency: 'weekly', priority: 0.7 },
  { path: '/shop/license', changeFrequency: 'monthly', priority: 0.3 },
  { path: '/join', changeFrequency: 'monthly', priority: 0.4 },
  { path: '/joining', changeFrequency: 'monthly', priority: 0.4 },
];

type SitemapEntry = MetadataRoute.Sitemap[number];

function toAbsolute(path: string): string {
  return `${BASE}${path || '/'}`;
}

/** 文章 `addTime` 为 Unix 秒时转 Date；缺失/异常时退回当前时间，避免输出 Invalid Date。 */
function articleLastModified(addTime?: number): Date {
  if (addTime && Number.isFinite(addTime) && addTime > 1_000_000_000 && addTime < 4_000_000_000) {
    return new Date(addTime * 1000);
  }
  return new Date();
}

/** 分页拉全量（最多 MAX_LIST_PAGES 页），任何一页失败都向上抛由调用方降级。 */
async function fetchAllPages<T>(
  loader: (page: number, size: number) => Promise<{ records: T[]; total?: number }>,
): Promise<T[]> {
  const all: T[] = [];
  for (let page = 1; page <= MAX_LIST_PAGES; page += 1) {
    const data = await loader(page, PAGE_SIZE);
    const records = Array.isArray(data?.records) ? data.records : [];
    all.push(...records);
    if (records.length < PAGE_SIZE) break;
    const total = Number(data?.total || 0);
    if (total > 0 && all.length >= total) break;
  }
  return all;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map((route) => ({
    url: toAbsolute(route.path),
    lastModified: now,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
  const seen = new Set(entries.map((entry) => entry.url));
  const push = (url: string, entry: Omit<SitemapEntry, 'url'>) => {
    if (seen.has(url)) return;
    seen.add(url);
    entries.push({ url, ...entry });
  };

  try {
    const products = await fetchAllPages((page, size) => getProducts({ page, size }));
    for (const product of products) {
      if (!product?.productId) continue;
      push(`${BASE}/product/${product.productId}`, {
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch {
    // 商品接口失败不阻断 sitemap
  }

  try {
    const articles = await fetchAllPages((page, size) => getArticleList({ page, pageSize: size }));
    for (const article of articles) {
      if (!article?.articleId) continue;
      push(`${BASE}/article/issue/info?articleId=${article.articleId}`, {
        lastModified: articleLastModified(article.addTime),
        changeFrequency: 'monthly',
        priority: 0.5,
      });
    }
  } catch {
    // 文章接口失败不阻断 sitemap
  }

  try {
    const shops = await fetchAllPages((page, size) => getShopList({ page, size }));
    for (const shop of shops) {
      if (!shop?.shopId) continue;
      push(`${BASE}/shop/${shop.shopId}`, {
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  } catch {
    // 店铺接口失败不阻断 sitemap
  }

  return entries;
}

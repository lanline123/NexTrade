import type { MetadataRoute } from 'next';
import { getArticleList, getProducts } from '@/lib/api';

const BASE = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPaths = ['', '/search', '/category', '/login', '/register', '/article', '/help', '/coupon/list'];
  const items: MetadataRoute.Sitemap = staticPaths.map((path) => ({
    url: `${BASE}${path || '/'}`,
    lastModified: now,
    changeFrequency: path === '' ? 'hourly' : 'weekly',
    priority: path === '' ? 1 : 0.6,
  }));

  try {
    const products = await getProducts({ page: 1, size: 200 });
    for (const product of products.records) {
      items.push({
        url: `${BASE}/product/${product.productId}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.8,
      });
    }
  } catch {
    // 商品接口失败不阻断 sitemap
  }

  try {
    const articles = await getArticleList({ page: 1, pageSize: 100 });
    for (const article of articles.records) {
      items.push({
        url: `${BASE}/article/issue/info?articleId=${article.articleId}`,
        lastModified: now,
        changeFrequency: 'monthly',
        priority: 0.5,
      });
    }
  } catch {
    // 文章接口失败不阻断 sitemap
  }

  return items;
}

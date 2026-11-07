import { permanentRedirect } from 'next/navigation';

/**
 * /article/news/info 兼容路由。
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/article/news/Info.vue。
 * 原版站内链接实际走 /article/news/list?articleId=，新版把列表与详情合并在
 * app/article/news/list/page.tsx，这里把旧深链带上 articleId 永久转过去（308，SEO 等价 301），
 * 避免落到 404 兜底。
 */
export const dynamic = 'force-dynamic';

function read(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default function ArticleNewsInfoLegacy({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const articleId = read(searchParams?.articleId) || read(searchParams?.id) || read(searchParams?.article_id);
  const categorySn = read(searchParams?.categorySn);
  const query = new URLSearchParams();
  if (articleId) query.set('articleId', articleId);
  if (categorySn) query.set('categorySn', categorySn);
  const suffix = query.toString();
  permanentRedirect(suffix ? `/article/news/list?${suffix}` : '/article/news/list');
}

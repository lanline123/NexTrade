import { redirect } from 'next/navigation';

/**
 * /category/<seoLink> 兼容路由。
 * 源码对照：java.../view/pc/pages/category/[...slug].vue —— 先按 SEO 链接解析分类 ID，
 * 再回写 ?cat= 并复用搜索组件；解析失败跳 /404。新版不能简单 redirect('/search')，
 * 否则 seoLink 丢失、分类维度筛选失效。
 */
export const dynamic = 'force-dynamic';

const API_BASE = (process.env.PC_API_BASE || 'https://battery.recy.cc').replace(/\/$/, '');

interface PageProps {
  params: { slug: string[] };
  searchParams?: { [key: string]: string | string[] | undefined };
}

function read(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function CategorySlugPage({ params, searchParams }: PageProps) {
  const segments = Array.isArray(params?.slug) ? params.slug : String(params?.slug || '').split('/');
  const seoLink = segments.map((item) => String(item || '').trim()).filter(Boolean).join('/');
  const queryCat = read(searchParams?.cat) || read(searchParams?.categoryId);
  let categoryId = Number(queryCat) > 0 ? String(Number(queryCat)) : '';
  if (!categoryId && seoLink) {
    try {
      const response = await fetch(`${API_BASE}/api/sys/seo/getCategoryIdBySeoLink?seoLink=${encodeURIComponent(seoLink)}`, { cache: 'no-store' });
      const json: any = await response.json().catch(() => null);
      const id = Number(json?.data ?? json);
      if (Number.isInteger(id) && id > 0) categoryId = String(id);
    } catch {
      categoryId = '';
    }
  }
  const query = new URLSearchParams();
  if (categoryId) query.set('cat', categoryId);
  const keyword = read(searchParams?.keyword);
  if (keyword) query.set('keyword', keyword);
  const suffix = query.toString();
  redirect(suffix ? `/search?${suffix}` : '/search');
}

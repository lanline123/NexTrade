import type { Metadata } from 'next';
import ProductDetailView, { buildProductMetadata } from '../product-view';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string[] };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildProductMetadata(params.slug);
}

/** 源码 pages/product/[...slug].vue：支持 /product/<seo-slug>.<sn> 形式 */
export default async function ProductSlugPage({ params, searchParams }: PageProps) {
  const raw = searchParams?.uiStyle;
  // 源码 pages/product/[...slug].vue 固定 ui-version="overseas"，不读后台风格配置；
  // 保留 ?uiStyle= 仅作本地预览，默认必须落在跨境简约版。
  const uiStyleParam = (Array.isArray(raw) ? raw[0] : raw) || 'overseas';
  return <ProductDetailView slug={params.slug} uiStyleParam={uiStyleParam} />;
}

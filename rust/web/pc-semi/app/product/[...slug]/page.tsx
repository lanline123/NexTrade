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
  // 与 /product/[id] 保持一致：风格由后台「装修 → PC端装修 → 商品页风格」下发，
  // ?uiStyle= 仅用于本地预览（resolveUiStyle 在非 dev 环境会忽略它）。
  // 旧实现这里硬编码 'overseas'，会把后台下发的 1/2 覆盖掉，导致切换风格无效。
  const uiStyleParam = Array.isArray(raw) ? raw[0] : raw;
  return <ProductDetailView slug={params.slug} uiStyleParam={uiStyleParam} />;
}

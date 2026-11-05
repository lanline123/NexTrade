import type { Metadata } from 'next';
import ProductDetailView, { buildProductMetadata } from '../product-view';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { slug: string[] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildProductMetadata(params.slug);
}

/** 源码 pages/product/[...slug].vue：支持 /product/<seo-slug>.<sn> 形式 */
export default async function ProductSlugPage({ params }: PageProps) {
  return <ProductDetailView slug={params.slug} />;
}

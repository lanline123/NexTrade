import type { Metadata } from 'next';
import ProductDetailView, { buildProductMetadata } from '../product-view';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildProductMetadata(params.id);
}

/** 三套风格由后台 productDetailStyleType 下发；?uiStyle=old|new|overseas 可覆盖预览。 */
export default async function ProductPage({ params, searchParams }: PageProps) {
  const raw = searchParams?.uiStyle;
  const uiStyleParam = Array.isArray(raw) ? raw[0] : raw;
  return <ProductDetailView slug={params.id} uiStyleParam={uiStyleParam} />;
}

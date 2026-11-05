import type { Metadata } from 'next';
import ProductDetailView, { buildProductMetadata } from '../product-view';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  return buildProductMetadata(params.id);
}

export default async function ProductPage({ params }: PageProps) {
  return <ProductDetailView slug={params.id} />;
}

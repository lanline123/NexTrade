import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import ProductDetailClient from '@/components/ProductDetailClient';
import { getPcHeader, getProductDetail } from '@/lib/api';
import PcFooter from '@/components/PcFooter';

export const dynamic = 'force-dynamic';
const SITE_URL = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');

interface PageProps {
  params: { id: string };
}

async function loadProduct(id: string) {
  const productId = Number(id);
  if (!Number.isFinite(productId) || productId <= 0) return null;
  try {
    return await getProductDetail(productId);
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const detail = await loadProduct(params.id);
  const item = detail?.item;
  if (!item) return { title: '商品不存在 · 万物新生' };
  return {
    title: `${item.productName} · 万物新生`,
    description: item.productBrief || item.keywords || item.productName,
    alternates: { canonical: `/product/${params.id}` },
    openGraph: {
      type: 'website',
      url: `/product/${params.id}`,
      title: item.productName,
      description: item.productBrief || item.productName,
      images: item.picLarge ? [item.picLarge] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title: item.productName,
      description: item.productBrief || item.productName,
      images: item.picLarge ? [item.picLarge] : undefined,
    },
  };
}

export default async function ProductPage({ params }: PageProps) {
  const detail = await loadProduct(params.id);
  if (!detail) notFound();
  const header = await getPcHeader().catch(() => null);
  const item = detail.item;
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item?.productName,
    image: item?.picLarge ? [item.picLarge] : undefined,
    description: item?.productBrief || item?.productName,
    sku: item?.productId ? String(item.productId) : undefined,
    brand: { '@type': 'Brand', name: item?.brandName || '万物新生' },
    offers: {
      '@type': 'Offer',
      url: `${SITE_URL}/product/${params.id}`,
      priceCurrency: 'CNY',
      price: Number(item?.productPrice || 0),
      availability: Number(item?.productStock || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <PcHeader config={header as any} />
      <main className="pc-product-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">首页</Link>
            <span>/</span>
            <span>{detail.item?.productName || '商品详情'}</span>
          </nav>
          <ProductDetailClient detail={detail} />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

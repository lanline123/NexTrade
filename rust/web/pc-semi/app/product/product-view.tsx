import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import ProductDetailClient from '@/components/ProductDetailClient';
import { extractProductSnFromSlug, getPcHeader, loadProductBySlug } from '@/lib/api';

/**
 * 商品详情页（服务端）
 * 源码对照：pages/product/[...slug].vue —— URL 使用商品 SN（可带 "." 前缀的 SEO 片段），
 * 由 utils/seo-url.ts extractProductSnFromSlug 解析后请求 product/product/detail?sn=
 */
const SITE_URL = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');

export function normalizeSlug(slug: string | string[] | undefined): string[] {
  if (Array.isArray(slug)) return slug.map((item) => String(item));
  if (typeof slug === 'string' && slug) return [slug];
  return [];
}

export async function buildProductMetadata(slug: string | string[] | undefined): Promise<Metadata> {
  const sn = extractProductSnFromSlug(slug);
  const detail = await loadProductBySlug(sn);
  const item = detail?.item;
  if (!item) return { title: '商品不存在 · 万物新生' };
  const path = `/product/${normalizeSlug(slug).join('/')}`;
  return {
    title: `${item.productName} · 万物新生`,
    description: item.productBrief || item.keywords || item.productName,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
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

export default async function ProductDetailView({ slug }: { slug: string | string[] }) {
  const segments = normalizeSlug(slug);
  const sn = extractProductSnFromSlug(segments);
  const detail = await loadProductBySlug(sn);
  if (!detail?.item) notFound();
  const [header, item] = [await getPcHeader().catch(() => null), detail.item];
  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: item?.productName,
    image: item?.picLarge ? [item.picLarge] : undefined,
    description: item?.productBrief || item?.productName,
    sku: item?.productSn,
    offers: {
      '@type': 'Offer',
      price: Number(item?.productPrice || 0),
      priceCurrency: 'CNY',
      availability: Number(item?.stock || 0) > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      url: `${SITE_URL}/product/${segments.join('/')}`,
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }} />
      <PcHeader config={header as any} />
      <ProductDetailClient detail={detail as any} />
      <PcFooter />
    </>
  );
}

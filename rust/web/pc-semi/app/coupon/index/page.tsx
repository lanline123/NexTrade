import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getPcHeader } from '@/lib/api';
import CouponDetailClient from '@/components/CouponDetailClient';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '优惠券详情 · 万物新生', robots: { index: false, follow: false } };

export default async function CouponDetailPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const read = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || '' : value || '');
  const id = read(searchParams?.id);
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">首页</Link><span>/</span>
            <Link href="/coupon">集券中心</Link><span>/</span><span>优惠券详情</span>
          </nav>
          <h1 className="pc-cart-title">优惠券详情</h1>
          <CouponDetailClient couponId={id} />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

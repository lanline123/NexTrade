import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import CartClient from '@/components/CartClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '购物车 · 万物新生',
  robots: { index: false, follow: false },
};

export default async function CartPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-cart-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">首页</Link>
            <span>/</span>
            <span>购物车</span>
          </nav>
          <h1 className="pc-cart-title">购物车</h1>
          <CartClient />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

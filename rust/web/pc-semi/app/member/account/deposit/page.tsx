import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import DepositClient from '@/components/DepositClient';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '余额充值 · 万物新生', robots: { index: false, follow: false } };

export default async function DepositPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><span>充值</span></nav>
          <h1 className="pc-cart-title">余额充值</h1>
          <DepositClient />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

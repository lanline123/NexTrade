import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import WithdrawClient from '@/components/WithdrawClient';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '余额提现 · 万物新生', robots: { index: false, follow: false } };

export default async function WithdrawPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><span>提现</span></nav>
          <h1 className="pc-cart-title">余额提现</h1>
          <WithdrawClient />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

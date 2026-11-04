import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import BrowsingHistoryClient from '@/components/BrowsingHistoryClient';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '浏览历史 · 万物新生', robots: { index: false, follow: false } };

export default async function BrowsingHistoryPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><span>浏览历史</span></nav>
          <h1 className="pc-cart-title">浏览历史</h1>
          <BrowsingHistoryClient />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

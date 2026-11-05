import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import MemberCenterClient from '@/components/MemberCenterClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '会员中心 · 万物新生',
  robots: { index: false, follow: false },
};

export default async function MemberPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">首页</Link>
            <span>/</span>
            <span>会员中心</span>
          </nav>
          <h1 className="pc-cart-title">会员中心</h1>
          <MemberCenterClient />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

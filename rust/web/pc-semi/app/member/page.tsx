import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import MemberCenterClient from '@/components/MemberCenterClient';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '会员中心 · 万物新生', robots: { index: false, follow: false } };

/** 源码 pages/member/index.vue */
export default async function MemberPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page mc-page">
        <div className="mc-wrap">
          <h1 className="mc-title">会员中心</h1>
          <MemberCenterClient />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

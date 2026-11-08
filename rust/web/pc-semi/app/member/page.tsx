import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import MemberCenterClient from '@/components/MemberCenterClient';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '会员中心 · 万物新生', robots: { index: false, follow: false } };

/** 源码 pages/member/index.vue —— 现代化仪表盘改版（.mh-*，样式见 member-home.scss） */
export default async function MemberPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container mh-page">
          <MemberCenterClient />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

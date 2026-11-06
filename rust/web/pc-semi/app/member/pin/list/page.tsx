import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import PinListClient from '@/components/PinListClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '我的团购 · 万物新生', robots: { index: false, follow: false } };

/** 源码 pages/member/pin/List.vue */
export default async function PinListPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title="我的团购">
    <PinListClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import UserMessageCenter from '@/components/UserMessageCenter';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '站内信 · 万物新生', robots: { index: false, follow: false } };

/** 源码 pages/member/userMessage/List.vue */
export default async function UserMessagePage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title="站内信">
    <UserMessageCenter />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

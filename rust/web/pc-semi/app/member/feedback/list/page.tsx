import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import FeedbackClient from '@/components/FeedbackClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '留言反馈 · 万物新生', robots: { index: false, follow: false } };

export default async function FeedbackPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title="我的留言">
    <FeedbackClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

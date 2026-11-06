import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import DepositClient from '@/components/DepositClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '余额充值 · 万物新生', robots: { index: false, follow: false } };

export default async function DepositPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title="余额充值">
    <DepositClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import SecurityClient from '@/components/SecurityClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '账户安全 · 万物新生', robots: { index: false, follow: false } };

export default async function SecurityPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title="账户安全">
    <SecurityClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

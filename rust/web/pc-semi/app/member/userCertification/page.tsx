import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import CertificationClient from '@/components/CertificationClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '会员实名认证 · 万物新生', robots: { index: false, follow: false } };

export default async function UserCertificationPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title="会员实名认证">
    <CertificationClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import OfflineClaimClient from '@/components/OfflineClaimClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '认款信息 · 万物新生', robots: { index: false, follow: false } };

export default async function ClaimInfoPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const raw = searchParams?.orderId || searchParams?.id;
  const orderId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('认款信息')}>
    <OfflineClaimClient orderId={orderId} />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

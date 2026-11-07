import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import AfterSalesApplyClient from '@/components/AfterSalesApplyClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '申请售后 · 万物新生', robots: { index: false, follow: false } };

export default async function AfterSalesApplyPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const read = (value: string | string[] | undefined) => Number(Array.isArray(value) ? value[0] : value) || 0;
  const orderId = read(searchParams?.orderId);
  const itemId = read(searchParams?.itemId);
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('申请售后')}>
    <AfterSalesApplyClient orderId={orderId} itemId={itemId} />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

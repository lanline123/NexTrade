import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import InvoiceDetailClient from '@/components/InvoiceDetailClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '发票详情 · 万物新生', robots: { index: false, follow: false } };

export default async function OrderInvoiceDetailPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const read = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || '' : value || '');
  const id = read(searchParams?.id);
  const mode = read(searchParams?.type) === 'reapply' ? 'reapply' : 'info';
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={mode === 'reapply' ? t('重新申请发票') : '发票详情'}>
    <InvoiceDetailClient invoiceId={id} mode={mode} />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

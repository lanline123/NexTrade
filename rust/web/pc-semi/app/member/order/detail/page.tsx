import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import OrderDetailClient from '@/components/OrderDetailClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
  title: t('订单详情 · 万物新生'),
  robots: { index: false, follow: false },
};
}

export default async function MemberOrderDetailPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
    const t = getServerT();
  const raw = searchParams?.id;
  const orderId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const header = await getPcHeader().catch(() => null);

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('订单详情')}>
    <OrderDetailClient orderId={orderId} />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

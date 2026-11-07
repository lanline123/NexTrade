import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import GiftCardExchangeClient from '@/components/GiftCardExchangeClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '礼品卡兑换 · 万物新生', robots: { index: false, follow: false } };

export default async function GiftCardExchangePage() {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('礼品卡兑换')}>
    <GiftCardExchangeClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

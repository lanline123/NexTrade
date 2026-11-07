import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import BrowsingHistoryClient from '@/components/BrowsingHistoryClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '浏览历史 · 万物新生', robots: { index: false, follow: false } };

export default async function BrowsingHistoryPage() {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('浏览历史')}>
    <BrowsingHistoryClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

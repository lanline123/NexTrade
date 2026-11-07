import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import AddressClient from '@/components/AddressClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '收货地址 · 万物新生', robots: { index: false, follow: false } };

export default async function AddressPage() {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('收货地址')}>
    <AddressClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

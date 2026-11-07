import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import ProfileClient from '@/components/ProfileClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '账户资料 · 万物新生', robots: { index: false, follow: false } };

export default async function ProfilePage() {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('账户资料')}>
    <ProfileClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

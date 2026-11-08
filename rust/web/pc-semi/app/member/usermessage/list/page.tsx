import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import UserMessageCenter from '@/components/UserMessageCenter';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '站内信 · 万物新生', robots: { index: false, follow: false } };

/** 源码 pages/member/usermessage/List.vue */
export default async function UserMessagePage() {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('站内信')} noNav>
    <UserMessageCenter />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import SecurityClient from '@/components/SecurityClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '账户安全 · 万物新生', robots: { index: false, follow: false } };

/** 源码 pages/member/security/dialogInfo.vue：账户安全（手机/邮箱/登录密码） */
export default async function SecurityDialogInfoPage() {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('账户安全')}>
    <SecurityClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

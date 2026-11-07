import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import JoinIntroClient from '@/components/JoinIntroClient';
import MemberAuthGuard from '@/components/MemberAuthGuard';
import { getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '入驻申请 · 万物新生' };

export default async function JoinIntroPage() {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  return (
    <MemberAuthGuard>
      <div className="join-page">
        <PcHeader config={header as any} />
        <main className="join-intro-main">
          <div className="join-container">
            <nav className="pc-breadcrumb"><Link href="/">{t('首页')}</Link><span>/</span><Link href="/join">{t('招商入驻')}</Link><span>/</span><span>{t('入驻申请')}</span></nav>
            <JoinIntroClient />
          </div>
        </main>
        <PcFooter />
      </div>
    </MemberAuthGuard>
  );
}

import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import PinListClient from '@/components/PinListClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '我的团购 · 万物新生', robots: { index: false, follow: false } };

/** 源码 pages/member/pin/List.vue */
export default async function PinListPage() {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('我的团购')}>
          {/* 旧版 pin/List.vue:7-11  <div class="info-row"><div class="title-or-tabs"><span>我的团购</span></div><div class="page-info-body"> */}
          <div className="info-row mp-pin-list">
            <div className="title-or-tabs"><span>{t('我的团购')}</span></div>
            <PinListClient />
          </div>
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

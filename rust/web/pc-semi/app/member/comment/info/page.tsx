import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import CommentInfoClient from '@/components/CommentInfoClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '评价晒单 · 万物新生', robots: { index: false, follow: false } };

export default async function CommentInfoPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const raw = searchParams?.orderId || searchParams?.id;
  const orderId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('评价晒单')}>
          {/* 旧版 Info.vue：CommonPageContainer > .menu(MemberNav) + .info-row > .collection */}
          <div className="mp-comment-info">
            <div className="info-row">
              <CommentInfoClient orderId={orderId} />
            </div>
          </div>
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

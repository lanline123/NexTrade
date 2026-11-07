import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import CommentCenterClient from '@/components/CommentCenterClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '评价晒单 · 万物新生', robots: { index: false, follow: false } };

export default async function CommentCenterPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  // 旧版 List.vue：orderType query 初始化 Tab（0 待评价 / 1 待晒单 / 2 已评价）
  const rawType = searchParams?.orderType;
  const orderType = Number(Array.isArray(rawType) ? rawType[0] : rawType);
  const initialTab = orderType === 1 ? 'showed' : orderType === 2 ? 'commented' : orderType === 0 ? 'pending' : undefined;
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('评价晒单')}>
    <CommentCenterClient initialTab={initialTab} />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

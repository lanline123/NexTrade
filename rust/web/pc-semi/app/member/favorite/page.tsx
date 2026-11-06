import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import FavoriteClient from '@/components/FavoriteClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';
import MemberShell from '@/components/MemberShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '我的收藏 · 万物新生', robots: { index: false, follow: false } };

export default async function FavoritePage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title="我的收藏">
    <FavoriteClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

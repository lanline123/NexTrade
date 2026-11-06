import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import CollectShopClient from '@/components/CollectShopClient';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '收藏的店铺 · 万物新生', robots: { index: false, follow: false } };

export default async function CollectShopPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title="收藏的店铺">
    <CollectShopClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

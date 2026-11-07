import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import MemberOrderList from '@/components/MemberOrderList';
import MemberShell from '@/components/MemberShell';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
  title: t('我的订单 · 万物新生'),
  robots: { index: false, follow: false },
};
}

export default async function MemberOrderListPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  // 旧版 MemberOrderList.vue：?type=awaitPay 等初始化 Tab
  const rawType = searchParams?.type;
  const initialType = Array.isArray(rawType) ? rawType[0] : rawType;
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('我的订单')}>
          <MemberOrderList initialType={initialType} />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

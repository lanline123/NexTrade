import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import AfterSalesApplyClient from '@/components/AfterSalesApplyClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '售后申请 · 万物新生', robots: { index: false, follow: false } };

/**
 * 售后申请页（旧版 pages/member/return/Info.vue）。
 *
 * 注意：此路径曾被误改为 redirect（跳订单详情），导致
 * MemberOrderList / OrderDetailClient / ReturnApplyListClient 三处「申请售后」按钮全部断链。
 * 旧版语义即「售后申请表单」，此处恢复。
 */
export default async function ReturnInfoPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const read = (value: string | string[] | undefined) => Number(Array.isArray(value) ? value[0] : value) || 0;
  const orderId = read(searchParams?.orderId);
  const itemId = read(searchParams?.itemId);
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('售后申请')}>
    <AfterSalesApplyClient orderId={orderId} itemId={itemId} />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

import { redirect } from 'next/navigation';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

export default async function ReturnInfoRedirect({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const read = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || '' : value || '');
  const aftersalesId = read(searchParams?.id) || read(searchParams?.aftersalesId);
  const orderId = read(searchParams?.orderId) || read(searchParams?.order_id);
  if (aftersalesId) redirect(`/member/aftersales/detail?id=${aftersalesId}`);
  if (orderId) redirect(`/member/order/detail?id=${orderId}`);

  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('退款详情')}>
    <div className="comment-empty">{t('缺少售后单号或订单号，无法打开退款详情。请从订单列表进入。')}</div>
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

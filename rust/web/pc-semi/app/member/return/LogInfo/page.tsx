import { redirect } from 'next/navigation';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function ReturnLogInfoRedirect({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const read = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || '' : value || '');
  const id = read(searchParams?.id) || read(searchParams?.aftersalesId);
  if (id) redirect(`/member/aftersales/detail?id=${id}`);
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page"><div className="pc-container"><div className="comment-empty">缺少售后单号，无法打开退款日志。请从退款申请记录进入。</div></div></main>
      <PcFooter />
    </>
  );
}

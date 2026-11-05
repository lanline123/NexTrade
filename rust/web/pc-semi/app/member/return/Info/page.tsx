import { redirect } from 'next/navigation';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';

export default async function ReturnInfoRedirect({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
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
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><span>退款详情</span></nav>
          <h1 className="pc-cart-title">退款详情</h1>
          <div className="comment-empty">缺少售后单号或订单号，无法打开退款详情。请从订单列表进入。</div>
        </div>
      </main>
      <PcFooter />
    </>
  );
}

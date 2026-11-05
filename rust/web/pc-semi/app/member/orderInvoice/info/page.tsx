import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import InvoiceApplyClient from '@/components/InvoiceApplyClient';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '申请发票 · 万物新生', robots: { index: false, follow: false } };

export default async function OrderInvoiceInfoPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const raw = searchParams?.orderId || searchParams?.id;
  const orderId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><Link href="/member/orderInvoice">发票申请</Link><span>/</span><span>申请发票</span></nav>
          <h1 className="pc-cart-title">申请发票</h1>
          <InvoiceApplyClient orderId={orderId} />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

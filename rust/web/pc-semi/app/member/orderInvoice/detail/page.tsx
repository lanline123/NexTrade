import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import InvoiceDetailClient from '@/components/InvoiceDetailClient';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '发票详情 · 万物新生', robots: { index: false, follow: false } };

export default async function OrderInvoiceDetailPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const read = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || '' : value || '');
  const id = read(searchParams?.id);
  const mode = read(searchParams?.type) === 'reapply' ? 'reapply' : 'info';
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">首页</Link><span>/</span>
            <Link href="/member">会员中心</Link><span>/</span>
            <Link href="/member/orderInvoice">发票申请</Link><span>/</span>
            <span>{mode === 'reapply' ? '重新申请' : '发票详情'}</span>
          </nav>
          <h1 className="pc-cart-title">{mode === 'reapply' ? '重新申请发票' : '发票详情'}</h1>
          <InvoiceDetailClient invoiceId={id} mode={mode} />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

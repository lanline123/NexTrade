import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import FeedbackFormClient from '@/components/FeedbackFormClient';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '提交留言 · 万物新生', robots: { index: false, follow: false } };

export default async function FeedbackFormPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const read = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || '' : value || '');
  const orderId = Number(read(searchParams?.orderId)) || 0;
  const orderSn = read(searchParams?.orderSn);
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><span>提交留言</span></nav>
          <h1 className="pc-cart-title">提交留言</h1>
          <FeedbackFormClient orderId={orderId} orderSn={orderSn} />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PayClient from '@/components/PayClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '支付订单 · 万物新生',
  robots: { index: false, follow: false },
};

export default async function PayPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const raw = searchParams?.id;
  const orderId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  // 旧版渠道页会带 type 参数（/order/paypal?id=&type=paypal），用于默认选中渠道
  const typeRaw = searchParams?.type;
  const defaultChannel = String(Array.isArray(typeRaw) ? typeRaw[0] || '' : typeRaw || '').trim();
  const header = await getPcHeader().catch(() => null);

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-pay-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">首页</Link>
            <span>/</span>
            <span>支付订单</span>
          </nav>
          <PayClient orderId={orderId} defaultChannel={defaultChannel} />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

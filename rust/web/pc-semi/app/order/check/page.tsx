import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import CheckoutClient from '@/components/CheckoutClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
  title: t('确认订单 · 万物新生'),
  robots: { index: false, follow: false },
};
}

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
    const t = getServerT();
  const raw = searchParams?.cartIds;
  const text = Array.isArray(raw) ? raw[0] || '' : raw || '';
  const cartIds = text
    .split(',')
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item) && item > 0);
  // 旧版确认页通过 query.flowType 区分普通/礼品卡/预售等结算流程（默认 1）
  const flowRaw = searchParams?.flowType;
  const flowText = Array.isArray(flowRaw) ? flowRaw[0] || '' : flowRaw || '';
  const flowType = Number(flowText) > 0 ? Number(flowText) : 1;
  const header = await getPcHeader().catch(() => null);

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-checkout-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">{t('首页')}</Link>
            <span>/</span>
            <Link href="/cart">{t('购物车')}</Link>
            <span>/</span>
            <span>{t('确认订单')}</span>
          </nav>
          <h1 className="pc-cart-title">{t('订单结算页')}</h1>
          <CheckoutClient cartIds={cartIds} flowType={flowType} />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

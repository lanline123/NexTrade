import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import ExchangeDetailClient from '@/components/ExchangeDetailClient';
import { getExchangeDetail, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

interface PageProps {
  params: { id: string };
}

async function load(id: string) {
  const exchangeId = Number(id);
  if (!Number.isFinite(exchangeId) || exchangeId <= 0) return null;
  return getExchangeDetail(exchangeId).catch(() => null);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = getServerT();
  const data = await load(params.id);
  const name = data?.exchangeInfo?.productName || data?.item?.productName || data?.productName;
  return { title: name ? t('{name} · 积分兑换 · 万物新生', { name }) : t('积分兑换详情 · 万物新生') };
}

export default async function ExchangeDetailPage({ params }: PageProps) {
    const t = getServerT();
  const data = await load(params.id);
  if (!data) notFound();
  const info = data.exchangeInfo || data.item || data;
  const header = await getPcHeader().catch(() => null);
  const name = info?.productName || t('兑换详情');

  return (
    <div className="exchange-detail-page">
      <PcHeader config={header as any} />
      <main className="exchange-detail-main">
        <div className="exchange-detail-container">
          <nav className="pc-breadcrumb">
            <Link href="/">{t('首页')}</Link><span>/</span><Link href="/exchange">{t('积分换购')}</Link><span>/</span><span>{name}</span>
          </nav>
          {/* 旧版复用商品详情组件（productType="exchange"）：规格选择 + 立即兑换/加入购物车 */}
          <ExchangeDetailClient data={data} />
        </div>
      </main>
      <PcFooter />
    </div>
  );
}

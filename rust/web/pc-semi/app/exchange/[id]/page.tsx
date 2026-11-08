import type { Metadata } from 'next';
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

/**
 * 积分兑换商品详情。
 * 源码对照：view/pc/pages/exchange/[id].vue —— 旧版整页只有一个
 *   <Product productType="exchange" :ui-version="uiVersion" />
 * 没有面包屑、没有自造外层类名，样式全部来自商品详情组件本身（app/core-pages.scss 的
 * .mp-item 等，已在第 8–27 轮移植）。所以这里只保留 PcHeader/PcFooter 与详情组件。
 */
async function load(id: string) {
  const exchangeId = Number(id);
  if (!Number.isFinite(exchangeId) || exchangeId <= 0) return null;
  return getExchangeDetail(exchangeId).catch(() => null);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const t = getServerT();
  const data = await load(params.id);
  const name = data?.exchangeInfo?.productName || data?.item?.productName || data?.productName;
  return { title: name ? `${name} · ${t('积分兑换')} · 万物新生` : t('积分兑换详情 · 万物新生') };
}

export default async function ExchangeDetailPage({ params }: PageProps) {
  const data = await load(params.id);
  if (!data) notFound();
  const header = await getPcHeader().catch(() => null);

  return (
    <div className="pg-exchange-detail">
      <PcHeader config={header as any} />
      <ExchangeDetailClient data={data} />
      <PcFooter />
    </div>
  );
}

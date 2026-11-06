import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import { getPcHeader, getSeckill } from '@/lib/api';
import SeckillListClient from '@/components/SeckillListClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '限时秒杀 · 万物新生',
  description: '限时秒杀，抢先提醒，低价好物限时抢购。',
  alternates: { canonical: '/seckill/list' },
};

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function SeckillPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const size = 15;
  const [data, header] = await Promise.all([
    getSeckill({ page, size }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  return (
    <div className="seckill-page">
      <PcHeader config={header as any} />
      <div className="seckill-hero">
        <div className="seckill-hero__slogan" />
      </div>
      <main className="seckill-main">
        <div className="seckill-container">
          {data.records.length ? (
            <SeckillListClient records={data.records} total={data.total} page={page} size={size} />
          ) : (
            <div className="seckill-empty">暂无秒杀商品</div>
          )}
        </div>
      </main>
      <PcFooter />
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getExchangeDetail, getPcHeader } from '@/lib/api';

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
  const data = await load(params.id);
  const name = data?.exchangeInfo?.productName || data?.productName;
  return { title: name ? `${name} · 积分兑换 · 万物新生` : '积分兑换详情 · 万物新生' };
}

export default async function ExchangeDetailPage({ params }: PageProps) {
  const data = await load(params.id);
  if (!data) notFound();
  const info = data.exchangeInfo || data;
  const header = await getPcHeader().catch(() => null);
  const stock = Number(info.productStock || 0);
  const productId = Number(info.productId || data.productId || 0);

  return (
    <div className="exchange-detail-page">
      <PcHeader config={header as any} />
      <main className="exchange-detail-main">
        <div className="exchange-detail-container">
          <nav className="pc-breadcrumb">
            <Link href="/">首页</Link><span>/</span><Link href="/exchange">积分换购</Link><span>/</span><span>{info.productName || '兑换详情'}</span>
          </nav>
          <section className="exchange-detail-card">
            <div className="exchange-detail-pic">
              <img src={info.picThumb || info.picUrl || data.picThumb || ''} alt={info.productName || ''} />
            </div>
            <div className="exchange-detail-info">
              <h1>{info.productName || data.productName || '积分兑换商品'}</h1>
              <div className="exchange-detail-price">
                <span>兑换价</span>
                <b>¥ {Number(info.discountsPrice || info.productPrice || 0).toFixed(2)}</b>
                <span>+</span>
                <b>{Number(info.exchangeIntegral || 0)} 积分</b>
              </div>
              <div className="exchange-detail-meta">原价：¥ {Number(info.productPrice || 0).toFixed(2)}</div>
              <div className="exchange-detail-meta">库存：{stock > 0 ? stock : '已兑完'}</div>
              {productId ? <Link className="exchange-detail-link" href={`/product/${productId}`}>查看商品详情</Link> : null}
              <button className="exchange-detail-btn" type="button" disabled={stock <= 0}>
                {stock > 0 ? '立即兑换' : '已兑完'}
              </button>
            </div>
          </section>
        </div>
      </main>
      <PcFooter />
    </div>
  );
}

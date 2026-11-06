import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import { getExchangeList, getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '积分换购 · 万物新生',
  description: '积分换购商品列表，积分加金额兑换好物。',
};

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function ExchangePage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const size = 20;
  const [data, header] = await Promise.all([
    getExchangeList({ page, size }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const hrefFor = (next: number) => (next > 1 ? `/exchange?page=${next}` : '/exchange');

  return (
    <div className="exchange-page">
      <PcHeader config={header as any} />
      <main className="exchange-main">
        <div className="exchange-container">
          <h1 className="exchange-title">积分换购</h1>
          {data.records.length ? (
            <ul className="exchange-list">
              {data.records.map((item) => (
                <li className="exchange-card" key={item.id}>
                  <Link href={`/exchange/${item.id}`} className="exchange-card__pic" target="_blank">
                    <img src={item.picThumb || item.picUrl || ''} alt={item.productName || ''} loading="lazy" />
                  </Link>
                  <div className="exchange-card__info">
                    <Link href={`/exchange/${item.id}`} className="exchange-card__name" target="_blank">{item.productName}</Link>
                    <div className="exchange-card__price">原价：¥ {Number(item.productPrice || 0).toFixed(2)}</div>
                    <div className="exchange-card__integral">
                      积分价：¥ {Number(item.discountsPrice || 0).toFixed(2)} + <b>{Number(item.exchangeIntegral || 0)}</b> 积分
                    </div>
                    <Link className="exchange-card__btn" href={`/exchange/${item.id}`} target="_blank">立即兑换</Link>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="exchange-empty">暂时没有符合条件的商品！</div>
          )}
          {data.records.length > 0 && pages > 1 ? (
            <nav className="exchange-pagination">
              {page > 1 ? <Link href={hrefFor(page - 1)}>上一页</Link> : <span className="is-disabled">上一页</span>}
              <span>{page} / {pages}</span>
              {page < pages ? <Link href={hrefFor(page + 1)}>下一页</Link> : <span className="is-disabled">下一页</span>}
            </nav>
          ) : null}
        </div>
      </main>
      <PcFooter />
    </div>
  );
}


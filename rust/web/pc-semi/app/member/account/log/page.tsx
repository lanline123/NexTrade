import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getPcHeader, getRechargeOrders } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '充值记录 · 万物新生', robots: { index: false, follow: false } };

interface PageProps { searchParams?: { [key: string]: string | string[] | undefined } }

export default async function RechargeLogPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page) || 1);
  const size = 15;
  const [data, header] = await Promise.all([
    getRechargeOrders({ page, size }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const hrefFor = (next: number) => next > 1 ? `/member/account/log?page=${next}` : '/member/account/log';

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><span>充值记录</span></nav>
          <h1 className="pc-cart-title">充值记录</h1>
          <section className="account-table-wrap">
            <table className="account-table">
              <thead><tr><th>充值时间</th><th>充值金额</th><th>类型</th><th>备注</th><th>状态</th></tr></thead>
              <tbody>
                {data.records.map((item, index) => (
                  <tr key={index}>
                    <td>{item.addTime || '-'}</td>
                    <td className="is-income">¥ {Number(item.amount || 0).toFixed(2)}</td>
                    <td>{item.type || '-'}</td>
                    <td>{item.postscript || '-'}</td>
                    <td>{item.statusType || '-'}</td>
                  </tr>
                ))}
                {!data.records.length ? <tr><td colSpan={5} className="account-empty">暂无充值记录</td></tr> : null}
              </tbody>
            </table>
            {pages > 1 ? (
              <nav className="account-pagination">
                {page > 1 ? <Link href={hrefFor(page - 1)}>上一页</Link> : <span className="is-disabled">上一页</span>}
                <span>{page} / {pages}</span>
                {page < pages ? <Link href={hrefFor(page + 1)}>下一页</Link> : <span className="is-disabled">下一页</span>}
              </nav>
            ) : null}
          </section>
        </div>
      </main>
      <PcFooter />
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getAccountChanges, getPcHeader, getUserDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '账户明细 · 万物新生', robots: { index: false, follow: false } };

interface PageProps { searchParams?: { [key: string]: string | string[] | undefined } }

export default async function AccountDetailPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page) || 1);
  const size = 15;
  const [data, user, header] = await Promise.all([
    getAccountChanges({ page, size }).catch(() => ({ records: [], total: 0 })),
    getUserDetail().catch(() => null),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const userInfo: any = user || {};
  const hrefFor = (next: number) => next > 1 ? `/member/account/detail?page=${next}` : '/member/account/detail';

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><span>账户明细</span></nav>
          <h1 className="pc-cart-title">账户明细</h1>
          {/* 源码 member/account/Detail.vue 资产概览 */}
          <section className="account-summary">
            <div><span>我的可用余额</span><b>¥ {Number(userInfo.balance || 0).toFixed(2)}</b></div>
            <div><span>全部余额</span><b>¥ {Number(userInfo.totalBalance || 0).toFixed(2)}</b></div>
            <div><span>冻结余额</span><b>¥ {Number(userInfo.frozenBalance || 0).toFixed(2)}</b></div>
            <div className="account-summary__links">
              <Link href="/member/account/deposit">充值</Link>
              <Link href="/member/account/log">历史充值记录</Link>
              <Link href="/member/security">安全中心</Link>
            </div>
          </section>
          <p className="account-summary__safe">保障账号资产安全，请勿向他人泄露账号与密码。</p>
          <section className="account-table-wrap">
            <table className="account-table">
              <thead><tr><th>操作时间</th><th>金额</th><th>类型</th><th>备注</th></tr></thead>
              <tbody>
                {data.records.map((item, index) => (
                  <tr key={index}>
                    <td>{item.changeTime || '-'}</td>
                    <td className={Number(item.balance || 0) >= 0 ? 'is-income' : 'is-expense'}>
                      {Number(item.balance || 0) >= 0 ? '+' : ''}{Number(item.balance || 0).toFixed(2)}
                      {Number(item.frozenBalance || 0) !== 0 ? `（冻结 ${Number(item.frozenBalance).toFixed(2)}）` : ''}
                    </td>
                    <td>{item.changeTypeName || '-'}</td>
                    <td>{item.changeDesc || '-'}</td>
                  </tr>
                ))}
                {!data.records.length ? <tr><td colSpan={4} className="account-empty">您还没有明细记录</td></tr> : null}
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

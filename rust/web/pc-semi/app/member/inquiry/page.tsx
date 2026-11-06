import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getInquiryList, getPcHeader } from '@/lib/api';
import MemberShell from '@/components/MemberShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '商品咨询 · 万物新生', robots: { index: false, follow: false } };

interface PageProps { searchParams?: { [key: string]: string | string[] | undefined } }
function read(value: string | string[] | undefined): string { return Array.isArray(value) ? value[0] || '' : value || ''; }

export default async function InquiryListPage({ searchParams }: PageProps) {
  const page = Math.max(1, Number(read(searchParams?.page)) || 1);
  const statusRaw = read(searchParams?.status);
  const status = statusRaw === '1' ? 1 : statusRaw === '0' ? 0 : undefined;
  const size = 10;
  const [data, header] = await Promise.all([
    getInquiryList({ page, size, status }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const href = (nextPage: number, nextStatus = statusRaw) => {
    const query = new URLSearchParams();
    if (nextStatus) query.set('status', nextStatus);
    if (nextPage > 1) query.set('page', String(nextPage));
    return query.toString() ? `/member/inquiry?${query.toString()}` : '/member/inquiry';
  };

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title="商品咨询">
              <div className="inquiry-tabs">
      <Link href="/member/inquiry" className={!statusRaw ? 'is-active' : ''}>全部</Link>
      <Link href="/member/inquiry?status=1" className={statusRaw === '1' ? 'is-active' : ''}>已回复</Link>
      <Link href="/member/inquiry?status=0" className={statusRaw === '0' ? 'is-active' : ''}>未回复</Link>
    </div>
    <section className="account-table-wrap">
      <table className="account-table inquiry-table">
        <thead><tr><th>商品</th><th>咨询内容</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
        <tbody>
          {data.records.map((item) => (
            <tr key={item.id}>
              <td>
                <div className="inquiry-product">
                  <img src={item.product?.picThumb || ''} alt={item.product?.productName || ''} />
                  <span>{item.product?.productName || '-'}</span>
                </div>
              </td>
              <td className="inquiry-content">{item.content || '-'}</td>
              <td>{Number(item.status) === 1 ? '已回复' : '未回复'}</td>
              <td>{item.createTime || '-'}</td>
              <td><Link href={`/member/inquiry/info?id=${item.id}`}>查看</Link></td>
            </tr>
          ))}
          {!data.records.length ? <tr><td colSpan={5} className="account-empty">暂无咨询</td></tr> : null}
        </tbody>
      </table>
      {pages > 1 ? (
        <nav className="account-pagination">
          {page > 1 ? <Link href={href(page - 1)}>上一页</Link> : <span className="is-disabled">上一页</span>}
          <span>{page} / {pages}</span>
          {page < pages ? <Link href={href(page + 1)}>下一页</Link> : <span className="is-disabled">下一页</span>}
        </nav>
      ) : null}
    </section>
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

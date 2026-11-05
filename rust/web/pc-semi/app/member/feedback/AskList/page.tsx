import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getFeedbackList, getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '问答记录 · 万物新生', robots: { index: false, follow: false } };

export default async function FeedbackAskListPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const read = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] || '' : value || '');
  const page = Math.max(1, Number(read(searchParams?.page)) || 1);
  const orderId = Number(read(searchParams?.orderId)) || undefined;
  const orderSn = read(searchParams?.orderSn) || undefined;
  const size = 10;
  const [data, header] = await Promise.all([
    getFeedbackList({ page, size, orderId, orderSn }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const href = (next: number) => {
    const query = new URLSearchParams();
    if (orderId) query.set('orderId', String(orderId));
    if (orderSn) query.set('orderSn', orderSn);
    if (next > 1) query.set('page', String(next));
    return query.toString() ? `/member/feedback/AskList?${query.toString()}` : '/member/feedback/AskList';
  };

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><span>问答记录</span></nav>
          <h1 className="pc-cart-title">问答记录</h1>
          <section className="feedback-list">
            {data.records.length ? data.records.map((item, index) => (
              <article className="feedback-card" key={item.id || index}>
                <div className="feedback-card__time">{item.addTime || '-'}</div>
                <div className="feedback-card__content">{item.content || '-'}</div>
                {item.reply ? (
                  <div className="feedback-card__reply">
                    <span>客服回复：{item.reply.addTime || ''}</span>
                    <p>{item.reply.content || ''}</p>
                  </div>
                ) : <div className="feedback-card__pending">等待客服回复</div>}
              </article>
            )) : <div className="comment-empty">暂无问答记录</div>}
            {pages > 1 ? (
              <nav className="comment-pagination">
                {page > 1 ? <Link href={href(page - 1)}>上一页</Link> : <span className="is-disabled">上一页</span>}
                <span>{page} / {pages}</span>
                {page < pages ? <Link href={href(page + 1)}>下一页</Link> : <span className="is-disabled">下一页</span>}
              </nav>
            ) : null}
          </section>
        </div>
      </main>
      <PcFooter />
    </>
  );
}

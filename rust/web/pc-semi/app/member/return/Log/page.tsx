import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getAftersalesRecords, getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '退款申请记录 · 万物新生', robots: { index: false, follow: false } };

export default async function ReturnLogPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const page = Math.max(1, Number(Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page) || 1);
  const size = 10;
  const [data, header] = await Promise.all([
    getAftersalesRecords({ page, size }).catch(() => ({ records: [], total: 0 })),
    getPcHeader().catch(() => null),
  ]);
  const pages = Math.max(1, Math.ceil(data.total / size));
  const href = (next: number) => next > 1 ? `/member/return/Log?page=${next}` : '/member/return/Log';

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><span>退款申请记录</span></nav>
          <h1 className="pc-cart-title">退款申请记录</h1>
          <section className="return-log-list">
            {data.records.length ? data.records.map((item, index) => (
              <article className="return-log-card" key={item.aftersalesId || index}>
                <header>
                  <span>订单号：{item.orderSn || '-'}</span>
                  <span>申请时间：{item.addTime || '-'}</span>
                  <span className="return-log-card__status">{item.statusName || '-'}</span>
                </header>
                <div className="return-log-card__body">
                  <div className="return-log-card__items">
                    {(item.aftersalesItems || []).slice(0, 4).map((product, productIndex) => (
                      <div className="return-log-product" key={productIndex}>
                        <img src={product.picThumb || ''} alt={product.productName || ''} />
                        <span>{product.productName || '商品'}</span>
                        <small>x{product.quantity || 1}</small>
                      </div>
                    ))}
                  </div>
                  {item.aftersalesId ? <Link className="return-log-card__action" href={`/member/aftersales/detail?id=${item.aftersalesId}`}>查看详情</Link> : null}
                </div>
              </article>
            )) : <div className="comment-empty">暂无退款申请记录</div>}
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

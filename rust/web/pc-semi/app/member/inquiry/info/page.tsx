import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getInquiryDetail, getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '咨询详情 · 万物新生', robots: { index: false, follow: false } };

export default async function InquiryInfoPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const raw = searchParams?.id;
  const id = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const [data, header] = await Promise.all([
    id ? getInquiryDetail(id).catch(() => null) : Promise.resolve(null),
    getPcHeader().catch(() => null),
  ]);
  const item: any = data?.item || data || {};
  const replies = data?.replies || item.replies || [];

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><Link href="/member/inquiry">商品咨询</Link><span>/</span><span>咨询详情</span></nav>
          <h1 className="pc-cart-title">咨询详情</h1>
          <section className="inquiry-detail">
            <div className="inquiry-detail__product">
              <img src={item.product?.picThumb || ''} alt={item.product?.productName || ''} />
              <div><b>{item.product?.productName || '商品'}</b><span>{item.createTime || ''}</span></div>
            </div>
            <div className="inquiry-detail__content"><b>咨询内容</b><p>{item.content || '-'}</p></div>
            <div className="inquiry-detail__replies">
              <b>回复</b>
              {Array.isArray(replies) && replies.length ? replies.map((reply: any, index: number) => (
                <div key={index} className="inquiry-reply"><p>{reply.content || ''}</p><span>{reply.createTime || ''}</span></div>
              )) : <p className="inquiry-no-reply">暂无回复</p>}
            </div>
          </section>
        </div>
      </main>
      <PcFooter />
    </>
  );
}

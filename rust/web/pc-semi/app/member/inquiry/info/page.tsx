import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getInquiryDetail, getPcHeader } from '@/lib/api';
import InquiryReplyClient from '@/components/InquiryReplyClient';
import MemberShell from '@/components/MemberShell';

import { getServerT } from '@/i18n/server';
import { formatPrice } from '@/lib/currency';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '咨询详情 · 万物新生', robots: { index: false, follow: false } };

export default async function InquiryInfoPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const raw = searchParams?.id;
  const id = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const [data, header] = await Promise.all([
    id ? getInquiryDetail(id).catch(() => null) : Promise.resolve(null),
    getPcHeader().catch(() => null),
  ]);
  const item: any = data?.item || data || {};
  const replies = data?.replies || item.replies || item.replyRecords || [];
  /** 源码 statusClass：0 待回复 / 1 已回复 / 2 已关闭 */
  const status = Number(item.status ?? 0);
  const STATUS: Record<number, { text: string; icon: string }> = {
    0: { text: '等待商家回复', icon: '⏳' },
    1: { text: '商家已回复', icon: '✓' },
    2: { text: '已关闭', icon: '—' },
  };

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('咨询详情')}>
              <section className="inquiry-detail">
      {/* 源码 member/inquiry/Info.vue 状态卡 */}
      <div className={`inquiry-detail__status is-${status}`}>
        <span className="inquiry-detail__status-icon">{STATUS[status]?.icon || '⏳'}</span>
        {STATUS[status]?.text || item.statusText || t('待回复')}
      </div>
      <div className="inquiry-detail__product">
        <img src={item.product?.picThumb || item.product?.picUrl || ''} alt={item.product?.productName || ''} />
        <div>
          <b>{item.product?.productName || t('商品')}</b>
          {Number(item.product?.marketPrice || 0) > 0 ? (
            <span className="inquiry-detail__market">市场价{formatPrice(Number(item.product.marketPrice))}</span>
          ) : null}
          {Number(item.product?.productPrice || 0) > 0 ? (
            <span className="inquiry-detail__shop-price">{formatPrice(Number(item.product.productPrice))}</span>
          ) : null}
          <span>{item.createTime || ''}</span>
        </div>
      </div>
      <div className="inquiry-detail__content"><b>{t('询价内容')}</b><p>{item.content || '-'}</p></div>
      {/* 源码：询价时间 / 联系人 / 联系方式 */}
      <dl className="inquiry-detail__meta">
        <div><dt>{t('询价时间')}</dt><dd>{item.createTime || '-'}</dd></div>
        <div><dt>{t('联系人')}</dt><dd>{item.contactName || '-'}</dd></div>
        <div><dt>{t('联系方式')}</dt><dd>{item.mobile || '-'}</dd></div>
      </dl>
      <div className="inquiry-detail__replies">
        <b>{t('回复')}</b>
        {Array.isArray(replies) && replies.length ? replies.map((reply: any, index: number) => (
          <div key={index} className="inquiry-reply"><p>{reply.content || ''}</p><span>{reply.createTime || ''}</span></div>
        )) : <p className="inquiry-no-reply">{t('暂无回复')}</p>}
      </div>
      <InquiryReplyClient id={id} />
    </section>
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getCreditDetail, getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '账期支付 · 万物新生', robots: { index: false, follow: false } };

interface PageProps { searchParams?: { [key: string]: string | string[] | undefined } }

export default async function TermPayPage({ searchParams }: PageProps) {
  const tab = searchParams?.tab === 'settled' ? 'settled' : 'pending';
  const [detail, header] = await Promise.all([
    getCreditDetail().catch(() => null),
    getPcHeader().catch(() => null),
  ]);
  const orders = tab === 'settled' ? (detail?.settledOrders || []) : (detail?.pendingOrders || []);
  const settlementText = Number(detail?.settlementType) === 2 ? '季结' : '月结';

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/member">会员中心</Link><span>/</span><span>账期支付</span></nav>
          <h1 className="pc-cart-title">账期支付</h1>
          {detail ? (
            <section className="term-summary">
              <div><span>授信额度</span><b>¥ {Number(detail.creditLimit || 0).toFixed(2)}</b></div>
              <div><span>可用额度</span><b>¥ {Number(detail.availableAmount || 0).toFixed(2)}</b></div>
              <div><span>结算周期</span><b>{settlementText} / {detail.settlementDays || 30} 天</b></div>
              <div><span>剩余天数</span><b>{detail.remainingDays ?? '-'} 天</b></div>
            </section>
          ) : <div className="comment-empty">暂无账期支付资格</div>}

          <div className="term-tabs">
            <Link href="/member/termPay" className={tab === 'pending' ? 'is-active' : ''}>未结算 ({detail?.pendingOrders?.length || 0})</Link>
            <Link href="/member/termPay?tab=settled" className={tab === 'settled' ? 'is-active' : ''}>已结算 ({detail?.settledOrders?.length || 0})</Link>
          </div>

          {orders.length ? (
            <div className="term-orders">
              {orders.map((order) => (
                <article className="term-order" key={order.orderId}>
                  <header>
                    <span className={Number(order.riskStatus) === 1 ? 'is-overdue' : ''}>{order.riskStatusText || order.settlementStatusText || '待结算'}</span>
                    <span>订单号：<Link href={`/member/order/detail?id=${order.orderId}`}>{order.orderSn}</Link></span>
                    <span>{order.orderTime || ''}</span>
                  </header>
                  <div className="term-order__body">
                    <div className="term-order__goods">
                      {(order.items || []).slice(0, 4).map((item, index) => (
                        <div key={index} className="term-good">
                          <img src={item.picThumb || ''} alt={item.productName || ''} />
                          <span>{item.productName || ''}</span>
                          <small>x{item.quantity || 1}</small>
                        </div>
                      ))}
                    </div>
                    <div className="term-order__amount">
                      <span>共 {order.totalQuantity || 0} 件</span>
                      <b>¥ {Number(order.creditAmount || 0).toFixed(2)}</b>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : <div className="comment-empty">{tab === 'pending' ? '暂无未结算订单' : '暂无已结算订单'}</div>}
        </div>
      </main>
      <PcFooter />
    </>
  );
}

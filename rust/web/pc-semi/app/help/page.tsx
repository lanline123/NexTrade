import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '帮助中心 · 万物新生' };

const FAQS = [
  { q: '如何下单购买？', a: '登录后选择商品加入购物车，进入结算页选择收货地址和支付方式，提交订单后完成支付。' },
  { q: '支持哪些支付方式？', a: '支付方式由平台配置，结算页会展示当前可用的支付方式。' },
  { q: '如何查看物流？', a: '进入“会员中心 - 我的订单”，打开订单详情即可查看物流信息。' },
  { q: '如何申请售后？', a: '订单详情中可发起售后，售后记录在会员中心查看。' },
];

export default async function HelpPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-static-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><span>帮助中心</span></nav>
          <h1 className="pc-cart-title">帮助中心</h1>
          <div className="pc-faq-list">
            {FAQS.map((item) => (
              <div key={item.q} className="pc-faq-item">
                <b>{item.q}</b>
                <p>{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </main>
      <PcFooter />
    </>
  );
}

import type { Metadata } from 'next';
import PayChannelClient from '../pay/PayChannelClient';

export const dynamic = 'force-dynamic';

/** 源码 pages/order/yunpay.vue：云闪付/微信/支付宝扫码（type=wechat|alipay|yunshanfu） */
export const metadata: Metadata = {
  title: '云闪付 · 万物新生',
  robots: { index: false, follow: false },
};

export default function YunPayPage() {
  return <PayChannelClient brand="yunpay" />;
}

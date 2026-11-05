import type { Metadata } from 'next';
import PayChannelClient from '../pay/PayChannelClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '支付宝支付 · 万物新生',
  robots: { index: false, follow: false },
};

export default function PayChannelPage() {
  return <PayChannelClient brand="alipay" />;
}

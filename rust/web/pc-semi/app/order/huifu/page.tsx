import type { Metadata } from 'next';
import PayChannelClient from '../pay/PayChannelClient';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '汇付天下 · 万物新生',
  robots: { index: false, follow: false },
};

export default function PayChannelPage() {
  return <PayChannelClient brand="huifu" />;
}

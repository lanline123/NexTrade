import type { Metadata } from 'next';

import { getServerT } from '@/i18n/server';
import PayChannelClient from '../pay/PayChannelClient';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
  title: t('Stripe 支付 · 万物新生'),
  robots: { index: false, follow: false },
};
}

export default function PayChannelPage() {
  return <PayChannelClient brand="stripe" />;
}

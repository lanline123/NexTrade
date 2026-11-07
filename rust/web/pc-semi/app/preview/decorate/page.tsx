import type { Metadata } from 'next';

import { getServerT } from '@/i18n/server';
import DecoratePreview from '@/components/DecoratePreview';

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
  title: t('装修模块回归 · 万物新生'),
  robots: { index: false, follow: false },
};
}

export default function DecoratePreviewPage() {
  return <DecoratePreview />;
}

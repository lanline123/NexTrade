import type { Metadata } from 'next';
import ImageSearchClient from '@/components/ImageSearchClient';
import PcFooter from '@/components/PcFooter';

export const metadata: Metadata = {
  title: '以图搜图 · 万物新生',
  robots: { index: false, follow: false },
};

export default function ImageSearchPage() {
  return <ImageSearchClient footer={<PcFooter />} />;
}

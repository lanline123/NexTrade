import type { Metadata } from 'next';

export const metadata: Metadata = { title: '登录', robots: { index: false, follow: false } };

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return children;
}

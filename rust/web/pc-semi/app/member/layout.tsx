import type { Metadata } from 'next';
import MemberAuthGuard from '@/components/MemberAuthGuard';

export const metadata: Metadata = { title: '会员中心', robots: { index: false, follow: false } };

export default function SegmentLayout({ children }: { children: React.ReactNode }) {
  return <MemberAuthGuard>{children}</MemberAuthGuard>;
}

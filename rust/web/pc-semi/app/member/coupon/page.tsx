import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import CouponClient from '@/components/CouponClient';
import { getPcHeader } from '@/lib/api';
import PcFooter from '@/components/PcFooter';
import MemberShell from '@/components/MemberShell';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '我的优惠券 · 万物新生', robots: { index: false, follow: false } };

export default async function CouponPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title="我的优惠券">
    <CouponClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

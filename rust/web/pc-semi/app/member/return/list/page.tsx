import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import MemberShell from '@/components/MemberShell';
import ReturnApplyListClient from '@/components/ReturnApplyListClient';
import { getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
/**
 * /member/return/list —— 可申请售后的订单列表。
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/return/List.vue。
 * 旧实现 redirect 到 /member/aftersales（已申请售后记录），语义错配；这里恢复独立页面，
 * /member/aftersales 仍保留给售后记录查询。
 */
export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
  title: t('售后申请 · 万物新生'),
  robots: { index: false, follow: false },
};
}

export default async function ReturnApplyListPage() {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('售后申请')}>
          <ReturnApplyListClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

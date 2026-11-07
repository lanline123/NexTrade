import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import MemberShell from '@/components/MemberShell';
import CollectProductClient from '@/components/CollectProductClient';
import { getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
/**
 * 心愿单 / 收藏商品（规范路径）
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/member/collectProduct/List.vue
 *  - PageHeaderNew(isWhite) + CommonHeader(心愿单) → PcHeader
 *  - TopJumpBar(心愿单) + CommonPageContainer flex → MemberShell
 *  - 右侧 info-row.collect-product → CollectProductClient
 * /member/collectProduct 与 /member/favorite 为历史别名，均 re-export 本页。
 */
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
  title: t('心愿单 · 万物新生'),
  robots: { index: false, follow: false },
};
}

export default async function CollectProductListPage() {
    const t = getServerT();
  const header = await getPcHeader().catch(() => null);
  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-member-page">
        <MemberShell title={t('心愿单')}>
          <CollectProductClient />
        </MemberShell>
      </main>
      <PcFooter />
    </>
  );
}

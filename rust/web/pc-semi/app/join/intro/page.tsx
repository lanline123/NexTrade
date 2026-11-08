import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import JoinNav from '@/components/JoinNav';
import JoinIntroClient from '@/components/JoinIntroClient';
import MemberAuthGuard from '@/components/MemberAuthGuard';
import { getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '入驻申请 · 万物新生' };

/**
 * 商户入驻申请。
 * 源码对照：view/pc/pages/join/intro.vue
 * 样式：app/join-page.scss → .pg-join-intro
 *
 * 旧版外层：CommonHeader + CommonPageHeader，流程 2 起是
 *   .page-info > .card.container > step + .form-info > el-form.form-body
 */
export default async function JoinIntroPage() {
  const header = await getPcHeader().catch(() => null);
  return (
    <MemberAuthGuard>
      <div className="pg-join-intro">
        <PcHeader config={header as any} />
        <JoinNav active="intro" siteLogo={(header as any)?.siteLogo} />
        <main className="page-info">
          <div className="card container">
            <JoinIntroClient />
          </div>
        </main>
        <PcFooter />
      </div>
    </MemberAuthGuard>
  );
}

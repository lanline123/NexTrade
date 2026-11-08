import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import JoinNav from '@/components/JoinNav';
import { getJoinSection, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
/**
 * 招商计划页。
 * 源码对照：view/pc/pages/join/plan.vue（getMobileNav { decorateSn: 'investmentPlan' }）
 * 样式：app/join-page.scss → .pg-join-plan
 *
 *   .standard__wrap > .container × N > h3 + .model-body > span.content(v-html)
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '招商计划 · 万物新生' };

export default async function JoinPlanPage() {
  const [sections, header] = await Promise.all([
    getJoinSection('investmentPlan').catch(() => []),
    getPcHeader().catch(() => null),
  ]);
  return (
    <div className="pg-join-plan">
      <PcHeader config={header as any} />
      <JoinNav active="plan" siteLogo={(header as any)?.siteLogo} />
      <div className="standard__wrap">
        {sections.map((item, index) => (
          <div className="container" key={index}>
            <h3>{item.title}</h3>
            <div className="model-body">
              <span className="content" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
            </div>
          </div>
        ))}
        {!sections.length ? <div className="no-data">{getServerT()('暂无内容')}</div> : null}
      </div>
      <PcFooter />
    </div>
  );
}

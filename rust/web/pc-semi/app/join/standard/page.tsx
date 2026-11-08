import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import JoinNav from '@/components/JoinNav';
import { getJoinSection, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
/**
 * 招商标准页。
 * 源码对照：view/pc/pages/join/standard.vue（getMobileNav { decorateSn: 'investmentCriteria' }）
 * 样式：app/join-page.scss → .pg-join-standard
 *
 *   .standard__wrap > .container × N > h3 + .model-body > span.content(v-html)
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '招商标准 · 万物新生' };

export default async function JoinStandardPage() {
  const t = getServerT();
  const [sections, header] = await Promise.all([
    getJoinSection('investmentCriteria').catch(() => []),
    getPcHeader().catch(() => null),
  ]);
  return (
    <div className="pg-join-standard">
      <PcHeader config={header as any} />
      <JoinNav active="standard" siteLogo={(header as any)?.siteLogo} />
      <div className="standard__wrap">
        {sections.map((item, index) => (
          <div className="container" key={index}>
            <h3>{item.title}</h3>
            <div className="model-body">
              <span className="content" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
            </div>
          </div>
        ))}
        {!sections.length ? <div className="no-data">{t('暂无内容')}</div> : null}
      </div>
      <PcFooter />
    </div>
  );
}

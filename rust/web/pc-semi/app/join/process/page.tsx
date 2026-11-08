import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import JoinNav from '@/components/JoinNav';
import { getJoinSection, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
/**
 * 入驻流程页。
 * 源码对照：view/pc/pages/join/process.vue（getMobileNav { decorateSn: 'settlingProcess' }）
 * 样式：app/join-page.scss → .pg-join-process
 *
 *   .bg-info > .entry-main
 *       > img.bg-image（旧版 assets/images/join/ruzhubg.jpg）
 *       > .module-part.part-{index}.size-{item.size} × N > h3.part-title.title-{item.align} + span.content(v-html)
 */
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '入驻流程 · 万物新生' };

export default async function JoinProcessPage() {
  const t = getServerT();
  const [sections, header] = await Promise.all([
    getJoinSection('settlingProcess').catch(() => []),
    getPcHeader().catch(() => null),
  ]);
  return (
    <div className="pg-join-process">
      <PcHeader config={header as any} />
      <JoinNav active="process" siteLogo={(header as any)?.siteLogo} />
      <div className="bg-info">
        <div className="entry-main">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="bg-image" src="/assets/images/join/ruzhubg.jpg" alt={t('入驻流程')} />
          {sections.map((item: any, index: number) => (
            <div className={`module-part part-${index} size-${item.size ?? 0}`} key={index}>
              <h3 className={`part-title title-${item.align ?? 0}`}>{item.title}</h3>
              <span className="content" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
            </div>
          ))}
        </div>
      </div>
      <PcFooter />
    </div>
  );
}

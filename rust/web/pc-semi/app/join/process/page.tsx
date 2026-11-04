import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getJoinSection, getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '入驻流程 · 万物新生' };

export default async function JoinProcessPage() {
  const [sections, header] = await Promise.all([
    getJoinSection('settlingProcess').catch(() => []),
    getPcHeader().catch(() => null),
  ]);
  return (
    <div className="join-page">
      <PcHeader config={header as any} />
      <main className="join-process-wrap">
        <div className="join-process-stage">
          <img className="join-process-bg" src="/assets/images/join/ruzhubg.jpg" alt="入驻流程" />
          {sections.map((item: any, index: number) => (
            <div className={`join-process-part part-${index} size-${item.size || 0}`} key={index}>
              <h3 className={`part-title title-${item.align || 0}`}>{item.title}</h3>
              <div className="join-process-content" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
            </div>
          ))}
          {!sections.length ? <div className="join-process-empty">暂无流程配置</div> : null}
        </div>
      </main>
      <PcFooter />
    </div>
  );
}

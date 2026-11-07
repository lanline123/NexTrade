import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getJoinSection, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '招商标准 · 万物新生' };

export default async function JoinSectionPage() {
    const t = getServerT();
  const [sections, header] = await Promise.all([
    getJoinSection('investmentCriteria').catch(() => []),
    getPcHeader().catch(() => null),
  ]);
  return (
    <div className="join-page">
      <PcHeader config={header as any} />
      <main className="join-section-wrap">
        {sections.map((item, index) => (
          <section className="join-section" key={index}>
            <h3>{item.title}</h3>
            <div className="join-section-body" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
          </section>
        ))}
        {!sections.length ? <div className="join-section-empty">{t('暂无内容')}</div> : null}
      </main>
      <PcFooter />
    </div>
  );
}

import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import { getJoinData, getPcHeader, type JoinNavItem } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '招商入驻 · 万物新生',
  description: '招商计划、合作模式、招商标准与入驻入口。',
};

export default async function JoinPage() {
  const [items, header] = await Promise.all([
    getJoinData().catch(() => [] as JoinNavItem[]),
    getPcHeader().catch(() => null),
  ]);
  const banner = items[0];
  const platformMode = items[1];
  const selfMode = items[2];

  return (
    <div className="join-page">
      <PcHeader config={header as any} />
      <main className="join-main">
        {banner?.images?.length ? (
          <section className="join-banner">
            {banner.images.map((image, index) => (
              <a key={index} href={image.picLink || '#'}>
                <img src={image.picUrl || image.picThumb || ''} alt={banner.title || '招商 Banner'} />
              </a>
            ))}
          </section>
        ) : null}

        <section className="join-container">
          <h2 className="join-title">我要合作</h2>
          <div className="join-cards">
            <article className="join-card">
              <h3>招商计划</h3>
              <p>查询发布的热招类目和品牌</p>
              <Link href="/join/plan">查看招商计划</Link>
            </article>
            <article className="join-card">
              <h3>合作模式</h3>
              <p>了解可以合作哪些模式，各模式的优势和区别。</p>
              <a href="#join-mode">查看合作模式</a>
            </article>
            <article className="join-card">
              <h3>招商标准</h3>
              <p>查询自身行业所需要提交的资质</p>
              <Link href="/join/standard">查看招商标准</Link>
            </article>
            <article className="join-card">
              <h3>我要入驻</h3>
              <p>我已了解所有内容，需要立即入驻</p>
              <Link href="/join/intro" className="is-primary">立即入驻</Link>
            </article>
          </div>
        </section>

        <section className="join-container join-mode" id="join-mode">
          <h2 className="join-title">我要合作</h2>
          <div className="join-mode-tabs">
            <span className="is-active">平台模式</span>
            <span>自营模式</span>
          </div>
          <div className="join-mode-grid">
            {[platformMode, selfMode].map((item, index) => item ? (
              <article className="join-mode-card" key={index}>
                {item.image ? <img src={item.image} alt={item.title || ''} /> : null}
                <h3>{item.title}</h3>
                <div className="join-mode-content" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
              </article>
            ) : null)}
          </div>
        </section>
      </main>
      <PcFooter />
    </div>
  );
}

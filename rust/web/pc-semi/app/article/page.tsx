import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import { getArticleList, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '资讯中心 · 万物新生' };

function fmtDate(seconds?: number): string {
  if (!seconds) return '';
  return new Date(seconds * 1000).toLocaleDateString('zh-CN');
}

export default async function ArticlePage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const rawPage = Array.isArray(searchParams?.page) ? searchParams?.page[0] : searchParams?.page;
  const page = Math.max(1, Number(rawPage) || 1);
  const [header, data] = await Promise.all([
    getPcHeader().catch(() => null),
    getArticleList({ page, pageSize: 12 }).catch(() => ({ records: [], total: 0 })),
  ]);
  const totalPages = Math.max(1, Math.ceil((data.total || 0) / 12));

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-static-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">{t('首页')}</Link><span>/</span><span>{t('资讯中心')}</span></nav>
          <h1 className="pc-cart-title">{t('资讯中心')}</h1>
          {data.records.length ? (
            <>
              <div className="pc-article-grid">
                {data.records.map((item) => (
                  <article key={item.articleId} className="pc-article-card">
                    <Link href={`/article/issue/info?articleId=${item.articleId}`}>
                      <h2>{item.articleTitle}</h2>
                    </Link>
                    <p>{item.description || ''}</p>
                    <div className="pc-article-card__meta">
                      <span>{item.articleAuthor || t('平台资讯')}</span>
                      <span>{fmtDate(item.addTime)}</span>
                      <span>浏览 {item.clickCount || 0}</span>
                    </div>
                  </article>
                ))}
              </div>
              <div className="pc-pagination">
                {page > 1 ? <Link href={`/article?page=${page - 1}`}>{t('上一页')}</Link> : <span />}
                <span>第 {page} / {totalPages} 页</span>
                {page < totalPages ? <Link href={`/article?page=${page + 1}`}>{t('下一页')}</Link> : <span />}
              </div>
            </>
          ) : (
            <div className="pc-static-card"><b>{t('暂无资讯')}</b><p>{t('请稍后再来查看。')}</p></div>
          )}
        </div>
      </main>
      <PcFooter />
    </>
  );
}

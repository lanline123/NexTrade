import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getArticleIssueInfo, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

interface ArticlePageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readArticleId(searchParams?: ArticlePageProps['searchParams']): number {
  const raw = searchParams?.articleId;
  return Number(Array.isArray(raw) ? raw[0] : raw) || 0;
}

export async function generateMetadata({ searchParams }: ArticlePageProps): Promise<Metadata> {
  const t = getServerT();
  const articleId = readArticleId(searchParams);
  const data = articleId ? await getArticleIssueInfo(articleId).catch(() => null) : null;
  const item = data?.item;
  const description = item?.description || t('帮助中心文章');
  return {
    title: item?.articleTitle ? `${item.articleTitle} · 万物新生` : '帮助详情 · 万物新生',
    description,
    alternates: { canonical: `/article/issue/info?articleId=${articleId}` },
    openGraph: {
      type: 'article',
      url: `/article/issue/info?articleId=${articleId}`,
      title: item?.articleTitle || t('帮助详情'),
      description,
    },
  };
}

export default async function ArticleIssueInfoPage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const raw = searchParams?.articleId;
  const articleId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;
  const [header, data] = await Promise.all([getPcHeader().catch(() => null), articleId ? getArticleIssueInfo(articleId) : Promise.resolve(null)]);
  const item = data?.item || null;
  const siteUrl = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');
  const articleJsonLd = item ? {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: item.articleTitle,
    description: item.description || '',
    datePublished: item.addTime || undefined,
    mainEntityOfPage: `${siteUrl}/article/issue/info?articleId=${articleId}`,
    publisher: { '@type': 'Organization', name: '万物新生', url: siteUrl },
  } : null;
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: '首页', item: siteUrl },
      { '@type': 'ListItem', position: 2, name: '帮助中心', item: `${siteUrl}/article/issue` },
      { '@type': 'ListItem', position: 3, name: item?.articleTitle || t('文章详情') },
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd ? [articleJsonLd, breadcrumbJsonLd] : breadcrumbJsonLd) }} />
      <PcHeader config={header as any} />
      <main className="pc-static-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">{t('首页')}</Link><span>/</span><Link href="/article/issue">{t('帮助中心')}</Link><span>/</span><span>{item?.articleTitle || t('文章详情')}</span>
          </nav>
          {item ? (
            <article className="pc-article">
              <h1>{item.articleTitle}</h1>
              <div className="pc-article__meta">{item.description || ''}</div>
              <div className="pc-article__content" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
              <div className="pc-article__nav">
                {data?.prev ? <Link href={`/article/issue/info?articleId=${data.prev.articleId}`}>上一篇：{data.prev.articleTitle}</Link> : <span />}
                {data?.next ? <Link href={`/article/issue/info?articleId=${data.next.articleId}`}>下一篇：{data.next.articleTitle}</Link> : null}
              </div>
            </article>
          ) : (
            <div className="pc-static-card"><b>{t('文章不存在')}</b><Link href="/article/issue">{t('返回帮助中心 →')}</Link></div>
          )}
        </div>
      </main>
      <PcFooter />
    </>
  );
}

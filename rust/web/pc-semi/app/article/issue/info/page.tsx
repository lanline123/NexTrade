import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import HelpCategoryMenu from '@/components/HelpCategoryMenu';
import type { HelpCategory } from '@/components/HelpCategoryMenu';
import { getArticleIssueInfo, getArticleNewsList, getFooterData, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

interface ArticlePageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(searchParams: ArticlePageProps['searchParams'], key: string): string {
  const raw = searchParams?.[key];
  return (Array.isArray(raw) ? raw[0] : raw) || '';
}

function readArticleId(searchParams?: ArticlePageProps['searchParams']): number {
  return Number(readParam(searchParams, 'articleId')) || 0;
}

export async function generateMetadata({ searchParams }: ArticlePageProps): Promise<Metadata> {
  const t = getServerT();
  const articleId = readArticleId(searchParams);
  const categoryId = readParam(searchParams, 'categoryId');
  const data = articleId ? await getArticleIssueInfo(articleId).catch(() => null) : null;
  const item = data?.item;
  const description = item?.description || t('帮助中心文章');
  if (!articleId && categoryId) {
    return {
      title: t('帮助中心 · 万物新生'),
      description,
      alternates: { canonical: `/article/issue/info?categoryId=${encodeURIComponent(categoryId)}` },
    };
  }
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
  const articleId = readArticleId(searchParams);
  const categoryId = readParam(searchParams, 'categoryId');
  const page = Math.max(1, Number(readParam(searchParams, 'page')) || 1);
  /**
   * 源码 issue/Info.vue 有两种形态：
   *   ?articleId=  → 文章详情（标题 + 正文 + 上一篇/下一篇）
   *   ?categoryId= → 该分类下文章列表 + 分页
   * 旧版左侧固定是 IssueLeftMenu 分类菜单，新版保持同样的两栏结构。
   */
  const [header, footer] = await Promise.all([
    getPcHeader().catch(() => null),
    getFooterData(),
  ]);
  const categories = footer.helpCategories as unknown as HelpCategory[];
  const currentCategory = categories.find((entry) => entry.categorySn === categoryId || String(entry.articleCategoryId) === categoryId);
  /** 链接里可能带的是分类 id（旧站如此），列表接口认 categorySn，这里先换算再请求。 */
  const categorySn = currentCategory?.categorySn || categoryId;
  const [data, listData] = await Promise.all([
    articleId ? getArticleIssueInfo(articleId) : Promise.resolve(null),
    !articleId && categorySn
      ? getArticleNewsList({ page, size: 10, categorySn }).catch(() => ({ records: [], total: 0 }))
      : Promise.resolve({ records: [], total: 0 }),
  ]);
  const item = data?.item || null;
  const pageCount = Math.max(1, Math.ceil((listData.total || 0) / 10));
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
      { '@type': 'ListItem', position: 3, name: item?.articleTitle || currentCategory?.articleCategoryName || t('文章详情') },
    ],
  };
  const listHref = (target: number) => `/article/issue/info?categoryId=${encodeURIComponent(categoryId)}&page=${target}`;

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd ? [articleJsonLd, breadcrumbJsonLd] : breadcrumbJsonLd) }} />
      <PcHeader config={header as any} />
      <main className="issue-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb">
            <Link href="/">{t('首页')}</Link><span>/</span><Link href="/article/issue">{t('帮助中心')}</Link><span>/</span>
            <span>{item?.articleTitle || currentCategory?.articleCategoryName || t('文章详情')}</span>
          </nav>
          <div className="issue-content">
            <aside className="issue-col-left">
              <HelpCategoryMenu categories={categories} activeKey={categoryId} activeArticleId={articleId} title={t('帮助分类')} />
            </aside>
            <div className="issue-col-right">
              {item ? (
                <article className="issue-article">
                  <h1 className="issue-article__title">{item.articleTitle}</h1>
                  <div className="issue-article__body" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
                  <div className="issue-article__nav">
                    {data?.prev ? <Link href={`/article/issue/info?articleId=${data.prev.articleId}`}>{t('上一篇')}：{data.prev.articleTitle}</Link> : <span />}
                    {data?.next ? <Link href={`/article/issue/info?articleId=${data.next.articleId}`}>{t('下一篇')}：{data.next.articleTitle}</Link> : null}
                  </div>
                </article>
              ) : listData.records.length ? (
                <>
                  <div className="right-title rmwt">{currentCategory?.articleCategoryName || t('帮助分类')}</div>
                  <div className="issue-list">
                    {listData.records.map((record) => (
                      <Link key={record.articleId} className="issue-list-item" href={`/article/issue/info?articleId=${record.articleId}`}>
                        {record.addTime ? <span className="time">{String(record.addTime).slice(0, 10)}</span> : null}
                        {record.articleTitle}
                      </Link>
                    ))}
                  </div>
                  {pageCount > 1 ? (
                    <div className="issue-pagination">
                      {page > 1 ? <Link href={listHref(page - 1)}>{t('上一页')}</Link> : <span className="is-disabled">{t('上一页')}</span>}
                      <span>{page} / {pageCount}</span>
                      {page < pageCount ? <Link href={listHref(page + 1)}>{t('下一页')}</Link> : <span className="is-disabled">{t('下一页')}</span>}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="issue-empty">
                  <b>{t('文章不存在')}</b>
                  <div style={{ marginTop: 12 }}>
                    <Link href="/article/issue">{t('返回帮助中心 →')}</Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <PcFooter />
    </>
  );
}

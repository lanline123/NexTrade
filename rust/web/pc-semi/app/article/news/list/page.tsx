import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getArticleNewsDetail, getArticleNewsList, getPcHeader } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '资讯中心 · 万物新生' };

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function ArticleNewsPage({ searchParams }: PageProps) {
  const articleId = Number(readParam(searchParams?.articleId)) || 0;
  const categorySn = readParam(searchParams?.categoryId) || readParam(searchParams?.categorySn) || 'zxzx';
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const size = 20;
  const header = await getPcHeader().catch(() => null);

  if (articleId) {
    const data = await getArticleNewsDetail(articleId).catch(() => null);
    const item = data?.item || {};
    return (
      <div className="article-page">
        <PcHeader config={header as any} />
        <main className="article-main">
          <div className="article-container article-layout">
            <article className="article-detail">
              <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><Link href="/article/news/list">资讯中心</Link><span>/</span><span>{item.articleTitle || '文章'}</span></nav>
              <h1>{item.articleTitle}</h1>
              <div className="article-meta">时间：{item.addTime || ''}</div>
              {item.articleThumb ? <img className="article-cover" src={item.articleThumb} alt={item.articleTitle || ''} /> : null}
              <div className="article-content" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
              {/* 源码 article/news/Info.vue：相关链接 */}
              {Array.isArray((item as any).relatedLinks) && (item as any).relatedLinks.length ? (
                <div className="article-related">
                  <h3>相关链接</h3>
                  {(item as any).relatedLinks.map((link: any, index: number) => (
                    <a key={index} href={String(link.url || '#')} target="_blank" rel="noreferrer">
                      {link.title || link.url}
                    </a>
                  ))}
                </div>
              ) : null}
              <div className="article-nav">
                {data?.prev ? <Link href={`/article/news/list?articleId=${data.prev.articleId}`}>« 上一篇：{data.prev.articleTitle}</Link> : <span />}
                {data?.next ? <Link href={`/article/news/list?articleId=${data.next.articleId}`}>下一篇：{data.next.articleTitle} »</Link> : <span />}
              </div>
            </article>
          </div>
        </main>
        <PcFooter />
      </div>
    );
  }

  const data = await getArticleNewsList({ page, size, categorySn }).catch(() => ({ records: [], total: 0 }));
  const pages = Math.max(1, Math.ceil(data.total / size));
  return (
    <div className="article-page">
      <PcHeader config={header as any} />
      <main className="article-main">
        <div className="article-container article-layout">
          <section className="article-list">
            <nav className="pc-breadcrumb"><Link href="/">首页</Link><span>/</span><span>资讯中心</span></nav>
            {data.records.map((item) => (
              <article className="article-row" key={item.articleId}>
                {item.articleThumb ? <Link href={`/article/news/list?articleId=${item.articleId}`}><img src={item.articleThumb} alt={item.articleTitle || ''} /></Link> : null}
                <div className="article-row__body">
                  {item.articleTag ? <span className="article-tag">{item.articleTag}</span> : null}
                  <h2><Link href={`/article/news/list?articleId=${item.articleId}`}>{item.articleTitle}</Link></h2>
                  <p>{item.description}</p>
                  <div className="article-row__meta">{item.addTime || ''}</div>
                </div>
              </article>
            ))}
            {!data.records.length ? <div className="article-empty">没有内容</div> : null}
            {pages > 1 ? (
              <nav className="article-pagination">
                {page > 1 ? <Link href={`/article/news/list?categoryId=${categorySn}&page=${page - 1}`}>上一页</Link> : <span className="is-disabled">上一页</span>}
                <span>{page} / {pages}</span>
                {page < pages ? <Link href={`/article/news/list?categoryId=${categorySn}&page=${page + 1}`}>下一页</Link> : <span className="is-disabled">下一页</span>}
              </nav>
            ) : null}
          </section>
          <aside className="article-side">
            <h3>文章分类</h3>
            <Link href="/article/issue">- 帮助中心</Link>
            <Link href="/article/news/list?categoryId=zxzx">- 资讯中心</Link>
            <Link href="/article/news/list?categoryId=bzgg">- 本站公告</Link>
            <Link href="/article/news/list?categoryId=kfzx">- 客服中心</Link>
          </aside>
        </div>
      </main>
      <PcFooter />
    </div>
  );
}

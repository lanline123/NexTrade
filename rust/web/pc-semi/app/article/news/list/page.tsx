import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { getArticleNewsDetail, getProductDetail, getArticleNewsList, getPcHeader } from '@/lib/api';
import ArticleSideNav from '@/components/ArticleSideNav';
import type { SideNavArticle } from '@/components/ArticleSideNav';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: '资讯中心 · 万物新生' };

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

/**
 * 源码 article/news/List.vue：右侧「文章分类」四栏导航 + left_more 更多链接。
 * 原版 left_more 是点击展开子文章列表的交互控件；SSR 页面不能挂客户端 hook，
 * 这里改为静态展开的文章列表（min-list）+ 指向分类页的 left_more 更多链接兜底。
 */
export default async function ArticleNewsPage({ searchParams }: PageProps) {
    const t = getServerT();
  const articleId = Number(readParam(searchParams?.articleId)) || 0;
  const categorySn = readParam(searchParams?.categoryId) || readParam(searchParams?.categorySn) || 'zxzx';
  const page = Math.max(1, Number(readParam(searchParams?.page)) || 1);
  const size = 20;
  const header = await getPcHeader().catch(() => null);
  /** 源码 news/List.vue：侧栏四栏各自的文章列表（zxzx / bzgg / kfzx） */
  const [zxzxNav, bzggNav, kfzxNav] = await Promise.all([
    getArticleNewsList({ page: 1, size: 10, categorySn: 'zxzx' }).catch(() => ({ records: [], total: 0 })),
    getArticleNewsList({ page: 1, size: 10, categorySn: 'bzgg' }).catch(() => ({ records: [], total: 0 })),
    getArticleNewsList({ page: 1, size: 10, categorySn: 'kfzx' }).catch(() => ({ records: [], total: 0 })),
  ]);
  const toNav = (data: { records: Array<{ articleId: number; articleTitle?: string }> }): SideNavArticle[] =>
    data.records.map((item) => ({ articleId: item.articleId, articleTitle: item.articleTitle }));
  const navLists: Record<string, SideNavArticle[]> = {
    bzzx: [],
    zxzx: toNav(zxzxNav),
    bzgg: toNav(bzggNav),
    kfzx: toNav(kfzxNav),
  };

  if (articleId) {
    const data = await getArticleNewsDetail(articleId).catch(() => null);
    const item = data?.item || {};
    // 旧版 article/src/productItem.vue：文章关联商品（item.productIds），后端暂未下发该字段时降级为不展示
    const rawProductIds = (item as any).productIds;
    const productIds: number[] = (Array.isArray(rawProductIds) ? rawProductIds : String(rawProductIds || '').split(','))
      .map((value: any) => Number(value))
      .filter((value: number) => Number.isFinite(value) && value > 0)
      .slice(0, 5);
    const relatedProducts = productIds.length
      ? (await Promise.all(productIds.map((pid) => getProductDetail(pid).catch(() => null)))).filter(Boolean)
      : [];
    return (
      <div className="article-page">
        <PcHeader config={header as any} />
        <main className="article-main">
          <div className="article-container article-layout">
            <article className="article-detail">
              <nav className="pc-breadcrumb"><Link href="/">{t('首页')}</Link><span>/</span><Link href="/article/news/list">{t('资讯中心')}</Link><span>/</span><span>{item.articleTitle || t('文章')}</span></nav>
              <h1>{item.articleTitle}</h1>
              <div className="article-meta">时间：{item.addTime || ''}</div>
              {item.articleThumb ? <img className="article-cover" src={item.articleThumb} alt={item.articleTitle || ''} /> : null}
              <div className="article-content" dangerouslySetInnerHTML={{ __html: item.content || '' }} />
              {/* 源码 article/news/Info.vue：相关链接 */}
              {Array.isArray((item as any).relatedLinks) && (item as any).relatedLinks.length ? (
                <div className="article-related">
                  <h3>{t('相关链接')}</h3>
                  {(item as any).relatedLinks.map((link: any, index: number) => (
                    <a key={index} href={String(link.url || '#')} target="_blank" rel="noreferrer">
                      {link.title || link.url}
                    </a>
                  ))}
                </div>
              ) : null}
              {relatedProducts.length ? (
                <div className="article-related">
                  <h3>{t('相关商品')}</h3>
                  <div className="article-products">
                    {relatedProducts.map((product: any) => {
                      const row = (product as any)?.item || {};
                      return (
                        <Link key={row.productId} className="article-product" href={`/product/${row.productId}`}>
                          <img src={row.picThumb || row.picUrl || ''} alt={row.productName || ''} />
                          <span>{row.productName || ''}</span>
                          <b>¥ {Number(row.productPrice || 0).toFixed(2)}</b>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ) : null}
              <div className="article-nav">
                {data?.prev ? <Link href={`/article/news/list?articleId=${data.prev.articleId}`}>« 上一篇：{data.prev.articleTitle}</Link> : <span />}
                {data?.next ? <Link href={`/article/news/list?articleId=${data.next.articleId}`}>下一篇：{data.next.articleTitle} »</Link> : <span />}
              </div>
            </article>
            <ArticleSideNav navLists={navLists} />
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
            <nav className="pc-breadcrumb"><Link href="/">{t('首页')}</Link><span>/</span><span>{t('资讯中心')}</span></nav>
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
            {!data.records.length ? <div className="article-empty">{t('没有内容')}</div> : null}
            {pages > 1 ? (
              <nav className="article-pagination">
                {page > 1 ? <Link href={`/article/news/list?categoryId=${categorySn}&page=${page - 1}`}>{t('上一页')}</Link> : <span className="is-disabled">{t('上一页')}</span>}
                <span>{page} / {pages}</span>
                {page < pages ? <Link href={`/article/news/list?categoryId=${categorySn}&page=${page + 1}`}>{t('下一页')}</Link> : <span className="is-disabled">{t('下一页')}</span>}
              </nav>
            ) : null}
          </section>
          <ArticleSideNav navLists={navLists} />
        </div>
      </main>
      <PcFooter />
    </div>
  );
}

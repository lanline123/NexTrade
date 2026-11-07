import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import ArticleIssueClient from '@/components/ArticleIssueClient';
import { getArticleNewsList, getFooterData, getIntegralName, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '帮助中心 · 万物新生' };

export default async function ArticleIssuePage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
    const t = getServerT();
  const raw = searchParams?.categoryId;
  const categoryId = Array.isArray(raw) ? raw[0] || '' : raw || '';
  /**
   * 源码 article/issue/Index.vue：新手指南 / 自助服务(zzfw-menu) / 热门问题(rmwt-menu)。
   * 热门问题原版取 categorySn=rmwt 的文章；接口无该分类时，用底部帮助分类下的文章兜底。
   * zzfwList 里的积分名称跟随 getIntegralName（原版 commonStore.integralName）。
   */
  const [header, footer, integralName, hotData] = await Promise.all([
    getPcHeader().catch(() => null),
    getFooterData(),
    getIntegralName().catch(() => '积分'),
    getArticleNewsList({ page: 1, size: 8, categorySn: 'rmwt' }).catch(() => ({ records: [], total: 0 })),
  ]);
  const categories = categoryId
    ? footer.helpCategories.filter((item) => item.categorySn === categoryId || String(item.articleCategoryId) === categoryId)
    : footer.helpCategories;
  const guideCategories = footer.helpCategories.slice(0, 5);
  const hotArticles: Array<{ articleId: number; articleTitle?: string }> = hotData.records.length
    ? hotData.records.map((item) => ({ articleId: item.articleId, articleTitle: item.articleTitle }))
    : (footer.helpCategories.flatMap((category) => (Array.isArray(category.articles) ? category.articles : [])) as any[])
        .slice(0, 8)
        .map((article: any) => ({ articleId: article.articleId, articleTitle: article.articleTitle }));
  const zzfwList = [
    { title: '发货物流', subTitle: '查看订单物流信息', url: '/member/order/list', ico: 'selfS_ones' },
    { title: '退货/退款', subTitle: '申请退货/退款', url: '/member/return/list', ico: 'selfS_twos' },
    { title: '售后进度', subTitle: '查看售后处理进度', url: '/member/return/log', ico: 'selfS_threes' },
    { title: '手机号修改', subTitle: '修改绑定的手机号', url: '/member/security/info', ico: 'selfS_fours' },
    { title: '订单评价', subTitle: '查看订单详情、确认收货、评价订单等', url: '/member/comment/list', ico: 'selfS_fives' },
    { title: '密码修改', subTitle: '修改账户密码', url: '/member/security/info', ico: 'selfS_sixs' },
    { title: t('{name}查询', { name: integralName }), subTitle: t('查看账户{name}、使用明细等', { name: integralName }), url: '/member/point/list', ico: 'selfS_sevens' },
    { title: '优惠券查询', subTitle: '查看未使用、已使用、已过期的优惠券信息等', url: '/member/coupon/list', ico: 'selfS_eights' },
  ];

  return (
    <>
      <PcHeader config={header as any} />
      <main className="pc-static-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">{t('首页')}</Link><span>/</span><span>{t('帮助中心')}</span></nav>
          <h1 className="pc-cart-title">{categoryId ? t('帮助分类') : '帮助中心'}</h1>
          {/* 源码 article/issue/Index.vue：新手指南 / 自助服务 / 热门问题 多板块 */}
          <div className="issue-sections" style={{ background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 20, marginBottom: 16 }}>
            <div className="right-title" style={{ fontSize: 18, fontWeight: 700, color: '#333' }}>{t('新手指南')}</div>
            <div className="issue_main_bg" style={{ display: 'flex', flexWrap: 'wrap', gap: 16, margin: '16px 0 24px' }}>
              {guideCategories.map((item, index) => (
                <Link
                  key={index}
                  href={`/article/issue?categoryId=${encodeURIComponent(String(item.categorySn ?? item.articleCategoryId ?? ''))}`}
                  className="xszn-div"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                    width: 80, height: 80, borderRadius: '50%', boxShadow: '0 0 10px rgba(0,0,0,.1)',
                    color: '#333', fontSize: 16, fontWeight: 700, textDecoration: 'none',
                  }}
                >
                  <span className="text" style={{ width: 40 }}>{item.articleCategoryName}</span>
                </Link>
              ))}
            </div>
            <div className="help_division" style={{ borderTop: '1px dashed #e5e5e5' }} />
            <div className="right-title zzfw" style={{ fontSize: 18, fontWeight: 700, color: '#333', marginTop: 16 }}>{t('自助服务')}</div>
            <div className="zzfw-menu" style={{ display: 'flex', flexWrap: 'wrap', marginTop: 16 }}>
              {zzfwList.map((item) => (
                <Link
                  key={item.title}
                  href={item.url}
                  className="zzfw-menu-item"
                  style={{ flex: '0 0 25%', display: 'flex', gap: 10, alignItems: 'center', padding: 10, boxSizing: 'border-box', minHeight: 100, textDecoration: 'none' }}
                >
                  <div className={`left_info ${item.ico}`} style={{ minWidth: 65, minHeight: 65, background: '#f3f6f8', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#888' }}>
                    {item.ico.replace('selfS_', '')}
                  </div>
                  <div className="right-info">
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, lineHeight: 2 }}>
                      <li className="big" style={{ color: '#333' }}>{t(item.title)}</li>
                      <li className="min" style={{ color: '#a8a8a8', fontSize: 12 }}>{t(item.subTitle)}</li>
                    </ul>
                  </div>
                </Link>
              ))}
            </div>
            <div className="help_division" style={{ borderTop: '1px dashed #e5e5e5' }} />
            {hotArticles.length ? (
              <>
                <div className="right-title rmwt" style={{ fontSize: 18, fontWeight: 700, color: '#333', marginTop: 16 }}>{t('热门问题')}</div>
                <div className="rmwt-menu" style={{ display: 'flex', flexWrap: 'wrap' }}>
                  {hotArticles.map((article, index) => (
                    <div key={`${article.articleId}-${index}`} className="rmwt-menu-item" style={{ flex: '0 0 50%', display: 'flex', gap: 10, alignItems: 'center', padding: 10, height: 50, boxSizing: 'border-box' }}>
                      <span className="help_hot_index" style={{ background: '#f3f6f8', borderRadius: 3, color: '#888', display: 'inline-block', fontSize: 12, height: 14, lineHeight: '13px', textAlign: 'center', width: 19 }}>{index + 1}</span>
                      <Link href={`/article/issue/info?articleId=${article.articleId}`} className="help_hot_text" style={{ fontSize: 14, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none' }}>{article.articleTitle}</Link>
                    </div>
                  ))}
                </div>
              </>
            ) : null}
          </div>
          <ArticleIssueClient categories={categories as any} currentCategoryId={categoryId} />
        </div>
      </main>
      <PcFooter />
    </>
  );
}

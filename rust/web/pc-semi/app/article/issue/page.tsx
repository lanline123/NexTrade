import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import ArticleIssueClient from '@/components/ArticleIssueClient';
import HelpCategoryMenu from '@/components/HelpCategoryMenu';
import type { HelpCategory } from '@/components/HelpCategoryMenu';
import SelfServiceIcon from '@/components/SelfServiceIcon';
import type { SelfServiceIconName } from '@/components/SelfServiceIcon';
import { getArticleNewsList, getFooterData, getIntegralName, getPcHeader } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '帮助中心 · 万物新生' };

export default async function ArticleIssuePage({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const t = getServerT();
  const raw = searchParams?.categoryId;
  const categoryId = Array.isArray(raw) ? raw[0] || '' : raw || '';
  /**
   * 源码 article/issue/Index.vue：自助服务(zzfw-menu) / 热门问题(rmwt-menu) / 帮助分类(bzfl)。
   * 旧版「新手指南」整段在模板里被注释掉（Index.vue:23-30），新版同样不渲染。
   * 热门问题原版取 categorySn=rmwt 的文章；接口无该分类时，用底部帮助分类下的文章兜底。
   * zzfwList 里的积分名称跟随 getIntegralName（原版 commonStore.integralName）。
   */
  const [header, footer, integralName, hotData] = await Promise.all([
    getPcHeader().catch(() => null),
    getFooterData(),
    getIntegralName().catch(() => '积分'),
    getArticleNewsList({ page: 1, size: 8, categorySn: 'rmwt' }).catch(() => ({ records: [], total: 0 })),
  ]);
  const allCategories = footer.helpCategories as unknown as HelpCategory[];
  const categories = categoryId
    ? allCategories.filter((item) => item.categorySn === categoryId || String(item.articleCategoryId) === categoryId)
    : allCategories;
  const hotArticles: Array<{ articleId: number; articleTitle?: string }> = hotData.records.length
    ? hotData.records.map((item) => ({ articleId: item.articleId, articleTitle: item.articleTitle }))
    : (allCategories.flatMap((category) => (Array.isArray(category.articles) ? category.articles : [])) as any[])
        .slice(0, 8)
        .map((article: any) => ({ articleId: article.articleId, articleTitle: article.articleTitle }));
  /**
   * 旧版 65×65 图标块用的是 selfS_*.png 背景图（Index.vue:264-294）；仓库内无这些切图，
   * 改用项目已有的 @icon-park/react 线性图标（见 SelfServiceIcon）。
   * 文案/链接/顺序与旧版 zzfwList（Index.vue:99-110）逐条对应。
   */
  const zzfwList: Array<{ title: string; subTitle: string; url: string; icon: SelfServiceIconName }> = [
    { title: '发货物流', subTitle: '查看订单物流信息', url: '/member/order/list', icon: 'logistics' },
    { title: '退货/退款', subTitle: '申请退货/退款', url: '/member/return/list', icon: 'refund' },
    { title: '售后进度', subTitle: '查看售后处理进度', url: '/member/return/log', icon: 'after-sale' },
    { title: '手机号修改', subTitle: '修改绑定的手机号', url: '/member/security/info', icon: 'phone' },
    { title: '订单评价', subTitle: '查看订单详情、确认收货、评价订单等', url: '/member/comment/list', icon: 'comment' },
    { title: '密码修改', subTitle: '修改账户密码', url: '/member/security/info', icon: 'password' },
    { title: t('{name}查询', { name: integralName }), subTitle: t('查看账户{name}、使用明细等', { name: integralName }), url: '/member/point/list', icon: 'point' },
    { title: '优惠券查询', subTitle: '查看未使用、已使用、已过期的优惠券信息等', url: '/member/coupon/list', icon: 'coupon' },
  ];

  return (
    <>
      <PcHeader config={header as any} />
      <main className="issue-page">
        <div className="pc-container">
          <nav className="pc-breadcrumb"><Link href="/">{t('首页')}</Link><span>/</span><span>{t('帮助中心')}</span></nav>
          <div className="issue-content">
            <aside className="issue-col-left">
              <HelpCategoryMenu categories={allCategories} activeKey={categoryId} title={t('帮助分类')} />
            </aside>

            <div className="issue-col-right">
              <div className="right-title zzfw">{t('自助服务')}</div>
              <div className="zzfw-menu">
                {zzfwList.map((item) => (
                  <Link key={item.title} href={item.url} className="zzfw-menu-item" target="_blank">
                    <SelfServiceIcon name={item.icon} />
                    <div className="right-info">
                      <ul>
                        <li className="big">{item.title}</li>
                        <li className="min">{item.subTitle}</li>
                      </ul>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="help_division" />

              {hotArticles.length ? (
                <>
                  <div className="right-title rmwt">{t('热门问题')}</div>
                  <div className="rmwt-menu">
                    {hotArticles.map((article, index) => (
                      <div key={`${article.articleId}-${index}`} className="rmwt-menu-item">
                        <span className="help_hot_index">{index + 1}</span>
                        <Link className="help_hot_text" href={`/article/issue/info?articleId=${article.articleId}`}>
                          {article.articleTitle}
                        </Link>
                      </div>
                    ))}
                  </div>
                  <div className="help_division" />
                </>
              ) : null}

              <div className="right-title rmwt">{t('帮助分类')}</div>
              <ArticleIssueClient categories={categories} currentCategoryId={categoryId} />
            </div>
          </div>
        </div>
      </main>
      <PcFooter />
    </>
  );
}

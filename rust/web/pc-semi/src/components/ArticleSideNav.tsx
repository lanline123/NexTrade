'use client';

/**
 * 资讯中心左侧「文章分类」侧栏（列表页与文章详情页共用）。
 *
 * 源码：java-b2b2c-overseas-v5.8.61/view/pc/pages/article/news/List.vue:21-82
 *   四个分类：帮助中心 / 资讯中心 / 本站公告 / 客服中心；
 *   除「帮助中心」外，每一项右侧有 .left_more 按钮，点一下展开该分类下的文章（.min-list），
 *   展开时按钮换成 .left_ma（箭头翻转）。原生版三个开关的默认值都是 false（收起）。
 *   文章链接：客服中心走 /article/issue/info?articleId=…，其余走 /article/news/list?articleId=…
 *
 * 服务端组件拿不到点击状态，所以这部分必须是客户端组件；
 * 版式全部走 app/article-side.scss 里的旧类名，没有内联样式。
 */
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export type SideNavArticle = { articleId: number; articleTitle?: string };

type NavKey = 'bzzx' | 'zxzx' | 'bzgg' | 'kfzx';

const NAV_ITEMS: Array<{ key: NavKey; label: string; href: string; toggle: boolean; infoPath: string }> = [
  { key: 'bzzx', label: '帮助中心', href: '/article/issue', toggle: false, infoPath: '/article/issue/info' },
  { key: 'zxzx', label: '资讯中心', href: '/article/news/list?categoryId=zxzx', toggle: true, infoPath: '/article/news/list' },
  { key: 'bzgg', label: '本站公告', href: '/article/news/list?categoryId=bzgg', toggle: true, infoPath: '/article/news/list' },
  { key: 'kfzx', label: '客服中心', href: '/article/news/list?categoryId=kfzx', toggle: true, infoPath: '/article/issue/info' },
];

export default function ArticleSideNav({ navLists }: { navLists: Record<string, SideNavArticle[]> }) {
  const { t } = useTranslation();
  // 旧版三个开关默认 false（收起）
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <aside className="article-side">
      <div className="title">{t('文章分类')}</div>
      <ul>
        {NAV_ITEMS.map((item) => {
          const list = navLists[item.key] || [];
          const expanded = Boolean(open[item.key]);
          return (
            <li key={item.key}>
              <div className="min-title">
                <Link href={item.href}>
                  <div className="orange">- {t(item.label)}</div>
                </Link>
                {item.toggle ? (
                  <button
                    type="button"
                    className={`left_more${expanded ? ' left_ma' : ''}`}
                    aria-expanded={expanded}
                    aria-label={expanded ? t('收起{name}的文章', { name: t(item.label) }) : t('展开{name}的文章', { name: t(item.label) })}
                    onClick={() => setOpen((prev) => ({ ...prev, [item.key]: !prev[item.key] }))}
                  />
                ) : null}
              </div>
              {item.toggle && expanded ? (
                <div className="min-list">
                  <ul>
                    {list.length ? (
                      list.map((article) => (
                        <li key={article.articleId}>
                          <Link href={`${item.infoPath}?articleId=${article.articleId}`}>
                            <div className="orange">{article.articleTitle}</div>
                          </Link>
                        </li>
                      ))
                    ) : (
                      <li>
                        <div className="orange">{t('该分类暂无文章')}</div>
                      </li>
                    )}
                  </ul>
                </div>
              ) : null}
            </li>
          );
        })}
      </ul>
    </aside>
  );
}

'use client';

/**
 * 帮助中心交互
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/article/issue/Index.vue
 * - 左侧分类菜单（IssueLeftMenu）
 * - 帮助分类 Tab 切换（bzfl-menu）+ 分类下文章列表（bzfl-list）
 * - 热门问题（rmwt-menu）
 */
import { useState } from 'react';
import Link from 'next/link';

import { useTranslation } from 'react-i18next';
interface Article {
  articleId?: number;
  articleTitle?: string;
  [key: string]: unknown;
}
interface Category {
  articleCategoryId?: number;
  articleCategoryName?: string;
  categorySn?: string;
  articles?: Article[];
  [key: string]: unknown;
}

export default function ArticleIssueClient({
  categories,
  currentCategoryId,
}: {
  categories: Category[];
  currentCategoryId: string;
}) {
    const { t } = useTranslation();
  const initial = categories.find((item) => item.categorySn === currentCategoryId || String(item.articleCategoryId) === currentCategoryId)
    || categories[0];
  const [activeSn, setActiveSn] = useState(String(initial?.categorySn ?? initial?.articleCategoryId ?? ''));

  const active = categories.find((item) => String(item.categorySn ?? item.articleCategoryId ?? '') === activeSn) || initial;
  const articles = (active?.articles || []) as Article[];
  const hot = categories.flatMap((item) => (item.articles || []) as Article[]).slice(0, 8);

  return (
    <div className="pc-article-issue">
      <aside className="pc-article-issue__side">
        <b>{t('帮助分类')}</b>
        {categories.map((item) => {
          const key = String(item.categorySn ?? item.articleCategoryId ?? '');
          return (
            <button
              key={key}
              type="button"
              className={activeSn === key ? 'is-active' : ''}
              onClick={() => setActiveSn(key)}
            >
              {item.articleCategoryName}
            </button>
          );
        })}
      </aside>

      <div className="pc-article-issue__main">
        <div className="pc-article-issue__tabs">
          {categories.map((item) => {
            const key = String(item.categorySn ?? item.articleCategoryId ?? '');
            return (
              <button
                key={key}
                type="button"
                className={activeSn === key ? 'is-active' : ''}
                onClick={() => setActiveSn(key)}
              >
                {item.articleCategoryName}
              </button>
            );
          })}
        </div>

        <div className="pc-article-issue__list">
          {articles.length ? articles.map((article) => (
            <Link key={article.articleId} href={`/article/issue/info?articleId=${article.articleId}`} target="_blank">
              {article.articleTitle}
            </Link>
          )) : <span className="pc-article-issue__empty">{t('该分类暂无文章')}</span>}
        </div>

        {hot.length ? (
          <div className="pc-article-issue__hot">
            <b>{t('热门问题')}</b>
            {hot.map((article) => (
              <Link key={`hot-${article.articleId}`} href={`/article/issue/info?articleId=${article.articleId}`} target="_blank">
                {article.articleTitle} →
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

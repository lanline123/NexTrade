'use client';

/**
 * 帮助中心「帮助分类」Tab 切换。
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/article/issue/Index.vue
 *   .bzfl-menu 分类标签（旧版 @mouseover="checkTab(item)"）
 *   .bzfl-list 当前分类下的文章
 * 左侧分类菜单已由服务端组件 HelpCategoryMenu 渲染，此处只管 tab + 列表。
 */
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

import type { HelpArticle, HelpCategory } from './HelpCategoryMenu';
import { categoryKey } from './HelpCategoryMenu';

export default function ArticleIssueClient({
  categories,
  currentCategoryId,
}: {
  categories: HelpCategory[];
  currentCategoryId: string;
}) {
  const { t } = useTranslation();
  const initial =
    categories.find((item) => item.categorySn === currentCategoryId || String(item.articleCategoryId) === currentCategoryId) ||
    categories[0];
  const [activeKey, setActiveKey] = useState(categoryKey(initial ?? {}));

  const active = categories.find((item) => categoryKey(item) === activeKey) ?? initial;
  const articles = (Array.isArray(active?.articles) ? active?.articles : []) as HelpArticle[];

  if (!categories.length) return null;

  return (
    <div className="bzfl">
      <div className="bzfl-menu" role="tablist">
        {categories.map((category) => {
          const key = categoryKey(category);
          const checked = key === activeKey;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={checked}
              className={`bzfl-menu-item${checked ? ' check-tab' : ''}`}
              onMouseEnter={() => setActiveKey(key)}
              onFocus={() => setActiveKey(key)}
              onClick={() => setActiveKey(key)}
            >
              {category.articleCategoryName}
            </button>
          );
        })}
      </div>

      <div className="bzfl-list">
        {articles.length ? (
          articles.map((article) => (
            <Link
              key={String(article.articleId)}
              className="bzfl-list-item"
              href={`/article/issue/info?articleId=${article.articleId}`}
              target="_blank"
            >
              {article.articleTitle}
            </Link>
          ))
        ) : (
          <span className="bzfl-empty">{t('该分类暂无文章')}</span>
        )}
      </div>
    </div>
  );
}

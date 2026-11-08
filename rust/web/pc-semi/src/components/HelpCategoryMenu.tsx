'use client';

/**
 * 帮助中心左侧分类菜单。
 *
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/article/issue/src/IssueLeftMenu.vue
 *   .menu-list 白色圆角卡片（padding 8px 24px、圆角 8、gap 20）
 *   CustomCollapse accordion → 同一时间只展开一个分类；标题 18px/600，右侧 16×16 箭头，
 *   展开后箭头 rotate(180deg)；分类下文章 .min-menu（padding-left 40，行高 55），
 *   当前文章加 .pitch-on 变成主题色；分类没有文章时标题置灰不可点。
 *   带 ?articleId= 进来时自动展开该文章所在分类，并高亮这篇文章；带 ?categoryId= 时展开该分类。
 *
 * 与旧版的唯一差别（有意为之）：旧版标题整行都是展开开关，分类列表页只能从别处进；
 * 这里标题文字仍是链接（进该分类的文章列表），右侧箭头是展开开关，两个功能都保留。
 */
import { useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';

export interface HelpArticle {
  articleId?: number;
  articleTitle?: string;
  [key: string]: unknown;
}

export interface HelpCategory {
  articleCategoryId?: number;
  articleCategoryName?: string;
  categorySn?: string;
  articles?: HelpArticle[];
  [key: string]: unknown;
}

export function categoryKey(category: HelpCategory): string {
  return String(category.categorySn ?? category.articleCategoryId ?? '');
}

function articlesOf(category: HelpCategory): HelpArticle[] {
  return Array.isArray(category.articles) ? category.articles : [];
}

export default function HelpCategoryMenu({
  categories,
  activeKey,
  activeArticleId,
  title,
}: {
  categories: HelpCategory[];
  /** 当前分类（?categoryId= 或由 articleId 反查出来的 categorySn / id） */
  activeKey?: string;
  /** 当前文章 id，用于高亮 .pitch-on 并自动展开所在分类 */
  activeArticleId?: number | string;
  /** 无障碍名称（旧版卡片里没有可见标题，所以只作 aria-label） */
  title: string;
}) {
  const { t } = useTranslation();
  const articleId = Number(activeArticleId) || 0;

  const initial = (() => {
    const byKey = activeKey ? categories.find((item) => categoryKey(item) === String(activeKey)) : undefined;
    if (byKey) return byKey;
    if (articleId) {
      return categories.find((item) => articlesOf(item).some((article) => Number(article.articleId) === articleId));
    }
    return undefined;
  })();
  const [openKey, setOpenKey] = useState<string | null>(initial ? categoryKey(initial) : null);

  if (!categories.length) return null;

  return (
    <nav className="menu-list" aria-label={title}>
      <div className="menu">
        {categories.map((category) => {
          const key = categoryKey(category);
          const articles = articlesOf(category);
          const disabled = articles.length === 0;
          const isOpen = openKey === key;
          return (
            <div key={key} className={`cc-collapse-item${isOpen ? ' is-open' : ''}${disabled ? ' is-disabled' : ''}`}>
              <div className="cc-collapse-item__title">
                <Link
                  className="cc-collapse-item__text"
                  href={`/article/issue/info?categoryId=${encodeURIComponent(key)}`}
                >
                  {category.articleCategoryName}
                </Link>
                <button
                  type="button"
                  className="cc-collapse-item__toggle"
                  aria-expanded={isOpen}
                  aria-label={
                    isOpen
                      ? t('收起{name}的文章', { name: category.articleCategoryName || '' })
                      : t('展开{name}的文章', { name: category.articleCategoryName || '' })
                  }
                  disabled={disabled}
                  onClick={() => setOpenKey((prev) => (prev === key ? null : key))}
                >
                  <svg
                    className={`collapse-icon${isOpen ? ' is-active' : ''}`}
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="1.5"
                      d="M11.5 6.25 8 9.75l-3.5-3.5"
                    />
                  </svg>
                </button>
              </div>
              {isOpen ? (
                <div className="min-menu">
                  {articles.map((article) => (
                    <Link
                      key={String(article.articleId)}
                      className={`item-menu${articleId && Number(article.articleId) === articleId ? ' pitch-on' : ''}`}
                      href={`/article/issue/info?articleId=${article.articleId}`}
                    >
                      {article.articleTitle}
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

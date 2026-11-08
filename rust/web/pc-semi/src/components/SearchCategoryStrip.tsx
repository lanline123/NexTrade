'use client';

/**
 * 搜索页顶部一级分类横条 —— 结构照抄旧版 `pages/search/components/Filter.vue`。
 *
 * 旧版模板（Filter.vue 第 1-30 行）：
 *   .filter-container.filter-container--top
 *     > .filter-top > .filter-top-body > .list > .attr-box
 *         > .filter-category__arrow.filter-category__arrow--left（可左滚时才出现）
 *             > .filter-category__arrow-btn > .tig-icon.filter-category__arrow-icon.filter-category__arrow-icon--flip
 *         > .category-link-wrapper > .category-link
 *             > a > .item[.active] > span.category-name      （有图时才多一个 img.category-pic）
 *         > .filter-category__arrow.filter-category__arrow--right（可右滚时才出现）
 *             > .filter-category__arrow-btn > .tig-icon.filter-category__arrow-icon
 *
 * 旧版两个箭头是 JS scrollBy 左右滚动，所以这里保持客户端组件、同样的行为；
 * 只渲染箭头本身用到的类名，不新增任何类。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';

export interface CategoryStripItem {
  key: string;
  label: string;
  href: string;
  active?: boolean;
}

interface SearchCategoryStripProps {
  items: CategoryStripItem[];
}

export default function SearchCategoryStrip({ items }: SearchCategoryStripProps) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 1);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    measure();
    const el = wrapRef.current;
    if (!el) return undefined;
    el.addEventListener('scroll', measure, { passive: true });
    const onResize = () => measure();
    window.addEventListener('resize', onResize);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', onResize);
    };
  }, [measure, items.length]);

  const scrollByStep = (direction: number) => {
    const el = wrapRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(240, el.clientWidth * 0.6), behavior: 'smooth' });
  };

  return (
    <>
      {canLeft ? (
        <div
          className="filter-category__arrow filter-category__arrow--left"
          onClick={() => scrollByStep(-1)}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') scrollByStep(-1);
          }}
        >
          <span className="filter-category__arrow-btn">
            <span className="tig-icon filter-category__arrow-icon filter-category__arrow-icon--flip" />
          </span>
        </div>
      ) : null}

      <div className="category-link-wrapper" ref={wrapRef}>
        <div className="category-link">
          {items.map((item) => (
            <Link key={item.key} href={item.href}>
              <div className={`item${item.active ? ' active' : ''}`}>
                <span className="category-name">{item.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {canRight ? (
        <div
          className="filter-category__arrow filter-category__arrow--right"
          onClick={() => scrollByStep(1)}
          role="button"
          tabIndex={0}          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') scrollByStep(1);
          }}
        >
          <span className="filter-category__arrow-btn">
            <span className="tig-icon filter-category__arrow-icon" />
          </span>
        </div>
      ) : null}
    </>
  );
}

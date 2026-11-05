'use client';

/**
 * 店铺分类菜单
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/shop/src/ShopCategoryMenu.vue
 * - 顶部「全部商品」
 * - 一级分类可展开/收起子分类
 * - 当前选中分类（含子分类命中父级高亮）突出显示
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';

export interface ShopCategory {
  categoryId?: number | string;
  categoryName?: string;
  children?: ShopCategory[];
  [key: string]: unknown;
}

export default function ShopCategoryMenu({
  shopId,
  categories,
  currentCategoryId,
}: {
  shopId: number | string;
  categories: ShopCategory[];
  currentCategoryId?: string;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const current = String(currentCategoryId || '');

  /** 源码 initMenu：默认展开命中的父级分类 */
  useEffect(() => {
    if (!current) return;
    const next: Record<string, boolean> = {};
    categories.forEach((category) => {
      const key = String(category.categoryId ?? '');
      const hit = String(category.categoryId ?? '') === current
        || (category.children || []).some((child) => String(child.categoryId ?? '') === current);
      if (hit) next[key] = true;
    });
    if (Object.keys(next).length) setExpanded((prev) => ({ ...prev, ...next }));
  }, [current, categories]);

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <nav className="shop-category-menu">
      <div className={`menu-item all-products${current ? '' : ' active'}`}>
        <Link href={`/shop/${shopId}`}>全部商品</Link>
      </div>

      <div className="category-list">
        {categories.map((category) => {
          const key = String(category.categoryId ?? '');
          const children = category.children || [];
          const isCurrent = key === current;
          const childActive = children.some((child) => String(child.categoryId ?? '') === current);
          const isOpen = Boolean(expanded[key]);
          return (
            <div className="category-group" key={key}>
              <div className={`menu-item parent-item${isCurrent || childActive ? ' active' : ''}`}>
                <Link href={`/shop/${shopId}?categoryId=${encodeURIComponent(key)}`}>
                  <span className="label">{category.categoryName}</span>
                </Link>
                {children.length ? (
                  <button
                    type="button"
                    className={`arrow-icon${isOpen ? ' expanded' : ''}`}
                    aria-label={isOpen ? '收起子分类' : '展开子分类'}
                    onClick={() => toggle(key)}
                  >
                    ⌄
                  </button>
                ) : null}
              </div>

              {children.length && isOpen ? (
                <div className="sub-menu">
                  {children.map((child) => {
                    const childKey = String(child.categoryId ?? '');
                    return (
                      <Link
                        key={childKey}
                        href={`/shop/${shopId}?categoryId=${encodeURIComponent(childKey)}`}
                        className={`menu-item sub-item${childKey === current ? ' active' : ''}`}
                      >
                        {child.categoryName}
                      </Link>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

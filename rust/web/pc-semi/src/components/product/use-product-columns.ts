'use client';

import { useEffect, useState, type RefObject } from 'react';

interface ProductColumnsOptions {
  /** 卡片最小宽度，原版 ProdSwiper 取 240 */
  minCardWidth?: number;
  /** 列间距，与原版一致取 16 */
  gap?: number;
  minColumns?: number;
  maxColumns?: number;
}

/**
 * 复刻原版 hooks/useResponsiveGridColumns：按容器实际宽度推导列数。
 *
 * 配合 `.product-card-grid` 使用 —— 把返回值写进 CSS 变量 `--you-like-columns`，
 * 网格模板 `repeat(var(--you-like-columns, 5), minmax(0, 1fr))` 即可跟随容器宽度
 * 在 5~6 列之间切换。
 *
 * 原版 ProdSwiper 参数：minCardWidth 240 / gap 16 / min 5 / max 6。
 * 购物车、会员中心、商品详情、搜索结果统一沿用同一口径，保证全站商品卡密度一致。
 */
export function useProductColumns(ref: RefObject<HTMLElement | null>, options: ProductColumnsOptions = {}): number {
  const { minCardWidth = 240, gap = 16, minColumns = 5, maxColumns = 6 } = options;
  const [columns, setColumns] = useState(minColumns);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const width = element.clientWidth;
      if (width <= 0) return;
      const next = Math.min(maxColumns, Math.max(minColumns, Math.floor((width + gap) / (minCardWidth + gap))));
      setColumns(next);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref, minCardWidth, gap, minColumns, maxColumns]);

  return columns;
}

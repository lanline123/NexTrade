'use client';

/**
 * 搜索结果商品网格。
 *
 * 原先这里有一套独立的 `.pc-product-grid__card` 卡片（14px 圆角、hover 上浮 6px、
 * 价格写死红色 #e5484d），与购物车 / 会员中心 / 商品详情的卡片视觉不一致。
 * 现统一走 `src/components/product/ProductCard.tsx`（对齐 Java 原版
 * components/product/ProductCard.vue），本组件只保留「网格 + 空态」职责，
 * props 签名不变，调用方 app/search/page.tsx 无需改动。
 */

import { useRef } from 'react';
import type { ProductListItem } from '@/lib/api';
import ProductCard, { type ProductCardItem } from '@/components/product/ProductCard';
import { useProductColumns } from '@/components/product/use-product-columns';
import '@/components/product/product-card.scss';

import { useTranslation } from 'react-i18next';
interface ProductGridProps {
  products: ProductListItem[];
  /** 搜索装修 showSales：true 时展示已售数量（默认展示库存）。 */
  showSales?: boolean;
  /** 搜索装修 showShopTag：为 true 且商品带店铺信息时展示店铺角标。 */
  showShopTag?: boolean;
  /**
   * 额外挂到网格根节点上的旧版类名。
   * 旧版 pages/search/components/CatGoodsList.vue 的结构是
   * .goods-list__box > .goods-list-c > .wrap，.wrap 才是网格本体
   * （grid-template-columns: repeat(var(--search-grid-columns, 5), minmax(0, 1fr))），
   * 所以搜索页把 wrap 传进来。
   */
  gridClassName?: string;
  /** 旧版 SearchProductCard.vue 的 fixed-name-two-lines：搜索页固定两行名称。 */
  fixedNameTwoLines?: boolean;
}

export default function ProductGrid({
  products,
  showSales = false,
  showShopTag = false,
  gridClassName,
  fixedNameTwoLines = false,
}: ProductGridProps) {
    const { t } = useTranslation();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const columns = useProductColumns(gridRef);

  return (
    <div
      className={`product-card-grid${gridClassName ? ` ${gridClassName}` : ''}`}
      ref={gridRef}
      style={{ '--you-like-columns': columns } as React.CSSProperties}
    >
      {products.map((product) => (
        <ProductCard
          key={product.productId}
          product={product as ProductCardItem}
          salesMode={showSales ? 'sales' : 'stock'}
          showShopTag={showShopTag}
          fixedNameTwoLines={fixedNameTwoLines}
          activityInfo={(product as ProductCardItem).activityInfo}
        />
      ))}
      {!products.length ? <div className="search-empty"><span className="search-empty__text">{t('没有找到商品')}</span></div> : null}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ShopListItem } from '@/lib/api';

import { formatPrice } from '@/lib/currency';
/**
 * 店铺街行卡片：右侧热销商品横向滚动条。
 * 源码对照：view/pc/pages/shop/src/ShopList.vue（<template> 类名逐条照抄）
 * 样式：app/shop-page.scss → .pg-shop-product-list
 *
 * .shop-product-list
 *   > .nav-btn.left-btn（无可滚动距离时加 .disabled）
 *   > .swiper-wrapper > .product-item > .product-img > a > img + .product-price > .pro_price
 *   > .nav-btn.right-btn（同上）
 *
 * 旧版用 el-image 的 #placeholder 槽位画 .image-slot.loading-slot 骨架，这里直接出图，
 * 失败时落到同一个 .image-slot 容器（类名沿用旧版，不新增）。
 */

type ListingProduct = NonNullable<ShopListItem['listingProduct']>[number];

/** 旧版 scrollLeft()/scrollRight() 的步长 */
const SCROLL_STEP = 240;

export default function ShopProductList({ products }: { products: ListingProduct[] }) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = useCallback(() => {
    const box = scrollRef.current;
    if (!box) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }
    setCanScrollLeft(box.scrollLeft > 0);
    setCanScrollRight(box.scrollLeft + box.clientWidth < box.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateScrollState();
    const onResize = () => updateScrollState();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [updateScrollState, products.length]);

  const scrollBy = (delta: number) => {
    const box = scrollRef.current;
    if (!box) return;
    box.scrollBy({ left: delta, behavior: 'smooth' });
  };

  return (
    <div className="shop-product-list">
      {products.length > 0 ? (
        <div className={`nav-btn left-btn${canScrollLeft ? '' : ' disabled'}`} onClick={() => scrollBy(-SCROLL_STEP)}>
          <i className="iconfont" aria-hidden="true">
            ‹
          </i>
        </div>
      ) : null}

      <div className="swiper-wrapper" ref={scrollRef} onScroll={updateScrollState}>
        {products.length > 0 ? (
          products.slice(0, 12).map((product) => (
            <div className="product-item" key={product.productId}>
              <div className="product-img">
                <Link href={`/product/${product.productId || ''}`} target="_blank">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={product.picThumb || product.picUrl || ''} alt={product.productName || ''} loading="lazy" />
                </Link>
              </div>
              <div className="product-price">
                <span className="pro_price">{formatPrice(product.productPrice)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="el-empty">{t('暂无商品')}</div>
        )}
      </div>

      {products.length > 0 ? (
        <div className={`nav-btn right-btn${canScrollRight ? '' : ' disabled'}`} onClick={() => scrollBy(SCROLL_STEP)}>
          <i className="iconfont" aria-hidden="true">
            ›
          </i>
        </div>
      ) : null}
    </div>
  );
}

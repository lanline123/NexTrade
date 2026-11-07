'use client';

import { useEffect, useRef } from 'react';

/**
 * 访问统计埋点（对齐旧版 view/pc components/common/StatisticLog.vue）。
 *
 * - 挂载即上报 GET /api/common/log?productId&shopId&shopCategoryId&isNew|click
 * - isNew=1：当天首次访问（localStorage.lastDate 跨天判断）；否则 click=1（老访客）
 * - 全站挂载（layout）记录页面访问；商品详情页可传 productId 记录商品曝光
 */

interface VisitLogProps {
  productId?: string | number;
  shopId?: string | number;
  shopCategoryId?: string | number;
}

function currentDate(): string {
  const date = new Date();
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function diffOverOneDay(date1: string, date2: string): boolean {
  const d1 = new Date(date1).getTime();
  const d2 = new Date(date2).getTime();
  return Math.abs(d1 - d2) >= 24 * 60 * 60 * 1000;
}

export default function VisitLogger({ productId, shopId, shopCategoryId }: VisitLogProps) {
  const loggedRef = useRef(false);

  useEffect(() => {
    if (loggedRef.current) return;
    loggedRef.current = true;

    const params = new URLSearchParams();
    if (productId) params.set('productId', String(productId));
    if (shopId) params.set('shopId', String(shopId));
    if (shopCategoryId) params.set('shopCategoryId', String(shopCategoryId));

    const lastDate = localStorage.getItem('lastDate');
    const today = currentDate();
    if (!lastDate || diffOverOneDay(today, lastDate)) {
      params.set('isNew', '1');
    } else {
      params.set('click', '1');
    }
    localStorage.setItem('lastDate', today);

    fetch(`/api/common/log?${params.toString()}`, { credentials: 'include' }).catch(() => undefined);
  }, [productId, shopId, shopCategoryId]);

  return null;
}

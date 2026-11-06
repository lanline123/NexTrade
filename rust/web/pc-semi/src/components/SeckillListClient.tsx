'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { SeckillRecord } from '@/lib/api';

interface Props {
  records: SeckillRecord[];
  total: number;
  page: number;
  size: number;
}

interface ProductStyle {
  borderImage?: string;
  [key: string]: unknown;
}

function soldPercent(item: SeckillRecord): number {
  const sold = Number(item.seckillSales || 0);
  const stock = Number(item.seckillStock || 0);
  const total = sold + stock;
  return total > 0 ? Math.round((sold / total) * 100) : 0;
}

function priceText(value: number | string | undefined): string {
  const n = Number(value || 0);
  return Number.isFinite(n) ? n.toFixed(2) : '0.00';
}

export default function SeckillListClient({ records, total, page, size }: Props) {
  const [styleMap, setStyleMap] = useState<Record<number, ProductStyle>>({});
  const idsKey = useMemo(() => records.map((item) => item.productId).filter(Boolean).join(','), [records]);

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    fetch(`/api/product/productStyle/batchActiveStyle?productIds=${encodeURIComponent(idsKey)}`)
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return;
        const data = json?.data ?? json;
        if (data && typeof data === 'object') setStyleMap(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const pages = Math.max(1, Math.ceil(total / size));
  const pageItems = useMemo(() => {
    const items: number[] = [];
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    for (let i = start; i <= Math.min(pages, start + 4); i += 1) items.push(i);
    return items;
  }, [page, pages]);
  const pageHref = (next: number) => (next > 1 ? `/seckill?page=${next}` : '/seckill');

  return (
    <>
      <ul className="seckill-list">
        {records.map((item) => {
          const percent = soldPercent(item);
          const canBuy = item.canJoin !== false && Number(item.seckillStock || 0) > 0;
          const borderImage = styleMap[item.productId]?.borderImage;
          return (
            <li className="seckill-card" key={`${item.productId}-${item.skuSn || ''}`}>
              <Link className="seckill-card__link" href={`/product/${item.productId}`} title={item.productName}>
                <span className="seckill-card__pic">
                  <img src={item.picThumb || item.picUrl || ''} alt={item.productName || ''} loading="lazy" />
                  {borderImage ? <img className="product-style-border" src={borderImage} alt={item.productName || ''} /> : null}
                </span>
                <div className="seckill-card__name">{item.productName}</div>
                <div className="seckill-card__tip">限时秒杀 抢先提醒</div>
              </Link>
              <div className="seckill-card__operation">
                <div className="seckill-card__price">
                  <div className="seckill-card__price-main"><small>¥</small>{priceText(item.seckillPrice)}</div>
                  <div className="seckill-card__sell">
                    <span>已售{percent}%</span>
                    <div className="seckill-progress"><i style={{ width: `${percent}%` }} /></div>
                  </div>
                </div>
                {item.canJoin === false ? (
                  <div className="seckill-card__buy is-disabled" title={item.restrictTip || '仅限指定会员参与'}>仅限会员</div>
                ) : canBuy ? (
                  <Link className="seckill-card__buy" href={`/product/${item.productId}`} title={item.productName}>立即抢购</Link>
                ) : (
                  <div className="seckill-card__buy is-disabled">已抢完</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {records.length > 0 && pages > 1 ? (
        <nav className="seckill-pagination">
          {page > 1 ? <Link href={pageHref(page - 1)}>上一页</Link> : <span className="is-disabled">上一页</span>}
          {pageItems.map((item) => (
            <Link key={item} href={pageHref(item)} className={item === page ? 'is-current' : ''}>{item}</Link>
          ))}
          {page < pages ? <Link href={pageHref(page + 1)}>下一页</Link> : <span className="is-disabled">下一页</span>}
        </nav>
      ) : null}
    </>
  );
}

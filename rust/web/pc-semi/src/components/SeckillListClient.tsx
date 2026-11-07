'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { SeckillRecord } from '@/lib/api';

import { useTranslation } from 'react-i18next';
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
    const { t } = useTranslation();
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

  /**
   * 源码 seckill/List.vue：filterParams.unStarted 场次时间轴（已结束 / 正在秒杀 / 即将开始）。
   * 原版 .time 区块与 timeList 被注释，接口未单独下发场次列表，这里从记录里的
   * item.time 去重兜底；unStarted 即「正在秒杀」场次下标：之前已结束、之后即将开始。
   */
  const sessions = useMemo(() => {
    const list: string[] = [];
    records.forEach((item) => {
      const time = String((item as Record<string, unknown>).time ?? '').trim();
      if (time && !list.includes(time)) list.push(time);
    });
    return list.length ? list : ['正在秒杀', '即将开始'];
  }, [records]);
  const [unStarted, setUnStarted] = useState(0);

  const pages = Math.max(1, Math.ceil(total / size));
  const pageItems = useMemo(() => {
    const items: number[] = [];
    const start = Math.max(1, Math.min(page - 2, pages - 4));
    for (let i = start; i <= Math.min(pages, start + 4); i += 1) items.push(i);
    return items;
  }, [page, pages]);
  const pageHref = (next: number, nextSize = size) => {
    const query = new URLSearchParams();
    if (next > 1) query.set('page', String(next));
    if (nextSize !== 15) query.set('size', String(nextSize));
    return query.toString() ? `/seckill?${query.toString()}` : '/seckill';
  };
  /** 旧版 el-pagination 的 sizes：每页条数选择 */
  const sizeOptions = [15, 30, 50];

  return (
    <>
      {/* 源码 seckill/List.vue：filterParams.unStarted 场次时间轴 */}
      <div className="seckill-time" style={{ display: 'flex', height: 60, marginLeft: 30 }}>
        {sessions.map((time, index) => {
          const active = index === unStarted;
          const status = index < unStarted ? t('已结束') : active ? t('正在秒杀') : '即将开始';
          return (
            <div
              key={`${time}-${index}`}
              className={`seckill-time__react ${active ? 'be-being' : 'have-not-begun'}`}
              style={{
                width: active ? 230 : 180,
                height: 60,
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                transform: 'skewX(-45deg)',
                cursor: 'pointer',
                background: active ? '#e01222' : '#ffffff',
                color: active ? '#ffffff' : '#000000',
              }}
              onClick={() => setUnStarted(index)}
            >
              <div
                className="text"
                style={{
                  transform: 'skewX(45deg)',
                  display: 'flex',
                  gap: 10,
                  fontWeight: 700,
                  fontSize: active ? 20 : 14,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <span>{time}</span>
                <span className="right-text" style={{ fontSize: active ? 15 : 12 }}>
                  {active ? status : (
                    <span className="jjks" style={{
                      border: '1px solid #666', padding: '0 14px', height: 26, lineHeight: '25px',
                      color: '#666', borderRadius: 22, fontSize: 12, display: 'inline-block',
                    }}>{status}</span>
                  )}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <ul className="seckill-list">
        {records.map((item) => {
          const percent = soldPercent(item);
          const canBuy = item.canJoin !== false && Number(item.seckillStock || 0) > 0;
          const borderImage = styleMap[item.productId]?.borderImage;
          return (
            <li className="seckill_mod_product seckill-card" key={`${item.productId}-${item.skuSn || ''}`}>
              <Link className="seckill-card__link" href={`/product/${item.productId}`} title={item.productName}>
                <span className="seckill-card__pic">
                  <img src={item.picThumb || item.picUrl || ''} alt={item.productName || ''} loading="lazy" />
                  {borderImage ? <img className="product-style-border" src={borderImage} alt={item.productName || ''} /> : null}
                </span>
                <div className="seckill-card__name">{item.productName}</div>
                {item.time ? <div className="seckill-card__session" style={{ fontSize: 12, color: '#e01222', marginTop: 4 }}>{String(item.time)}</div> : null}
                <div className="seckill-card__tip">{t('限时秒杀 抢先提醒')}</div>
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
                  <div className="seckill-card__buy is-disabled" title={item.restrictTip || t('仅限指定会员参与')}>{t('仅限会员')}</div>
                ) : canBuy ? (
                  <Link className="seckill-card__buy" href={`/product/${item.productId}`} title={item.productName}>{t('立即抢购')}</Link>
                ) : (
                  <div className="seckill-card__buy is-disabled">{t('已抢完')}</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {records.length > 0 && pages > 1 ? (
        <nav className="seckill-pagination">
          {page > 1 ? <Link href={pageHref(page - 1)}>{t('上一页')}</Link> : <span className="is-disabled">{t('上一页')}</span>}
          {pageItems.map((item) => (
            <Link key={item} href={pageHref(item)} className={item === page ? 'is-current' : ''}>{item}</Link>
          ))}
          {page < pages ? <Link href={pageHref(page + 1)}>{t('下一页')}</Link> : <span className="is-disabled">{t('下一页')}</span>}
          <span className="seckill-pagination__size">
            {sizeOptions.map((option) => (
              <Link key={option} href={pageHref(1, option)} className={option === size ? 'is-current' : ''}>
                {option}条/页
              </Link>
            ))}
          </span>
        </nav>
      ) : null}
    </>
  );
}

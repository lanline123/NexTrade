/**
 * PC 首页秒杀模块预览（迁移自旧版 `pcHome/pc-home-seckill/Preview.vue`）。
 *
 * 取数：`/promotion/seckill/listForHomePreview`（复用 C 端首页同一服务端方法，
 * size 固定 15 与 C 端分页窗口一致；不能改回 `promotion/seckill/list`，它按
 * shop_id = 0 过滤且排序方向与前台相反）。倒计时取列表第一条活动结束时间。
 *
 * props 统一为 `{ data }`，渲染前与旧版 `pcHomeSeckillDefaults` 深合并。
 */
import { useEffect, useRef, useState } from 'react';
import { apiGet } from '../../../api';
import './pcSeckill.css';

import { useI18n } from '../../../i18n';
interface PreviewProduct {
  productId?: number;
  productName?: string;
  picUrl?: string;
  picThumb?: string;
  picLarge?: string;
  productPrice?: number | string;
  marketPrice?: number | string;
  seckillPrice?: number | string;
  seckkillData?: { seckillEndTime?: string };
}

const SECKILL_DEFAULTS = {
  frame: {
    boxPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0,
    boxRadius: 0,
    backgroundColor: '#fafafa',
    leftAndRightPadding: 0,
  },
  seckillTitle: '全场优惠限时9折起',
  title: {
    showTitle: 1,
    titleStyle: 1,
    titleAlign: 1,
    titleBackground: '',
    titleBackground2: '',
    titleBackgroundPic: { picUrl: '', picThumb: '' },
    titleRadius: 0,
    titlePaddingTop: 20,
    titlePaddingBottom: 20,
    titleText: '全场优惠限时9折起',
    titleColor: '#1a1a1a',
    descText: '',
    descColor: '#aaaaaa',
    showMore: 0,
    moreType: 2,
    countdownLabel: '倒计时',
    moreLink: { link: '', title: '' },
    moreColor: '#1a1a1a',
  },
  goodsGap: 10,
};

type SeckillConfig = typeof SECKILL_DEFAULTS;

/** 深合并默认值：对象递归、数组覆盖。 */
function deepMerge<T extends Record<string, any>>(defaults: T, data?: Record<string, any>): T {
  const out: Record<string, any> = Array.isArray(defaults) ? [...(defaults as any)] : { ...defaults };
  Object.entries(data || {}).forEach(([key, value]) => {
    const base = out[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && base && typeof base === 'object' && !Array.isArray(base)) {
      out[key] = deepMerge(base as Record<string, any>, value as Record<string, any>);
    } else if (value !== undefined) {
      out[key] = value;
    }
  });
  return out as T;
}

/** 秒杀预览数据（原版 listForHomePreview）。 */
function useSeckillPreview() {
    const { t } = useI18n();
  const [rows, setRows] = useState<PreviewProduct[]>([]);
  useEffect(() => {
    let alive = true;
    apiGet<{ records?: PreviewProduct[]; list?: PreviewProduct[] }>('/promotion/seckill/listForHomePreview', {
      page: 1,
      size: 15,
    })
      .then((res) => {
        if (alive) setRows(res.records || res.list || []);
      })
      .catch(() => {
        if (alive) setRows([]);
      });
    return () => {
      alive = false;
    };
  }, []);
  return rows;
}

/** 1s 心跳，驱动倒计时实时走秒。 */
function useNowTick(intervalMs = 1000) {
    const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** "YYYY-MM-DD HH:mm:ss" → 时间戳（无效返回 0）。 */
function dateStringToTimestamp(dateString?: string | null): number {
  if (!dateString) return 0;
  const parts = String(dateString).split(' ');
  const datePart = parts[0] || '';
  const timePart = parts[1] || '';
  const [year, month, day] = datePart.split('-');
  const [hour, minute, second] = timePart ? timePart.split(':') : ['0', '0', '0'];
  return new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second)).getTime();
}

function parseCountdownParts(remainingMs: number) {
  return {
    days: Math.floor(remainingMs / (1000 * 60 * 60 * 24)),
    hours: Math.floor((remainingMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
    minutes: Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60)),
    seconds: Math.floor((remainingMs % (1000 * 60)) / 1000),
  };
}

const formatNumTwo = (n: number) => String(n).padStart(2, '0');

/** 三段式价格（int/dec）。 */
function priceParts(price: string | number): { int: string; dec: string } {
  const num = Number(price);
  const text = Number.isFinite(num) ? num.toFixed(2) : String(price ?? '0.00');
  const [int, dec] = text.split('.');
  return { int: int || '0', dec: dec || '00' };
}

function TitleMoreArrow() {
  return (
    <svg className="pc-seckill__arrow" viewBox="0 0 16 16" width="16" height="16">
      <path d="M5.5 2.5l5 5.5-5 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

/** 标题右侧倒计时（深色数字方块）。 */
function TitleCountdownBox({ label, targetTs, now, color }: { label: string; targetTs: number; now: number; color: string }) {
    const { t } = useI18n();
  const remaining = targetTs ? Math.max(0, targetTs - now) : 0;
  const { days, hours, minutes, seconds } = parseCountdownParts(remaining);
  return (
    <div className="pc-seckill__countdown" style={{ color }}>
      <div className="pc-seckill__countdown-box">
        <span className="pc-seckill__countdown-label">{label}: </span>
        {days > 0 && (
          <>
            <span className="pc-seckill__countdown-item pc-seckill__countdown-item--days">{days}</span>
            <span className="pc-seckill__countdown-daytext">{t('天')}</span>
          </>
        )}
        <span className="pc-seckill__countdown-item">{formatNumTwo(hours)}</span>
        <span className="pc-seckill__countdown-sep">:</span>
        <span className="pc-seckill__countdown-item">{formatNumTwo(minutes)}</span>
        <span className="pc-seckill__countdown-sep">:</span>
        <span className="pc-seckill__countdown-item">{formatNumTwo(seconds)}</span>
      </div>
    </div>
  );
}

/** 标题栏：titleStyle 3 竖线、标题图 30px、24px 粗标题、desc、右侧倒计时或「更多」。 */
function SeckillTitleBar({
  title,
  fallbackText,
  countdownTargetTs,
  now,
  innerPaddingPx,
}: {
  title?: Record<string, any>;
  fallbackText: string;
  countdownTargetTs: number;
  now: number;
  innerPaddingPx: number;
}) {
    const { t } = useI18n();
  if (!title || Number(title.showTitle) !== 1) return null;
  const showMore = Number(title.showMore) === 1;
  const moreTypeRaw = Number(title.moreType);
  const mode = moreTypeRaw === 1 || moreTypeRaw === 2 ? moreTypeRaw : 2;
  const titleColor = title.titleColor || '#1a1a1a';
  const descColor = title.descColor || '#1a1a1a';
  const moreColor = title.moreColor || '#1a1a1a';
  const style = Number(title.titleStyle) || 1;
  const customLabel = String(title.countdownLabel || '').trim();
  let countdownLabel = customLabel || t('倒计时');
  if (!customLabel && countdownTargetTs) {
    if (countdownTargetTs - now <= 0) countdownLabel = '已结束';
  }
  const barStyle: Record<string, any> = {
    padding: `${Number(title.titlePaddingTop) || 20}px ${innerPaddingPx}px ${Number(title.titlePaddingBottom) || 20}px`,
  };
  const bg1 = String(title.titleBackground || '');
  const bg2 = String(title.titleBackground2 || '');
  if (bg1 && bg2) barStyle.background = `linear-gradient(to right, ${bg1}, ${bg2})`;
  else if (bg1) barStyle.background = bg1;
  if (Number(title.titleRadius)) {
    barStyle.borderTopLeftRadius = `${Number(title.titleRadius)}px`;
    barStyle.borderTopRightRadius = `${Number(title.titleRadius)}px`;
  }
  return (
    <div className="pc-seckill__titlebar" style={barStyle}>
      <div className="pc-seckill__title-wrapper">
        {style === 3 && <div className="pc-seckill__title-line" />}
        {title.titleBackgroundPic?.picUrl ? <img className="pc-seckill__title-bg-pic" src={title.titleBackgroundPic.picUrl} alt="" /> : null}
        <div className="pc-seckill__title" style={{ color: titleColor }}>
          {title.titleText || fallbackText}
        </div>
        {title.descText ? (
          <div className={`pc-seckill__desc${style === 2 ? ' pc-seckill__desc--big' : ''}`} style={{ color: descColor }}>
            {title.descText}
          </div>
        ) : null}
      </div>
      {showMore && mode === 2 && <TitleCountdownBox label={countdownLabel} targetTs={countdownTargetTs} now={now} color={moreColor} />}
      {showMore && mode === 1 && (
        <div className="pc-seckill__more" style={{ color: moreColor }}>
          <span>{String(title.moreLink?.title || '').trim() || t('更多')}</span>
          <TitleMoreArrow />
        </div>
      )}
    </div>
  );
}

function SwitchArrow({
  dir,
  left,
  right,
  onClick,
}: {
  dir: 'prev' | 'next';
  left?: number;
  right?: number;
  onClick?: () => void;
}) {
  return (
    <div className={`pc-seckill__switch pc-seckill__switch--${dir}`} style={{ left, right }} onClick={onClick}>
      <span />
    </div>
  );
}

const EMPTY_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Crect fill='%23f0f0f0' width='180' height='180'/%3E%3C/svg%3E";

export default function PcSeckillPreview({ data }: { data: Record<string, any> }) {
    const { t } = useI18n();
  const config = deepMerge<SeckillConfig>(SECKILL_DEFAULTS as SeckillConfig, data);
  const frame = (config.frame || {}) as Record<string, any>;
  const title = (config.title || {}) as Record<string, any>;
  const rows = useSeckillPreview();
  const now = useNowTick();
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollByStep = (dir: 1 | -1) => {
    const el = listRef.current;
    if (!el) return;
    const first = el.querySelector<HTMLElement>('.pc-seckill__item');
    const step = Math.max(220, Math.floor((first?.getBoundingClientRect().width || 0) + goodsGap));
    el.scrollBy({ left: dir * step, behavior: 'smooth' });
  };
  const goodsGap = Number(config.goodsGap) || 10;
  const innerPadding = Number(frame.leftAndRightPadding) || 0;
  const first = rows[0];
  const countdownTargetTs = dateStringToTimestamp(first?.seckkillData?.seckillEndTime || '');

  return (
    <div
      className="pc-seckill"
      style={{
        paddingLeft: Number(frame.boxPadding) || 0,
        paddingRight: Number(frame.boxPadding) || 0,
        paddingBottom: 20,
        marginTop: Number(frame.boxPaddingTop) || 0,
        marginBottom: Number(frame.boxPaddingBottom) || 0,
        borderRadius: Number(frame.boxRadius) || 0,
        backgroundColor: frame.backgroundColor || '#fafafa',
        ['--pc-seckill-gap' as any]: `${goodsGap}px`,
      }}
    >
      <SeckillTitleBar
        title={title}
        fallbackText={config.seckillTitle || t('限时秒杀')}
        countdownTargetTs={countdownTargetTs}
        now={now}
        innerPaddingPx={innerPadding}
      />

      <div className="pc-seckill__list-wrap">
        {rows.length > 0 ? (
          <div className="pc-seckill__list" ref={listRef} style={{ padding: `0 ${innerPadding}px` }}>
            {rows.slice(0, 15).map((product, index) => {
              const current = Number(product.seckillPrice ?? product.productPrice ?? 0);
              const original = Number(product.productPrice ?? product.marketPrice ?? 0);
              const discount = original > 0 && current < original ? Math.floor(((original - current) / original) * 100 * 10) / 10 : 0;
              const parts = priceParts(current);
              return (
                <div key={product.productId ?? index} className="pc-seckill__item">
                  <div className="pc-seckill__img">
                    <img src={(product.picThumb || product.picUrl) as string || EMPTY_IMG} alt={product.productName || ''} />
                  </div>
                  {discount > 0 && <div className="pc-seckill__discount">优惠{discount}%</div>}
                  <div className="pc-seckill__name">{product.productName}</div>
                  <div className="pc-seckill__price-row">
                    <div className="pc-seckill__price">
                      <span className="pc-seckill__price-currency">¥</span>
                      <span className="pc-seckill__price-int">{parts.int}</span>
                      <span className="pc-seckill__price-dec">.{parts.dec}</span>
                    </div>
                    <div className="pc-seckill__buy">
                      <span className="pc-seckill__add-btn" title={t('添加购物车')}>
                        <i className="pc-seckill__add-icon" />
                      </span>
                    </div>
                  </div>
                  {original > 0 && (
                    <div className="pc-seckill__price-origin">
                      ¥{Number.isFinite(original) ? original.toFixed(2) : '0.00'}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="pc-seckill__list pc-seckill__list--skeleton" style={{ padding: `0 ${innerPadding}px` }}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="pc-seckill__item">
                <div className="pc-seckill__skeleton-img" />
                <div className="pc-seckill__skeleton-line" />
              </div>
            ))}
          </div>
        )}
        {rows.length > 0 && (
          <>
            <SwitchArrow dir="prev" left={innerPadding} onClick={() => scrollByStep(-1)} />
            <SwitchArrow dir="next" right={innerPadding} onClick={() => scrollByStep(1)} />
          </>
        )}
      </div>
    </div>
  );
}

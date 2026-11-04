/**
 * PC 首页拼团模块预览（迁移自旧版 `pcHome/pc-home-groupon/Preview.vue` 及 `_shared/groupon`）。
 *
 * 取数：`/promotion/groupon/item/list`（活动 ID 来自 `data.grouponActivityItem`）；
 * 未选活动时回退旧版 mock 商品（不伪造真实活动数据）。
 * 倒计时由 React effect（1s 心跳）驱动，标题右侧与商品卡内同时走秒。
 *
 * props 统一为 `{ data }`，渲染前与旧版 `pcHomeGrouponDefaults` 深合并。
 */
import { useEffect, useRef, useState } from 'react';
import { apiGet } from '../../../api';
import './pcGroupon.css';

interface PreviewProduct {
  productId?: number | string;
  productName?: string;
  picUrl?: string;
  picThumb?: string;
  picLarge?: string;
  productPrice?: number | string;
  marketPrice?: number | string;
  minGroupPrice?: number | string;
  minGroupNum?: number | string;
  startTime?: string;
  endTime?: string;
}

const GROUPON_DEFAULTS = {
  style: 4,
  groupType: 1,
  cardStyle: 1,
  showName: 1,
  showPrice: 1,
  textAlign: 1,
  goodsPadding: 0,
  backgroundColor: '#ffffff',
  boxRadius: 0,
  innerPadding: 0,
  boxPadding: 0,
  boxPaddingTop: 5,
  boxPaddingBottom: 5,
  title: {
    showTitle: 0,
    titleStyle: 1,
    titleAlign: 1,
    titleBackground: '',
    titleBackground2: '',
    titleBackgroundPic: { picUrl: '', picThumb: '' },
    titleRadius: 0,
    titlePaddingTop: 20,
    titlePaddingBottom: 20,
    titleText: '拼团',
    titleColor: '#2a3145',
    descText: '',
    descColor: '#aaaaaa',
    showMore: 0,
    moreType: 2,
    countdownLabel: '距结束',
    moreLink: { link: '', title: '' },
    moreColor: '#1a1a1a',
  },
  buyBtnStyle: 0,
  grouponActivityItem: null as Record<string, any> | null,
};

type GrouponConfig = typeof GROUPON_DEFAULTS;

/** 深合并默认值：对象递归、数组覆盖。 */
function deepMerge<T extends Record<string, any>>(defaults: T, data?: Record<string, any>): T {
  const out: Record<string, any> = { ...defaults };
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

/** 拼团商品（promotion/groupon/item/list）；无活动 ID 时不请求。 */
function useGrouponItems(promotionId?: number) {
  const [rows, setRows] = useState<PreviewProduct[]>([]);
  useEffect(() => {
    if (!promotionId) {
      setRows([]);
      return;
    }
    let alive = true;
    apiGet<{ records?: PreviewProduct[]; list?: PreviewProduct[] }>('/promotion/groupon/item/list', {
      grouponPromotionId: promotionId,
      page: 1,
      size: 20,
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
  }, [promotionId]);
  return rows;
}

/** 1s 心跳，驱动倒计时实时走秒。 */
function useNowTick(intervalMs = 1000) {
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

/** 无活动时的 mock 商品（与原版 mockProducts 逐字段一致）。 */
const GROUPON_MOCK_PRODUCTS: PreviewProduct[] = [
  { productId: 1, productName: '拼团商品示例一号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=1', minGroupPrice: '99.00', productPrice: '199.00', minGroupNum: '2' },
  { productId: 2, productName: '拼团商品示例二号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=2', minGroupPrice: '128.00', productPrice: '256.00', minGroupNum: '3' },
  { productId: 3, productName: '拼团商品示例三号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=3', minGroupPrice: '68.00', productPrice: '168.00', minGroupNum: '2' },
  { productId: 4, productName: '拼团商品示例四号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=4', minGroupPrice: '188.00', productPrice: '388.00', minGroupNum: '5' },
  { productId: 5, productName: '拼团商品示例五号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=5', minGroupPrice: '58.00', productPrice: '118.00', minGroupNum: '2' },
  { productId: 6, productName: '拼团商品示例六号', picThumb: 'https://dummyimage.com/200x200/f5f5f5/999&text=6', minGroupPrice: '88.00', productPrice: '168.00', minGroupNum: '3' },
];

const EMPTY_IMG =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect fill='%23f5f5f5' width='100' height='100'/%3E%3C/svg%3E";

function TitleMoreArrow() {
  return (
    <svg className="pc-groupon__arrow" viewBox="0 0 16 16" width="16" height="16">
      <path d="M5.5 2.5l5 5.5-5 5.5" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

/** 标题右侧倒计时（与秒杀同款深色数字方块）。 */
function TitleCountdownBox({ label, targetTs, now }: { label: string; targetTs: number; now: number }) {
  const remaining = targetTs ? Math.max(0, targetTs - now) : 0;
  const { days, hours, minutes, seconds } = parseCountdownParts(remaining);
  return (
    <div className="pc-groupon__countdown">
      <div className="pc-groupon__countdown-box">
        <span className="pc-groupon__countdown-label">{label}: </span>
        {days > 0 && (
          <>
            <span className="pc-groupon__countdown-item pc-groupon__countdown-item--days">{days}</span>
            <span className="pc-groupon__countdown-daytext">天</span>
          </>
        )}
        <span className="pc-groupon__countdown-item">{formatNumTwo(hours)}</span>
        <span className="pc-groupon__countdown-sep">:</span>
        <span className="pc-groupon__countdown-item">{formatNumTwo(minutes)}</span>
        <span className="pc-groupon__countdown-sep">:</span>
        <span className="pc-groupon__countdown-item">{formatNumTwo(seconds)}</span>
      </div>
    </div>
  );
}

function GrouponTitleBar({
  title,
  fallbackText,
  countdownTargetTs,
  activityStartTs,
  now,
  moreColor,
}: {
  title?: Record<string, any>;
  fallbackText: string;
  countdownTargetTs: number;
  activityStartTs: number;
  now: number;
  moreColor: string;
}) {
  if (!title || Number(title.showTitle) !== 1) return null;
  const showMore = Number(title.showMore) === 1;
  const mode = Number(title.moreType) === 1 ? 1 : 2;
  const style = Number(title.titleStyle) || 1;
  const customLabel = String(title.countdownLabel || '').trim();
  let label = customLabel || '距结束';
  if (!customLabel && countdownTargetTs) {
    if (activityStartTs && activityStartTs > now) label = '距开始';
    else if (countdownTargetTs - now <= 0) label = '已结束';
  }
  const barStyle: Record<string, any> = {
    padding: `${Number(title.titlePaddingTop) || 20}px 0 ${Number(title.titlePaddingBottom) || 20}px`,
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
    <div className="pc-groupon__titlebar" style={barStyle}>
      <div className="pc-groupon__title-wrapper">
        {style === 3 && <div className="pc-groupon__title-line" />}
        {title.titleBackgroundPic?.picUrl ? <img className="pc-groupon__title-bg-pic" src={title.titleBackgroundPic.picUrl} alt="" /> : null}
        <div className="pc-groupon__title" style={{ color: title.titleColor || '#1a1a1a' }}>
          {title.titleText || fallbackText}
        </div>
        {title.descText ? (
          <div className={`pc-groupon__desc${style === 2 ? ' pc-groupon__desc--big' : ''}`} style={{ color: title.descColor || '#1a1a1a' }}>
            {title.descText}
          </div>
        ) : null}
      </div>
      {showMore && mode === 2 && <TitleCountdownBox label={label} targetTs={countdownTargetTs} now={now} />}
      {showMore && mode === 1 && (
        <div className="pc-groupon__more" style={{ color: moreColor }}>
          <span>{String(title.moreLink?.title || '').trim() || '更多'}</span>
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
    <div className={`pc-groupon__switch pc-groupon__switch--${dir}`} style={{ left, right }} onClick={onClick}>
      <span />
    </div>
  );
}

function CartIcon() {
  return (
    <svg className="pc-groupon-card__icon-cart" viewBox="0 0 16 16" aria-hidden="true">
      <path d="M1.5 2h1.6l1.3 7.2h7.5l1.2-5H4.1" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinejoin="round" />
      <circle cx="6" cy="12.6" r="1.1" fill="currentColor" />
      <circle cx="11.4" cy="12.6" r="1.1" fill="currentColor" />
    </svg>
  );
}

/** 拼团商品卡（对齐旧版 GrouponItemCard：cardStyle 1 图片倒计时条 + priceBox；其余简版价格行）。 */
function GrouponCard({
  item,
  cardStyle,
  textAlign,
  buyBtnStyle,
  showName,
  showPrice,
  countdownText,
  countdownLabel,
}: {
  item: PreviewProduct;
  cardStyle: number;
  textAlign: number;
  buyBtnStyle: number;
  showName: boolean;
  showPrice: boolean;
  countdownText: string;
  countdownLabel: string;
}) {
  const isCardStyle1 = cardStyle === 1;
  const groupNum = String(item.minGroupNum || '2');
  const groupPrice = String(item.minGroupPrice ?? item.productPrice ?? '0');
  const originPrice = String(item.productPrice ?? '0');

  const buyContent = () => {
    if (buyBtnStyle === 5 || buyBtnStyle === 6) return '购买';
    if (buyBtnStyle === 7 || buyBtnStyle === 8) return '马上抢';
    if (buyBtnStyle === 3 || buyBtnStyle === 4) return <i className="pc-groupon-card__icon-plus" style={{ width: 14, height: 14, background: 'transparent' }} />;
    return <CartIcon />;
  };

  return (
    <div className="pc-groupon-card">
      <div className="pc-groupon-card__image-wrap">
        <div className="pc-groupon-card__image" style={{ width: isCardStyle1 ? '90%' : '100%' }}>
          <img src={((item.picThumb || item.picUrl) as string) || EMPTY_IMG} alt={item.productName || ''} />
        </div>
      </div>
      {isCardStyle1 && (
        <div className="pc-groupon-card__countdown">
          <div className="pc-groupon-card__countdown-title">拼团</div>
          <div className="pc-groupon-card__countdown-time">
            <div className="pc-groupon-card__countdown-label">{countdownLabel}</div>
            {countdownText ? <div className="pc-groupon-card__countdown-text">{countdownText}</div> : null}
          </div>
        </div>
      )}
      {showName && (
        <div
          className="pc-groupon-card__name"
          style={{
            marginTop: 10,
            marginBottom: isCardStyle1 ? 0 : 12,
            textAlign: textAlign === 1 ? 'left' : 'center',
            justifyContent: textAlign === 1 ? 'flex-start' : 'center',
          }}
        >
          <span className="pc-groupon-card__tag">{groupNum}人团</span>
          <span className="pc-groupon-card__name-text">{item.productName}</span>
        </div>
      )}
      {showPrice &&
        (isCardStyle1 ? (
          <div className="pc-groupon-card__price-box" style={{ marginTop: 18 }}>
            <div className="pc-groupon-card__price-box-main">
              <span className="pc-groupon-card__price-current">¥{groupPrice}</span>
              <div className="pc-groupon-card__price-origin">¥{originPrice}</div>
            </div>
            <div className="pc-groupon-card__pin">拼</div>
          </div>
        ) : (
          <div className="pc-groupon-card__price-row" style={{ flexDirection: textAlign === 1 ? 'row' : 'column' }}>
            <div className="pc-groupon-card__price-row-main">
              <span className="pc-groupon-card__price-main">¥{groupPrice}</span>
              <span className="pc-groupon-card__price-line">¥{originPrice}</span>
            </div>
            <div className="pc-groupon-card__buy">
              {buyBtnStyle > 0 ? <span className="pc-groupon-card__buy-btn">{buyContent()}</span> : <span className="pc-groupon-card__icon-plus" />}
            </div>
          </div>
        ))}
    </div>
  );
}

export default function PcGrouponPreview({ data }: { data: Record<string, any> }) {
  const config = deepMerge<GrouponConfig>(GROUPON_DEFAULTS as GrouponConfig, data);
  const activity = (config.grouponActivityItem || null) as Record<string, any> | null;
  const activityId = Number(activity?.grouponPromotionId ?? activity?.grouponId) || undefined;
  const fetched = useGrouponItems(activityId);
  const now = useNowTick();
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const style = Number(config.style ?? 4);
  const isScrollLayout = style === 6;
  const cardStyle = Number(config.cardStyle ?? 1);
  const textAlign = Number(config.textAlign ?? 1);
  const buyBtnStyle = Number(config.buyBtnStyle ?? 0);
  const showName = Number(config.showName ?? 1) === 1;
  const showPrice = Number(config.showPrice ?? 1) === 1;
  const goodsPadding = Number(config.goodsPadding) || 0;

  const activityStartTs = dateStringToTimestamp(activity?.startTime || '');
  const activityEndTs = dateStringToTimestamp(activity?.endTime || '');

  // 无活动时按 style 取 mock（原版 displayProducts 口径：2→4 个，4→6 个，其余全部）
  const baseRows: PreviewProduct[] = fetched.length
    ? fetched
    : style === 2
      ? GROUPON_MOCK_PRODUCTS.slice(0, 4)
      : style === 4
        ? GROUPON_MOCK_PRODUCTS.slice(0, 6)
        : GROUPON_MOCK_PRODUCTS;
  const rows = baseRows.map((r) => ({ ...r, startTime: activity?.startTime || '', endTime: activity?.endTime || '' }));

  // 卡片倒计时文案（进行中→距结束，未开始→距开始，已结束→空）
  const cardCountdown = (item: PreviewProduct): { label: string; text: string } => {
    const startTs = dateStringToTimestamp(item.startTime || '');
    const endTs = dateStringToTimestamp(item.endTime || '');
    const started = !startTs || startTs < now;
    const ended = !!endTs && endTs < now;
    if (ended) return { label: '已结束', text: '' };
    const target = !started ? startTs : endTs;
    const remaining = target ? Math.max(0, target - now) : 0;
    if (!remaining) return { label: started ? '距结束' : '距开始', text: '' };
    const { days, hours, minutes, seconds } = parseCountdownParts(remaining);
    return {
      label: started ? '距结束' : '距开始',
      text:
        days > 0
          ? `${days}天${formatNumTwo(hours)}:${formatNumTwo(minutes)}:${formatNumTwo(seconds)}`
          : `${formatNumTwo(hours)}:${formatNumTwo(minutes)}:${formatNumTwo(seconds)}`,
    };
  };

  // 列宽（原版 itemWidth/scrollItemWidth：gap 参与宽度补偿）
  const gapComp = (perRow: number) =>
    goodsPadding > 0 ? `calc(${100 / perRow}% - ${(goodsPadding * (perRow - 1)) / perRow}px)` : `${100 / perRow}%`;
  const itemWidth = style === 2 ? gapComp(4) : style === 4 ? gapComp(6) : gapComp(5);

  return (
    <div
      className="pc-groupon"
      style={{
        width: `calc(100% - ${(Number(config.boxPadding) || 0) * 2}px)`,
        backgroundColor: config.backgroundColor || '#ffffff',
        borderRadius: Number(config.boxRadius) || 0,
        marginLeft: Number(config.boxPadding) || 0,
        marginRight: Number(config.boxPadding) || 0,
        marginTop: Number(config.boxPaddingTop ?? 5),
        marginBottom: Number(config.boxPaddingBottom ?? 5),
        padding: `0 ${Number(config.innerPadding) || 0}px`,
      }}
    >
      <div className="pc-groupon__inner">
        <GrouponTitleBar
          title={config.title}
          fallbackText="拼团"
          countdownTargetTs={activityEndTs}
          activityStartTs={activityStartTs}
          now={now}
          moreColor={config.title?.moreColor || '#1a1a1a'}
        />
        <div className="pc-groupon__list-wrap">
          {isScrollLayout ? (
            <div style={{ position: 'relative', width: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
              <div className="pc-groupon__scroll" ref={scrollRef} style={{ gap: goodsPadding, padding: goodsPadding }}>
                {rows.map((item, index) => (
                  <div key={index} className="pc-groupon__item" style={{ flex: '0 0 auto', width: gapComp(6) }}>
                    <GrouponCard
                      item={item}
                      cardStyle={cardStyle}
                      textAlign={textAlign}
                      buyBtnStyle={buyBtnStyle}
                      showName={showName}
                      showPrice={showPrice}
                      countdownText={cardCountdown(item).text}
                      countdownLabel={cardCountdown(item).label}
                    />
                  </div>
                ))}
              </div>
              <SwitchArrow
                dir="prev"
                left={0}
                onClick={() => {
                  const el = scrollRef.current;
                  if (!el) return;
                  const first = el.querySelector<HTMLElement>('.pc-groupon__item');
                  const step = Math.max(220, Math.floor((first?.getBoundingClientRect().width || 0) + goodsPadding));
                  el.scrollBy({ left: -step, behavior: 'smooth' });
                }}
              />
              <SwitchArrow
                dir="next"
                right={0}
                onClick={() => {
                  const el = scrollRef.current;
                  if (!el) return;
                  const first = el.querySelector<HTMLElement>('.pc-groupon__item');
                  const step = Math.max(220, Math.floor((first?.getBoundingClientRect().width || 0) + goodsPadding));
                  el.scrollBy({ left: step, behavior: 'smooth' });
                }}
              />
            </div>
          ) : (
            <div className="pc-groupon__grid" style={{ padding: goodsPadding }}>
              <div className="pc-groupon__grid-inner" style={{ gap: goodsPadding }}>
                {rows.map((item, index) => (
                  <div key={index} className="pc-groupon__item" style={{ width: itemWidth }}>
                    <GrouponCard
                      item={item}
                      cardStyle={cardStyle}
                      textAlign={textAlign}
                      buyBtnStyle={buyBtnStyle}
                      showName={showName}
                      showPrice={showPrice}
                      countdownText={cardCountdown(item).text}
                      countdownLabel={cardCountdown(item).label}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

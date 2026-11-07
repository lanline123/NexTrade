'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { Toast } from '@douyinfe/semi-ui';
import { apiGet, apiPost } from '@/lib/client-api';
import { formatPrice } from '@/lib/currency';
import { imageFormat } from '@/lib/image';
import { ensureCatIcoCss } from '@/lib/cat-icon-css';
import type { DecorateModule, PageModule } from '../types';
import { imageUrl } from './common';
import { CONTRACT_ADAPTERS, FLAT_FRAME, linkHref, type ContractRenderPlan } from './contract';

import { useTranslation } from 'react-i18next';
import { ShopProductCard, useProductStyleMap } from '@/components/product/ShopProductCard';
import i18n from '@/i18n';
/**
 * PC 首页装修模块渲染器（React + Semi 栈）
 *
 * 本文件字段/DOM 严格对齐旧版源码：
 * java-b2b2c-overseas-v5.8.61/view/pc/decorate/components/pc/Pc*.vue
 * 以及共享组件 decorate/components/shop/TotalContainer.vue、shop/Title.vue。
 *
 * 约定：
 * - 所有模块只读取旧 .vue 中真实出现的字段，不臆造视觉；
 * - class 名与旧版逐字一致（dec-image-ad__*、dec-pc-product__*、dec-pc-home-hero__* 等）；
 * - 轮播统一降级为自研轻量 carousel（Next 栈未引入 Swiper），DOM 保留旧版 item/slide 类名；
 * - 非装修必需的交互（加入购物车、登录跳转、swiper 手势）做链接化/静态化处理，见各组件注释。
 */

type ModuleProps<T = Record<string, any>> = { module: T };

/* ======================= 小工具 ======================= */

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

/** 旧版 urlFormat 的轻量实现：字符串/对象（{link} / {data:{link}}）→ 站内路径。 */
function navHref(raw?: string | Record<string, any> | null): string {
  if (!raw) return '';
  if (typeof raw === 'string') {
    const value = raw.trim();
    if (!value) return '';
    return value.startsWith('/') || /^(https?:)?\/\//.test(value) || value.startsWith('#') || value.startsWith('mailto:') || value.startsWith('tel:')
      ? value
      : `/${value}`;
  }
  const direct = typeof raw.link === 'string' ? raw.link : typeof raw.href === 'string' ? raw.href : '';
  if (direct) return navHref(direct);
  if (isRecord(raw.data)) {
    const dataLink = typeof raw.data.link === 'string' ? raw.data.link : typeof raw.data.href === 'string' ? raw.data.href : '';
    if (dataLink) return navHref(dataLink);
  }
  return '';
}

function openLink(raw?: string | Record<string, any> | null): void {
  const href = navHref(raw);
  if (!href || typeof window === 'undefined') return;
  window.open(href, '_blank', 'noopener,noreferrer');
}

function picSrc(pic?: Record<string, any> | null): string {
  // 相对路径兜底拼接 storageUrl（完整 http URL 原样返回）
  return imageFormat(pic?.picUrl || pic?.picThumb || '');
}

/** 旧版 imgPadding 在图片列表里既是 item padding 又是 gap，单位 px。 */
function px(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/** 旧版 useBuyBtnStyle.normalizeBuyBtnStyle：购买按钮配置兼容 {showBtn,btnType} 对象与数字两种格式。 */
function normalizeBuyBtnStyle(raw: unknown): { show: boolean; style: number } {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    return { show: Boolean(obj.showBtn), style: Number(obj.btnType) || 1 };
  }
  if (typeof raw === 'number' || typeof raw === 'string') {
    const n = Number(raw);
    return { show: n > 0, style: n };
  }
  return { show: false, style: 0 };
}

/** 简易自动轮播：translate 横向切换 + 圆点，支持 hover 暂停（替代旧版 Swiper）。 */
function useCarousel(length: number, delay = 3000) {
    const { t } = useTranslation();
  const [index, setIndexRaw] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    setIndexRaw(0);
  }, [length]);
  useEffect(() => {
    if (length <= 1 || paused) return undefined;
    const timer = window.setInterval(() => setIndexRaw((i) => (i + 1) % length), delay);
    return () => window.clearInterval(timer);
  }, [length, paused, delay]);
  const setIndex = (value: number) => setIndexRaw(length ? ((value % length) + length) % length : 0);
  return { index, setIndex, setPaused, paused };
}

/**
 * 旧版 Swiper 手势/循环补齐：pointer 拖拽 + loop 环绕。
 * - 拖动位移实时反馈（超出边界时阻尼）；松手超过阈值（30px 或 15% 宽）翻页/上一页；
 * - loop=true 时首尾环绕（旧版 Swiper loop，无克隆节点，行为一致：翻到最后一张回到第一张）；
 * - 返回 spread 到 viewport 的 handlers 与当前拖拽偏移（px），供 track transform 叠加。
 */
function useSwipeDrag(index: number, count: number, setIndex: (value: number) => void, options: { loop?: boolean } = {}) {
  const { loop = true } = options;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{ startX: number; startY: number; width: number; dx: number; horizontal: boolean | null; pointerId: number | null }>({
    startX: 0,
    startY: 0,
    width: 0,
    dx: 0,
    horizontal: null,
    pointerId: null,
  });
  const stateRef = useRef({ index, count, setIndex, loop });
  stateRef.current = { index, count, setIndex, loop };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (stateRef.current.count <= 1) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      width: event.currentTarget.clientWidth || 1,
      dx: 0,
      horizontal: null,
      pointerId: event.pointerId,
    };
    setDragging(true);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag.pointerId === null) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    if (drag.horizontal === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
      drag.horizontal = Math.abs(dx) > Math.abs(dy);
      if (drag.horizontal) {
        try {
          event.currentTarget.setPointerCapture(drag.pointerId);
        } catch {
          /* ignore */
        }
      }
    }
    if (drag.horizontal !== true) return;
    drag.dx = dx;
    // 边界阻尼（loop 场景下同样给阻尼反馈，松手后再环绕）
    const atStart = stateRef.current.index <= 0;
    const atEnd = stateRef.current.index >= stateRef.current.count - 1;
    const damped = (dx > 0 && atStart) || (dx < 0 && atEnd) ? dx * 0.35 : dx;
    setOffset(damped);
  };

  const finish = () => {
    const drag = dragRef.current;
    if (drag.pointerId === null) return;
    const { width, dx, pointerId } = drag;
    dragRef.current = { startX: 0, startY: 0, width: 0, dx: 0, horizontal: null, pointerId: null };
    setDragging(false);
    setOffset(0);
    if (pointerId !== null) {
      try {
        // 释放捕获（元素可能已卸载，忽略错误）
        document.body.dispatchEvent(new Event('mouseup'));
      } catch {
        /* ignore */
      }
    }
    const threshold = Math.max(30, width * 0.15);
    if (Math.abs(dx) < threshold) return;
    const current = stateRef.current;
    const rawNext = dx < 0 ? current.index + 1 : current.index - 1;
    const next = current.loop ? ((rawNext % current.count) + current.count) % current.count : Math.min(current.count - 1, Math.max(0, rawNext));
    current.setIndex(next);
  };

  const onPointerUp = () => finish();
  const onPointerCancel = () => finish();
  const onLostPointerCapture = () => finish();

  return {
    offset,
    dragging,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
    },
  };
}

/** 旧版 Swiper navigation 箭头（Banner2 / GroupBanner / ImageNav / CategoryNav / 秒杀拼团 style6 共用）。 */
function SwiperNav({
  onPrev,
  onNext,
  visible = true,
}: {
  onPrev: () => void;
  onNext: () => void;
  visible?: boolean;
}) {
  const { t } = useTranslation();
  if (!visible) return null;
  return (
    <>
      <button type="button" className="dec-swiper-nav dec-swiper-nav--prev" onClick={onPrev} aria-label={t('上一张')}>
        ‹
      </button>
      <button type="button" className="dec-swiper-nav dec-swiper-nav--next" onClick={onNext} aria-label={t('下一张')}>
        ›
      </button>
    </>
  );
}

/* ======================= 交互增强（task-91：源码级补齐） ======================= */

function isLoggedIn(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(window.localStorage.getItem('accessToken'));
}

function goLogin(): void {
  if (typeof window === 'undefined') return;
  const redirect = encodeURIComponent(`${window.location.pathname}${window.location.search}`);
  window.location.href = `/login?redirect=${redirect}`;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function showToast(kind: 'success' | 'error', message: string): void {
  try {
    if (kind === 'success') Toast.success(message);
    else Toast.error(message);
  } catch {
    /* 无 Semi Toast 上下文（SSR/预览）时忽略 */
  }
}

function productSkuList(product: any): any[] {
  const raw = product?.productSku;
  if (Array.isArray(raw)) return raw;
  if (raw && typeof raw === 'object') return [raw];
  return [];
}

function isMultiSku(product: any): boolean {
  const list = productSkuList(product);
  if (list.length > 1) return true;
  const first = list[0];
  return Array.isArray(first?.skuData) && first.skuData.length > 1;
}

function firstSkuId(product: any): number | undefined {
  const sku = productSkuList(product)[0];
  const id = sku?.skuId ?? sku?.id;
  return id === undefined || id === null || id === '' ? undefined : Number(id);
}

function productDetailHref(product: any): string {
  const sn = product?.productSn || '';
  return product?.seoLink || (sn ? `/product/${sn}` : `/product/${product?.productId ?? ''}`);
}

/** 售罄口径（旧 PcProductGroup.isSoldOut / PcSeckillLegacy disabled 条件）：
 * 普通商品看 productStock；秒杀商品（isSeckill==1）看 seckillStock。 */
function productSoldOut(product: any): boolean {
  if (!product) return false;
  const isSeckill = (product as any).isSeckill;
  if (Number(isSeckill) === 1) return Number((product as any).seckillStock ?? 1) === 0;
  return Number(product.productStock ?? 1) === 0;
}

/** 数组分块（店铺卡片版式用：style=4 每 3 个一组、style=7 每屏 3 个）。 */
function chunk<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) {
    out.push(list.slice(i, i + size));
  }
  return out;
}

/** 复刻原版 FormatPrice 的整数/小数拆分（match(/^(\d+)(\.\d+)?$/)，小数不足补到 2 位）。 */
function priceParts(value: unknown): { int: string; dec: string } {
  const raw = value == null || value === '' ? '0' : String(value);
  const match = /^(\d+)(\.\d+)?$/.exec(raw);
  if (!match) return { int: '0', dec: '.00' };
  const int = match[1] || '0';
  const rawDec = match[2] || '.00';
  const dec = rawDec.length < 3 ? rawDec.padEnd(3, '0') : rawDec;
  return { int, dec };
}

/** 活动类型文字白名单（原版 PcProductGroup.vue ACTIVITY_TYPE_TEXT：仅展示这些，type=2 券走独立样式、type=8 抽奖不展示）。 */
const ACTIVITY_TYPE_TEXT: Record<number, string> = {
  1: '秒杀',
  3: '满减',
  4: '满折',
  5: '满赠',
  6: '限时折扣',
  7: '拼团',
};

/** 商品命中的活动标签文案（原版 getActivityTags：type 无效/为 2 跳过，typeText 优先、白名单兜底）。 */
function activityTagsOf(
  promotions: Record<string, { activityInfo?: Array<{ type?: number; typeText?: string }> }>,
  productId: unknown,
): string[] {
  const pid = productId == null ? '' : String(productId);
  if (!pid) return [];
  const info = promotions[pid]?.activityInfo;
  if (!Array.isArray(info)) return [];
  const tags: string[] = [];
  info.forEach((item) => {
    const type = Number(item?.type);
    if (!Number.isFinite(type) || type === 2) return;
    const fallback = ACTIVITY_TYPE_TEXT[type];
    if (typeof fallback !== 'string') return;
    const text = typeof item?.typeText === 'string' ? item.typeText.trim() : '';
    tags.push(text || fallback);
  });
  return tags;
}

function needsProductDetail(product: any): boolean {
  return Number(product?.productType ?? 1) !== 1 || isMultiSku(product);
}

/** 旧版 ProductBuy 口径：多规格/预约商品 → 商品详情；单规格 → 加购（未登录跳登录）。 */
async function buyProduct(product: any, options: { isQuick?: number } = {}): Promise<void> {
  if (needsProductDetail(product)) {
    openLink(productDetailHref(product));
    return;
  }
  if (productSoldOut(product)) return;
  if (!isLoggedIn()) {
    goLogin();
    return;
  }
  try {
    await apiPost('cart/cart/addToCart', {
      id: Number(product?.productId),
      number: 1,
      skuId: firstSkuId(product),
      isQuick: options.isQuick ?? 0,
    });
    showToast('success', '已加入购物车');
  } catch (error) {
    showToast('error', errorText(error));
  }
}

/** 用户详情（旧版 useUserStore：nickname/avatar/coupon/balance/points）。 */
function useUserProfile(): Record<string, any> | null {
    const { t } = useTranslation();
  const [profile, setProfile] = useState<Record<string, any> | null>(null);
  useEffect(() => {
    if (!isLoggedIn()) return undefined;
    let alive = true;
    apiGet<Record<string, any>>('user/user/detail')
      .then((data) => {
        if (alive && data) setProfile(data);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return profile;
}

/* ---- 旧版 commonStore.allCate：PC 分类楼层（/api/common/pc/getCatFloor） ---- */

interface HeroCatTitleLink {
  categoryTitleName: string;
  link: string;
}

interface HeroCatItem {
  id: string;
  title: string;
  iconFont?: string;
  imageUrl?: string;
  useImage?: number;
  catFloorNames: HeroCatTitleLink[];
  catList: any[];
  entryLink: string;
}

function categoryListHref(categoryId: unknown, catFloorId: unknown, seoLink?: unknown): string {
  const seo = seoLink ? String(seoLink) : '';
  if (seo) return seo;
  return `/list?categoryId=${encodeURIComponent(String(categoryId ?? ''))}&pId=${encodeURIComponent(String(catFloorId ?? ''))}`;
}

function resolveCategoryLink(rawLink: string, fallback: string): string {
  const link = String(rawLink || '').trim();
  if (!link || link === 'list') return fallback;
  return navHref(link) || fallback;
}

function resolveCatNodeHref(cat: any, catFloorId: unknown): string {
  const fallback = categoryListHref(cat?.categoryId ?? cat?.id, catFloorId, cat?.seoLink);
  const custom = cat?.categoryLink;
  return custom ? resolveCategoryLink(String(custom), fallback) : fallback;
}

function toHeroCatItem(floor: any, index: number): HeroCatItem | null {
  if (!isRecord(floor)) return null;
  const catList: any[] = Array.isArray(floor.catList) ? floor.catList : [];
  if (!catList.length) return null;
  const catFloorId = floor.catFloorId ?? index;
  const rawNames: any[] = Array.isArray(floor.catFloorNames) ? floor.catFloorNames : [];
  const firstCat = catList[0];
  const firstFallback = categoryListHref(firstCat?.categoryId ?? firstCat?.id, catFloorId, firstCat?.seoLink);
  const nameLinks: HeroCatTitleLink[] = rawNames
    .map((name) => {
      const title = String(name?.categoryTitleName ?? '').trim();
      return { categoryTitleName: title, link: resolveCategoryLink(String(name?.categoryLink ?? ''), firstFallback) };
    })
    .filter((name) => name.categoryTitleName && name.categoryTitleName !== '-');
  const floorEntry = catList.find((cat) => Boolean(cat?.categoryId ?? cat?.id) && (cat?.categoryName ?? cat?.name) !== '-');
  const entryLink = floorEntry ? resolveCatNodeHref(floorEntry, catFloorId) : categoryListHref(catFloorId, catFloorId);
  const floorName = String(floor.catFloorName ?? '')
    .replace(/[，,、]/g, ' / ')
    .replace(/\s*\/\s*/g, ' / ')
    .trim();
  const title = nameLinks.length ? nameLinks.slice(0, 3).map((name) => name.categoryTitleName).join(' / ') : floorName || (i18n.t('类目') as string);
  const firstPic = typeof firstCat?.pic === 'string' ? firstCat.pic : '';
  const imageUrl = typeof floor.imageUrl === 'string' ? floor.imageUrl : typeof firstCat?.categoryPic === 'string' ? firstCat.categoryPic : firstPic;
  return {
    id: String(catFloorId),
    title,
    iconFont: typeof floor.floorIcoFont === 'string' ? floor.floorIcoFont : undefined,
    imageUrl,
    useImage: Number(floor.useImage ?? (imageUrl ? 1 : 0)),
    catFloorNames: nameLinks,
    catList,
    entryLink,
  };
}

function useHeroCatItems(): HeroCatItem[] {
    const { t } = useTranslation();
  const [items, setItems] = useState<HeroCatItem[]>([]);
  useEffect(() => {
    let alive = true;
    fetch('/api/common/pc/getCatFloor')
      .then((response) => response.json())
      .then((json) => {
        if (!alive) return;
        ensureCatIcoCss(json?.data?.icoDefinedCss ?? json?.icoDefinedCss);
        const raw = json?.data?.catFloor ?? json?.catFloor ?? [];
        const list: HeroCatItem[] = Array.isArray(raw)
          ? raw
              .map((floor: any, index: number) => toHeroCatItem(floor, index))
              .filter((item: HeroCatItem | null): item is HeroCatItem => item !== null)
          : [];
        setItems(list);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return items;
}

/** 旧版 `buildSubCataFixedStyle`：子类目弹层紧贴左侧面板右边缘、顶部对齐（fixed 视口坐标）。
 *  高度取左侧面板（= 营销通栏 --dec-height）实测高度，与通栏齐平。 */
function subCataFixedStyle(rect: DOMRect): Record<string, string> {
  if (!rect || !Number.isFinite(rect.top) || !Number.isFinite(rect.right)) return {};
  const panelWidth = 680;
  const gap = 8;
  const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 900 : window.innerHeight;
  const preferredLeft = rect.right + gap;
  const left = preferredLeft + panelWidth > viewportWidth - gap ? Math.max(gap, rect.left - panelWidth - gap) : preferredLeft;
  const maxHeight = Math.max(240, viewportHeight - rect.top - gap);
  const height = Math.min(rect.height || maxHeight, maxHeight);
  return {
    position: 'fixed',
    top: `${Math.round(rect.top)}px`,
    left: `${Math.round(left)}px`,
    height: `${Math.round(height)}px`,
    maxHeight: `${Math.round(maxHeight)}px`,
    overflowY: 'auto',
    zIndex: '1000',
  };
}

/** 旧版 `getHotareaStyle` 兜底：后端 position 字符串（如 "left:10px;top:10px"）→ React style。 */
function parseCssText(text: unknown): Record<string, string> {
  if (typeof text !== 'string' || !text.trim()) return {};
  const style: Record<string, string> = {};
  text.split(';').forEach((part) => {
    const index = part.indexOf(':');
    if (index <= 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!key || !value) return;
    const camel = key.replace(/-([a-z])/g, (_, char: string) => char.toUpperCase());
    style[camel] = value;
  });
  return style;
}


/* ======================= 共享基础组件 ======================= */

/** 旧版 TotalContainer：外层 padding，内层 .base-class 背景/圆角/裁切。 */
function Container({
  module,
  className = '',
  style,
  children,
}: {
  module: Record<string, any>;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const inner = module.innerPadding ?? 0;
  const radius = px(module.boxRadius);
  return (
    <div
      className={className}
      style={{
        paddingTop: px(module.boxPaddingTop ?? inner),
        paddingBottom: px(module.boxPaddingBottom ?? inner),
        paddingLeft: px(module.boxPadding ?? inner),
        paddingRight: px(module.boxPadding ?? inner),
        ...style,
      }}
    >
      <div
        className="base-class"
        style={{
          backgroundColor: module.backgroundColor || undefined,
          borderRadius: `${radius}px`,
          overflow: radius ? 'hidden' : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/** 旧版 shop/Title.vue：标题栏（含背景渐变/圆角/图文/更多链接）。 */
function ShopTitle({ title, rightText }: { title?: Record<string, any> | null; rightText?: string }) {
    const { t } = useTranslation();
  if (!title || Number(title.showTitle) !== 1) return null;
  const style: Record<string, any> = {
    borderTopLeftRadius: `${px(title.titleRadius)}px`,
    borderTopRightRadius: `${px(title.titleRadius)}px`,
  };
  if (title.titleBackground2) {
    style.background = `linear-gradient(to right, ${title.titleBackground || ''}, ${title.titleBackground2})`;
  } else if (title.titleBackground) {
    style.background = title.titleBackground;
  }
  const moreText = title?.moreLink?.title || rightText || t('查看更多');
  return (
    <div className={`top-bar top-bar--style-${title.titleStyle || 1} top-bar--align-${title.titleAlign || 1}`} style={style}>
      <div className="left-title">
        {title.titleBackgroundPic?.picUrl ? (
          <img className="image-size" src={title.titleBackgroundPic.picUrl} alt="" />
        ) : null}
        <div className="title-text" style={{ color: title.titleColor }}>{title.titleText}</div>
        {title.descText ? <div className="desc-text" style={{ color: title.descColor }}>{title.descText}</div> : null}
      </div>
      {Number(title.showMore) === 1 ? (
        <a className="right-title" href={navHref(title.moreLink) || '#'} target="_blank" rel="noreferrer" style={{ color: title.moreColor }}>
          <span>{moreText}</span>
          <i className="icon iconfont-pc icon-login-jt" />
        </a>
      ) : null}
    </div>
  );
}

/* ======================= 1. pc-image-ad ======================= */

/**
 * PcImageAd.vue 字段：picList、picType（1/5/6/7 栅格，2 轮播）、picPageType（1/2/3 指示器）、
 * picRadioStyle（2=圆角 8px）、isFluxWidth（1=左右不留白）、imgPadding（item padding + gap）、
 * swiperPreView（轮播每屏张数）、swiperPageColor（指示器激活色）、title、frame。
 */
function ImageAd({ module }: ModuleProps) {
    const { t } = useTranslation();
  const pics: any[] = Array.isArray(module.picList) ? module.picList : [];
  if (!pics.length) return null;
  const picType = Number(module.picType ?? 1);
  const isFluxWidth = Number(module.isFluxWidth) === 1;
  const frame = module.frame || {};
  const imgPadding = px(module.imgPadding);
  const rounded = Number(module.picRadioStyle) === 2;
  const cssVars: Record<string, any> = {
    '--dec-box-padding': `${isFluxWidth ? 0 : px(frame.boxPadding, 10)}px`,
    '--dec-box-padding-top': `${px(frame.boxPaddingTop, 5)}px`,
    '--dec-box-padding-bottom': `${px(frame.boxPaddingBottom, 5)}px`,
    '--dec-box-radius': `${px(frame.boxRadius)}px`,
    '--dec-bg-color': frame.backgroundColor || '#ffffff',
    '--dec-inner-padding': `${imgPadding}px`,
    '--dec-item-gap': `${imgPadding}px`,
    '--dec-item-radius': rounded ? '8px' : '0',
    '--dec-indicator-color': module.swiperPageColor || '#333333',
  };
  const classes = [`dec-image-ad--layout-${picType}`];
  if (picType === 2) classes.push(`dec-image-ad--indicator-${module.picPageType ?? 1}`);
  if (rounded) classes.push('dec-image-ad--rounded');
  if (isFluxWidth) classes.push('dec-image-ad--flux');
  return (
    <div className={`dec-image-ad ${classes.join(' ')}`} style={cssVars}>
      <div className="dec-image-ad__content">
        <ShopTitle title={module.title} />
        {picType === 2 ? (
          <ImageAdCarousel pics={pics} perView={Math.max(1, Number(module.swiperPreView) || 1)} />
        ) : (
          <div className="dec-image-ad__list">
            {pics.map((pic, index) => (
              <div className="dec-image-ad__item" key={index}>
                <a
                    className="dec-image-ad__link"
                    href={navHref(pic.picLink) || '#'}
                    onClick={(event) => {
                      if (!navHref(pic.picLink)) event.preventDefault();
                    }}
                    target="_blank"
                    rel="noreferrer"
                  >
                  <img className="dec-image-ad__image" src={picSrc(pic)} alt="" loading="lazy" />
                </a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ImageAdCarousel({ pics, perView }: { pics: any[]; perView: number }) {
    const { t } = useTranslation();
  const pages = Math.max(1, Math.ceil(pics.length / perView));
  const { index, setIndex, setPaused } = useCarousel(pages, 3000);
  const swipe = useSwipeDrag(index, pages, setIndex);
  return (
    <div className={`dec-image-ad__swiper${swipe.dragging ? ' is-dragging' : ''}`} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="dec-image-ad__swiper-viewport" {...swipe.handlers}>
        <div className="dec-image-ad__swiper-track" style={{ transform: `translateX(calc(-${index * 100}% + ${swipe.offset}px))` }}>
          {Array.from({ length: pages }).map((_, page) => (
            <div className="dec-image-ad__swiper-page" key={page} style={{ gridTemplateColumns: `repeat(${perView}, minmax(0, 1fr))` }}>
              {/* 旧 Carousel：尾页不足一屏时以占位补齐，保持网格不偏左 */}
              {Array.from({ length: perView }).map((_, cell) => {
                const pic = pics[page * perView + cell];
                if (!pic) return <div className="dec-image-ad__item" key={`placeholder-${cell}`} aria-hidden />;
                return (
                  <div className="dec-image-ad__item" key={cell}>
                    <a
                      className="dec-image-ad__link"
                      href={navHref(pic.picLink) || '#'}
                      onClick={(event) => {
                        if (!navHref(pic.picLink)) event.preventDefault();
                      }}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <img className="dec-image-ad__image" src={picSrc(pic)} alt="" loading="lazy" />
                    </a>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {pages > 1 ? (
        <div className="dec-image-ad__dots">
          {Array.from({ length: pages }).map((_, dot) => (
            <button
              key={dot}
              type="button"
              className={`dec-image-ad__dot${dot === index ? ' is-active' : ''}`}
              onClick={() => setIndex(dot)}
              aria-label={t('第 {n} 屏', { n: dot + 1 })}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/* ======================= 2. pc-product ======================= */

interface ProductItem {
  productId?: number;
  productSn?: string;
  seoLink?: string;
  productName?: string;
  productBrief?: string;
  brief?: string;
  productPrice?: number | string;
  picThumb?: string;
  picUrl?: string;
  productStock?: number;
  /* 商品分组卡用（原版 PcProductGroup.vue：已售数与店铺信息） */
  virtualSales?: number;
  shop?: { shopTitle?: string };
}

/** PcProduct.vue：products.productSelectType(1 指定/2 分类/3 标签)、productIds、
 * productCategoryId/productNumber、productTag/productNumber、style(2=5 列，否则 4 列)、
 * goodsPadding、frame、showName/showBrief/showPrice、buyBtnStyle。 */
function Product({ module }: ModuleProps) {
    const { t } = useTranslation();
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const config = module.products || {};
  /**
   * 店铺商品卡片版式（源码 components/shop/ShopProduct.vue:4-8，module.style 决定）：
   *   1 / 2 / 3 → OneRowProductX（竖排 ProductCard，可换行）
   *   4       → OneBig2Small（一大两小，每 3 个一组）
   *   5       → OneRowProductX direction="land"（横排 ProductCardLand）
   *   6       → OneRowProductX direction="slide"（ProductCardSlide，横向不换行）
   *   7       → OneRow3Carousel（每屏 3 个 ProductCardSlide，轮播）
   *
   * 此前只按 style===2 切列数（5 列），其余版式全部退化为同一网格 → 后台配的版式不生效。
   */
  const cardStyle = Number(module.style) || 1;
  const columns = cardStyle === 2 ? 5 : 4;
  const goodsPadding = px(module.goodsPadding, 5);
  const frame = module.frame || {};
  const xPadding = frame.leftAndRightPadding ?? frame.innerPadding ?? module.innerPadding ?? 0;
  const showName = module.showName !== false && module.showName !== 0;
  const showBrief = module.showBrief !== false && module.showBrief !== 0;
  const showPrice = module.showPrice !== false && module.showPrice !== 0;
  const buyBtnConfig = normalizeBuyBtnStyle(module.buyBtnStyle);
  const buyBtnStyle = buyBtnConfig.style;
  /**
   * 卡片边框样式（源码 components/shop/product/ProductCard.vue）：
   * goodsStyle 2 → product-card-border-2；3 → product-card-border-3；
   * 1 → 无边框类；其余（默认/4）→ product-card-border-4。
   * goodsRadioStyle 2 → 图片圆角（image-box-radius）。
   * 此前这两个字段被读取但未落到 class，后台配置不生效。
   */
  const goodsStyle = Number(module.goodsStyle ?? 0);
  const cardBorderClass =
    goodsStyle === 2 ? 'product-card-border-2'
      : goodsStyle === 3 ? 'product-card-border-3'
        : goodsStyle === 1 ? ''
          : 'product-card-border-4';
  const goodsRadioStyle = Number(module.goodsRadioStyle ?? 0);

  useEffect(() => {
    let cancelled = false;
    const productSelectType = Number(config.productSelectType || 0);
    const params = new URLSearchParams({ page: '1' });
    if (productSelectType === 1) {
      const rawIds = config.productIds;
      const ids = Array.isArray(rawIds)
        ? rawIds
        : typeof rawIds === 'string' && rawIds
          ? rawIds.split(',').filter(Boolean)
          : [];
      if (ids.length) {
        params.set('ids', ids.join(','));
        params.set('size', String(ids.length));
      } else {
        params.set('size', '0');
      }
    } else if (productSelectType === 2) {
      params.set('categoryId', String(config.productCategoryId ?? ''));
      params.set('size', String(px(config.productNumber, columns * 2)));
    } else if (productSelectType === 3) {
      params.set('introType', String(config.productTag ?? ''));
      params.set('size', String(px(config.productNumber, columns * 2)));
    } else {
      params.set('size', '0');
    }
    if (Number(module.shopId) > 0) params.set('shopId', String(module.shopId));
    if (params.get('size') === '0') {
      setProducts([]);
      setLoading(false);
      return undefined;
    }
    fetch(`/api/product/product/list?${params.toString()}`)
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return;
        const records = json?.data?.records || json?.data || json?.records || [];
        setProducts(Array.isArray(records) ? records : []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config), columns]);

  /**
   * 生效商品样式（活动边框图 borderImage）。
   * 旧版 hooks/useProductStyle.ts：按模块内商品批量取生效样式。
   */
  const styleMap = useProductStyleMap(products as any);

  // 旧版首屏无数据时整块不渲染（TotalContainer v-if productList.length）
  if (!loading && !products.length) return null;

  const cssVars: Record<string, any> = {
    '--dec-columns': String(columns),
    '--dec-goods-padding': `${goodsPadding}px`,
  };

  const containerModule = {
    boxPadding: frame.boxPadding ?? module.boxPadding ?? 10,
    boxPaddingTop: frame.boxPaddingTop ?? module.boxPaddingTop ?? 5,
    boxPaddingBottom: frame.boxPaddingBottom ?? module.boxPaddingBottom ?? 5,
    boxRadius: frame.boxRadius ?? module.boxRadius ?? 0,
    backgroundColor: frame.backgroundColor || module.backgroundColor || '#ffffff',
    innerPadding: frame.innerPadding ?? module.innerPadding ?? 0,
  };

  return (
    <div className="dec-pc-product" style={cssVars}>
      <Container module={containerModule}>
        <div className="dec-pc-product__content" style={{ paddingLeft: px(xPadding), paddingRight: px(xPadding) }}>
          <ShopTitle title={module.title} />
          {loading ? (
            <div className="dec-pc-product__list" style={{ padding: `${goodsPadding}px` }}>
              {Array.from({ length: columns }).map((_, index) => (
                <div key={index} className="dec-pc-product__item">
                  <div className="dec-pc-product__card"><span className="dec-skeleton-line" /></div>
                </div>
              ))}
            </div>
          ) : (
            <div className="dec-pc-product__wrapper">
              {/* style=4：一大两小（源码 OneBig2Small.vue，每 3 个一组：1 大 + 2 小） */}
              {cardStyle === 4 ? (
                <div className="dec-pc-product__groups">
                  {chunk(products, 3).map((group, groupIndex) => (
                    <div className="dec-pc-product__group" key={groupIndex}>
                      <div className="dec-pc-product__group-big">
                        {group[0] ? (
                          <ShopProductCard product={group[0] as any} module={module} variant="standard" styleMap={styleMap} />
                        ) : null}
                      </div>
                      <div className="dec-pc-product__group-small">
                        {group[1] ? (
                          <ShopProductCard product={group[1] as any} module={module} variant="standard" styleMap={styleMap} />
                        ) : null}
                        {group[2] ? (
                          <ShopProductCard product={group[2] as any} module={module} variant="standard" styleMap={styleMap} />
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : cardStyle === 7 ? (
                /* style=7：每屏 3 个横滑卡片（源码 OneRow3Carousel.vue） */
                <div className="dec-pc-product__carousel">
                  {chunk(products, 3).map((group, groupIndex) => (
                    <div className="dec-pc-product__carousel-page" key={groupIndex}>
                      {group.map((product) => (
                        <ShopProductCard
                          key={product.productSn || product.productId}
                          product={product as any}
                          module={module}
                          variant="slide"
                          outWidth="33.3%"
                          styleMap={styleMap}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              ) : cardStyle === 5 || cardStyle === 6 ? (
                /* style=5 横排 / style=6 横向滑动（源码 OneRowProductX.vue direction） */
                <div className={`dec-pc-product__row${cardStyle === 6 ? ' is-slide' : ''}`}>
                  {products.map((product, index) => (
                    <ShopProductCard
                      key={product.productSn || product.productId || index}
                      product={product as any}
                      module={module}
                      variant={cardStyle === 5 ? 'land' : 'slide'}
                      styleMap={styleMap}
                    />
                  ))}
                </div>
              ) : (
                /* style=1/2/3：一行 N 个竖排卡片（源码 OneRowProductX.vue 默认方向） */
                <div className="dec-pc-product__list">
                  {products.map((product, index) => (
                    <div className="dec-pc-product__item" key={product.productSn || product.productId || index}>
                      <ShopProductCard product={product as any} module={module} variant="standard" styleMap={styleMap} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}

/* ======================= 3. pc-home-quick-nav ======================= */

/** PcQuickNav.vue：items[]（picTitle/picThumb/picUrl/picLink）、style{containerAlign,itemGap,
 * singleLine,fontSize,textColor,hoverColor,fontWeight,lineHeight,iconSize,iconGap}、frame。 */
function QuickNav({ module }: ModuleProps) {
  const items: any[] = Array.isArray(module.items) ? module.items : [];
  if (!items.length) return null;
  const frame = module.frame || {};
  const style = module.style || {};
  const align = Number(style.containerAlign ?? 1);
  const cssVars: Record<string, any> = {
    '--dec-box-padding': `${px(frame.boxPadding)}px`,
    '--dec-box-padding-top': `${px(frame.boxPaddingTop)}px`,
    '--dec-box-padding-bottom': `${px(frame.boxPaddingBottom)}px`,
    '--dec-box-radius': `${px(frame.boxRadius)}px`,
    '--dec-bg-color': frame.backgroundColor ?? 'transparent',
    '--dec-font-size': `${px(style.fontSize, 14)}px`,
    '--dec-text-color': style.textColor ?? '#333333',
    '--dec-hover-color': themeAwareColor(style.hoverColor, 'var(--pc-primary)'),
    '--dec-container-justify': align === 2 ? 'center' : align === 3 ? 'flex-end' : 'flex-start',
    '--dec-item-gap': `${px(style.itemGap, 16)}px`,
    '--dec-single-line': Number(style.singleLine ?? 0) === 1 ? 'nowrap' : 'wrap',
    '--dec-font-weight': style.fontWeight ?? 400,
    '--dec-line-height': `${px(style.lineHeight, 36)}px`,
    '--dec-icon-size': `${px(style.iconSize, 18)}px`,
    '--dec-icon-gap': `${px(style.iconGap, 6)}px`,
  };
  return (
    <div className="dec-pc-home-quick-nav" style={cssVars}>
      <div className="nav_container fs_mod">
        {items.map((item, index) => (
          <a
            key={item.picId ?? index}
            className="dec-pc-home-quick-nav__item"
            href={navHref(item.picLink) || '#'}
            target="_blank"
            rel="noreferrer"
            title={item.picTitle ?? ''}
          >
            {picSrc(item) ? <img className="dec-pc-home-quick-nav__icon" src={picSrc(item)} alt="" loading="lazy" /> : null}
            {item.picTitle ? <span className="dec-pc-home-quick-nav__text">{item.picTitle}</span> : null}
          </a>
        ))}
      </div>
    </div>
  );
}

/* ======================= 4. pc-category-nav ======================= */

/** PcCategoryNavWrapper.vue → CategoryNew.vue：frame 只做容器背景/圆角/边距；
 * 内容层 .mod_seckill 用 module.backgroundColor；showTitle、displayNum/rowNum(1~10)、
 * 热门分类取自 /api/category/category/hot（categoryPic/categoryName/seoLink/categoryId）。 */
function CategoryNav({ module }: ModuleProps) {
    const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const cateListRef = useRef<HTMLDivElement | null>(null);
  const frame = module.frame || {};
  const radius = px(frame.boxRadius);
  const showTitle = Number(module.showTitle ?? 1) !== 0;
  const displayNum = Math.min(10, Math.max(1, px(module.displayNum ?? module.rowNum, 6)));

  useEffect(() => {
    let cancelled = false;
    fetch('/api/category/category/hot')
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return;
        const list = json?.data?.records || json?.data || json?.records || [];
        setCategories(Array.isArray(list) ? list : []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div
      className="dec-category-nav-wrapper"
      style={{
        backgroundColor: frame.backgroundColor || 'transparent',
        borderRadius: `${radius}px`,
        overflow: radius ? 'hidden' : undefined,
        paddingLeft: px(frame.boxPadding),
        paddingRight: px(frame.boxPadding),
        paddingTop: px(frame.boxPaddingTop),
        paddingBottom: px(frame.boxPaddingBottom),
      }}
    >
      <div className="dec-category-nav-wrapper__inner">
        {categories.length ? (
          <div className="mod_seckill" style={{ backgroundColor: module.backgroundColor || undefined }}>
            {showTitle ? (
              <div className="seckill-top">
                <div className="seckill-title">{module.titleName || t('热门分类')}</div>
              </div>
            ) : null}
            <div className="seckill_list_wrap">
              <SwiperNav visible={categories.length > displayNum} onPrev={() => cateListRef.current?.scrollBy({ left: -cateListRef.current.clientWidth * 0.6, behavior: 'smooth' })} onNext={() => cateListRef.current?.scrollBy({ left: cateListRef.current.clientWidth * 0.6, behavior: 'smooth' })} />
              <div
                className={`seckill_list${categories.length > displayNum ? ' is-scroll' : ''}`}
                ref={cateListRef}
                style={categories.length > displayNum ? undefined : { gridTemplateColumns: `repeat(${displayNum}, minmax(0, 1fr))` }}
              >
                {categories.map((item, index) => (
                  <div
                    className="proditem"
                    key={item.categoryId ?? index}
                    style={
                      categories.length > displayNum
                        ? { flex: `0 0 calc((100% - ${(displayNum - 1) * 12}px) / ${displayNum})` }
                        : undefined
                    }
                  >
                    <a
                      href={item.seoLink || `/list?categoryId=${item.categoryId ?? ''}`}
                      target="_blank"
                      rel="noreferrer"
                      title={item.categoryName || ''}
                    >
                      <div className="seckill-item-image">
                        {item.categoryPic ? <img className="pro_pic" src={item.categoryPic} alt={item.categoryName || ''} loading="lazy" /> : <div className="seckill-img-placeholder" />}
                      </div>
                      <div className="seckill-item__name">{item.categoryName}</div>
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* ======================= 5. pc-home-hero ======================= */

const HERO_GRADIENT_DIR = { upDown: 'to bottom', leftRight: 'to right', diagonal: 'to bottom right' } as Record<string, string>;
// 原为 #FF4E4E / #E1251B 硬编码红色渐变，改为跟随后台主题色与其深色阶
const HERO_DEFAULT_SUBTITLE_A = 'var(--pc-primary)';
const HERO_DEFAULT_SUBTITLE_B = 'var(--primary-dark-2)';

/**
 * 后台装修数据里的「旧默认红」兼容层。
 *
 * 旧版前端把品牌红 #FF4E4E / #E1251B 写死成各类颜色项的默认值；后台装修保存时，
 * 这份默认值被一并持久化进 decorate JSON。线上 pcIndex 实测命中：
 *   快捷导航.style.hoverColor、营销通栏.style.priceColor、
 *   营销通栏.center.modules[].moduleSubTitleBgColorA/B、products[].labelBgColorA/B、
 *   营销通栏.right.shopsSubTitleBg。
 * 结果就是后台把主题色改成青绿后，角标 / HOT 标签 / 价格 / hover 仍然是红的。
 *
 * 这里把「恰好等于旧默认红」视为「从未自定义」，改用主题变量；
 * 后台若确实要红色，选一个不等于这些值的红即可正常生效。
 * 注意：不含 #ff4d4f —— 那是 Semi/Ant 的 error 红，属有意使用，不能改写。
 */
const LEGACY_BRAND_REDS = new Set(['#ff4e4e', '#e1251b', '#e60012', '#ff4141']);
function themeAwareColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string' || !value.trim()) return fallback;
  return LEGACY_BRAND_REDS.has(value.trim().toLowerCase()) ? fallback : value;
}
/** 旧名保留（角标专用），实现与 themeAwareColor 一致 */
const themeAwareBadgeColor = themeAwareColor;

/** PcHomeHero.vue：left{backgroundColor,textColor,showCount,categories}（前台实际取 allCate API，
 * 本栈用配置分类兜底）、center{banners,modules[6]}（modal 0-1 推荐位、2-5 频道卡）、
 * right{user,userCardBackground,userCardGradientColorA/B/Type,premiumMember,shortcuts,
 * shopsTitle,shopsSubTitle,shopsSubTitleBg,shopsMoreText,shopsMoreLink,shopsTextColor}、style{...}。 */
function HomeHero({ module }: ModuleProps) {
    const { t } = useTranslation();
  const left = module.left || {};
  const center = module.center || {};
  const right = module.right || {};
  const style = module.style || {};
  const banners: any[] = Array.isArray(center.banners) ? center.banners : [];
  const rawModules: any[] = Array.isArray(center.modules) ? center.modules : [];
  const shortcuts: any[] = Array.isArray(right.shortcuts) ? right.shortcuts : [];
  const showCount = Math.max(0, px(left.showCount, 12));

  const cards = [...rawModules];
  while (cards.length < 6) cards.push({});
  const allCards = cards.slice(0, 6);

  /* 旧版 fetchGroupProducts：卡位配置 productSource=productGroup 时按分组拉商品（size=2），
     拉到结果后替换该卡位的 products（admin PcHomeHeroPreview 支持该配置）。 */
  const [groupProductsMap, setGroupProductsMap] = useState<Record<number, any[]>>({});
  const groupCardKeys = allCards.map((c) => `${c.productSource}-${c.productGroupId}`).join('|');
  useEffect(() => {
    let cancelled = false;
    allCards.forEach((card, idx) => {
      if (card.productSource === 'productGroup' && card.productGroupId) {
        const params = new URLSearchParams({ page: '1', size: '2', productGroupId: String(card.productGroupId) });
        fetch(`/api/product/product/list?${params.toString()}`)
          .then((response) => response.json())
          .then((json) => {
            if (cancelled) return;
            const records = json?.data?.records || json?.records || [];
            setGroupProductsMap((current) => ({ ...current, [idx]: Array.isArray(records) ? records : [] }));
          })
          .catch(() => {
            if (!cancelled) setGroupProductsMap((current) => ({ ...current, [idx]: [] }));
          });
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupCardKeys]);

  // 旧版 enhancedModules：商品分组卡位使用拉取到的商品数据（pic 包装成 {picUrl,picThumb,picLarge}）
  const enhancedCards = allCards.map((card, idx) => {
    const fetched = groupProductsMap[idx];
    if (card.productSource === 'productGroup' && Array.isArray(fetched) && fetched.length) {
      return {
        ...card,
        products: fetched.map((item: any) => ({
          ...item,
          pic: { picUrl: item.picUrl || '', picThumb: item.picThumb || '', picLarge: item.picLarge || '' },
        })),
      };
    }
    return card;
  });
  const promoCards = enhancedCards.slice(0, 2);
  const productCards = enhancedCards.slice(2, 6);

  /* 旧版依赖 commonStore.shopRegClosed / shopName：注册入口开关与未登录欢迎语（/api/common/config/base） */
  const [shopRegClosed, setShopRegClosed] = useState<number>(0);
  const [siteName, setSiteName] = useState<string>('');
  useEffect(() => {
    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => {
        setShopRegClosed(Number(json?.data?.shopRegClosed ?? 0));
        setSiteName(String(json?.data?.shopName || ''));
      })
      .catch(() => undefined);
  }, []);

  /* ---- 左侧类目：对齐旧版 PcHomeHero.displayCategories —— 只取分类楼层接口（commonStore.allCate），
     装修配置的 left.categories 在原版并不参与渲染。若用配置兜底，首屏会先闪出配置里的示例分类
     （「女装 / 男装 / 内衣」等），拿到接口数据后才被替换。 */
  const apiCatItems = useHeroCatItems();
  const displayCategories: HeroCatItem[] = apiCatItems.slice(0, showCount);

  const leftRef = useRef<HTMLDivElement | null>(null);
  const hideTimer = useRef<number | null>(null);
  const [activeSub, setActiveSub] = useState<number | null>(null);
  const [subStyle, setSubStyle] = useState<Record<string, string>>({});

  const clearHideTimer = () => {
    if (hideTimer.current !== null) {
      window.clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  const syncSubPosition = () => {
    const el = leftRef.current;
    if (!el) return;
    setSubStyle(subCataFixedStyle(el.getBoundingClientRect()));
  };

  const showSubView = (index: number) => {
    clearHideTimer();
    setActiveSub(index);
    if (!displayCategories[index]?.catList?.length) {
      setSubStyle({});
      return;
    }
    syncSubPosition();
  };

  const scheduleHideSubView = () => {
    clearHideTimer();
    hideTimer.current = window.setTimeout(() => {
      setActiveSub(null);
      setSubStyle({});
    }, 100);
  };

  useEffect(() => {
    if (activeSub === null) return undefined;
    const onViewportChange = () => syncSubPosition();
    window.addEventListener('scroll', onViewportChange, { passive: true });
    window.addEventListener('resize', onViewportChange);
    return () => {
      window.removeEventListener('scroll', onViewportChange);
      window.removeEventListener('resize', onViewportChange);
    };
  }, [activeSub]);

  useEffect(() => () => clearHideTimer(), []);

  const activeFloor = activeSub !== null ? displayCategories[activeSub] : undefined;

  /* ---- 右侧会员信息：旧版 useUserStore（登录后展示资产） ---- */
  const profile = useUserProfile();
  const authed = Boolean(profile);
  const profileName = String(profile?.nickname || profile?.dimUsername || profile?.username || '');
  const userDisplayName = authed ? profileName || t('会员') : right.user?.nickname || (siteName ? t('欢迎来{name}！', { name: siteName }) : t('欢迎来商城！'));
  const userAvatarSrc = authed ? String(profile?.avatar || '') : picSrc(right.user?.avatar);
  const assetNumber = (value: unknown): string => {
    const num = Number(value ?? 0);
    if (!Number.isFinite(num)) return '0';
    return num >= 10000 ? `${(num / 10000).toFixed(1)}万` : String(num);
  };
  const assetMoney = (value: unknown): string => {
    const num = Number(value ?? 0);
    return Number.isFinite(num) ? num.toFixed(2) : '0.00';
  };
  const needWideAssets = assetMoney(profile?.balance).length >= 7 || assetNumber(profile?.points).length >= 7;

  const { index: bannerIndex, setIndex: setBannerIndex, setPaused: setBannerPaused } = useCarousel(banners.length, 4500);
  const bannerSwipe = useSwipeDrag(bannerIndex, banners.length, setBannerIndex);

  const gradientDirection = HERO_GRADIENT_DIR[String(right.userCardGradientType || 'upDown')] || 'to bottom';
  const userCardGradient = right.userCardGradientColorA && right.userCardGradientColorB
    ? `linear-gradient(${gradientDirection}, ${right.userCardGradientColorA}, ${right.userCardGradientColorB})`
    : 'none';
  const premiumMember = right.premiumMember || {};
  const premiumShow = [true, 1, '1', 'true'].includes(premiumMember.show);
  const shops = {
    title: right.shopsTitle || t('店铺街'),
    subTitle: right.shopsSubTitle || '',
    subTitleBg: themeAwareBadgeColor(right.shopsSubTitleBg, 'var(--pc-primary)'),
    moreText: right.shopsMoreText || t('查看全部'),
    moreLink: right.shopsMoreLink,
    textColor: right.shopsTextColor || '#a06a38',
  };
  const subTitleBg = (card: any): string => {
    const colorA = card.moduleSubTitleBgColorA;
    const colorB = card.moduleSubTitleBgColorB;
    if (colorA && colorB) {
      return `linear-gradient(${HERO_GRADIENT_DIR[card.moduleSubTitleBgType || 'leftRight'] || 'to right'}, ${themeAwareBadgeColor(colorA, HERO_DEFAULT_SUBTITLE_A)}, ${themeAwareBadgeColor(colorB, HERO_DEFAULT_SUBTITLE_B)})`;
    }
    // 旧 getSubTitleBg：双渐变缺省时回落单色 moduleSubTitleBg
    if (card.moduleSubTitleBg) return card.moduleSubTitleBg;
    return `linear-gradient(to right, ${HERO_DEFAULT_SUBTITLE_A}, ${HERO_DEFAULT_SUBTITLE_B})`;
  };

  const cssVars: Record<string, any> = {
    '--dec-box-padding': `${px(module.frame?.boxPadding)}px`,
    '--dec-box-padding-top': `${px(module.frame?.boxPaddingTop)}px`,
    '--dec-box-padding-bottom': `${px(module.frame?.boxPaddingBottom)}px`,
    '--dec-box-radius': `${px(module.frame?.boxRadius)}px`,
    '--dec-bg-color': module.frame?.backgroundColor || 'transparent',
    '--dec-height': `${px(style.height, 336)}px`,
    '--dec-gap': `${px(style.gap, 16)}px`,
    '--dec-left-width': `${px(style.leftWidth, 220)}px`,
    '--dec-right-width': `${px(style.rightWidth, 260)}px`,
    '--dec-panel-bg': style.panelBackgroundColor || '#f5f6fa',
    '--dec-panel-radius': `${px(style.panelRadius, 8)}px`,
    '--dec-left-bg': left.backgroundColor ?? '#ffffff',
    '--dec-left-text-color': left.textColor ?? '#333333',
    '--dec-user-card-bg': right.userCardBackground || style.panelBackgroundColor || '#ffffff',
    '--dec-user-card-gradient': userCardGradient,
    '--dec-title-size': `${px(style.titleFontSize, 14)}px`,
    '--dec-title-color': style.titleColor ?? '#333333',
    '--dec-muted-color': style.mutedColor ?? '#999999',
    '--dec-price-color': themeAwareColor(style.priceColor, 'var(--price)'),
    '--dec-banner-radius': `${px(style.bannerRadius, 12)}px`,
    '--dec-card-radius': `${px(style.cardRadius, 12)}px`,
    // 曾在此硬写 '--general': '#e1251b'，会把该模块子树内的主题色钉成红色，
    // 与后台「主题风格」冲突。--general 由 RootLayout 注入，此处不再覆盖。
  };

  const renderCardProducts = (card: any) => (
    <div className="dec-pc-home-hero__card-products">
      {Array.isArray(card.products) && card.products.length ? (
        card.products.slice(0, 2).map((product: any, index: number) => (
          <div
            className="dec-pc-home-hero__card-product"
            key={index}
            onClick={(event) => {
              event.stopPropagation();
              openLink(productDetailHref(product));
            }}
          >
            <div className="dec-pc-home-hero__card-img-box">
              <img className="dec-pc-home-hero__card-img" src={picSrc(product.pic)} alt={product.productName || ''} loading="lazy" />
              {product.label ? (
                <div
                  className="dec-pc-home-hero__card-label"
                  style={{
                    background: product.labelBgColorA && product.labelBgColorB
                      ? `linear-gradient(${HERO_GRADIENT_DIR[product.labelBgType || 'leftRight'] || 'to right'}, ${themeAwareColor(product.labelBgColorA, HERO_DEFAULT_SUBTITLE_A)}, ${themeAwareColor(product.labelBgColorB, HERO_DEFAULT_SUBTITLE_B)})`
                      : product.labelBg
                        ? product.labelBg
                        : `linear-gradient(to right, ${HERO_DEFAULT_SUBTITLE_A}, ${HERO_DEFAULT_SUBTITLE_B})`,
                    color: '#fff',
                  }}
                >
                  {product.label}
                </div>
              ) : null}
            </div>
            {card.showPrice !== 0 ? <div className="dec-pc-home-hero__card-price">{formatPrice(product.productPrice ?? product.price)}</div> : null}
          </div>
        ))
      ) : null}
    </div>
  );

  const renderSubCata = () => {
    if (!activeFloor || !activeFloor.catList.length || typeof document === 'undefined') return null;
    const nodes: Array<{ key: string; href: string; pic: string; name: string }> = [];
    activeFloor.catList.forEach((cat: any, catIndex: number) => {
      const children: any[] = Array.isArray(cat?.children) ? cat.children : [];
      if (children.length) {
        children.forEach((child: any, childIndex: number) => {
          nodes.push({
            key: `${catIndex}-${childIndex}`,
            href: resolveCatNodeHref(child, activeFloor.id),
            pic: String(child?.categoryPic || child?.pic || ''),
            name: String(child?.categoryName ?? child?.name ?? ''),
          });
        });
      } else if (cat?.categoryPic || cat?.pic || cat?.categoryName || cat?.name) {
        nodes.push({
          key: String(catIndex),
          href: resolveCatNodeHref(cat, activeFloor.id),
          pic: String(cat?.categoryPic || cat?.pic || ''),
          name: String(cat?.categoryName ?? cat?.name ?? ''),
        });
      }
    });
    return createPortal(
      <div
        className="dec-pc-home-hero__subCata is-positioned"
        style={subStyle}
        onMouseEnter={clearHideTimer}
        onMouseLeave={scheduleHideSubView}
      >
        <div className="dec-pc-home-hero__subView is-active">
          <div className="dec-pc-home-hero__sub-left">
            <div className="dec-pc-home-hero__nav_cata_bd">
              <div className="dec-pc-home-hero__img-grid">
                {nodes.map((node) => (
                  <a className="dec-pc-home-hero__img-item" key={node.key} href={node.href} target="_blank" rel="noreferrer">
                    <div className="dec-pc-home-hero__img-pic">
                      {node.pic ? <img src={node.pic} alt="" loading="lazy" /> : <div className="dec-pc-home-hero__img-placeholder" />}
                    </div>
                    <div className="dec-pc-home-hero__img-name">{node.name}</div>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    );
  };

  return (
    <div className={`dec-pc-home-hero${activeSub !== null ? ' is-cate-expanded' : ''}`} style={cssVars}>
      <div className="dec-pc-home-hero__layout">
        <section className="dec-pc-home-hero__panel dec-pc-home-hero__left" ref={leftRef}>
          <div className="dec-pc-home-hero__cate-area" onMouseLeave={scheduleHideSubView}>
            {displayCategories.length ? (
              <div className="dec-pc-home-hero__cate-list">
                {displayCategories.map((item, index) => (
                  <div
                    className={`dec-pc-home-hero__cate-item${activeSub === index ? ' is-active' : ''}`}
                    key={String(item.id || index)}
                    onMouseEnter={() => showSubView(index)}
                  >
                    <span className="dec-pc-home-hero__cate-icon" aria-hidden="true">
                      {item.iconFont ? <i className={item.iconFont} /> : null}
                    </span>
                    <div className="dec-pc-home-hero__cate-text">
                      <div className="dec-pc-home-hero__cate-title">
                        {item.catFloorNames.length ? (
                          item.catFloorNames.map((name, nameIndex) => (
                            <span key={`${name.categoryTitleName}-${nameIndex}`}>
                              <a className="dec-pc-home-hero__cate-link" href={name.link} target="_blank" rel="noreferrer">
                                {name.categoryTitleName}
                              </a>
                              {nameIndex < item.catFloorNames.length - 1 ? <span className="dec-pc-home-hero__cate-sep">/</span> : null}
                            </span>
                          ))
                        ) : (
                          <span className="dec-pc-home-hero__cate-link" onClick={() => openLink(item.entryLink)}>
                            {item.title || t('类目')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="dec-pc-home-hero__center">
          <div className="dec-pc-home-hero__center-top">
            <div className="dec-pc-home-hero__banner" onMouseEnter={() => setBannerPaused(true)} onMouseLeave={() => setBannerPaused(false)}>
              {banners.length ? (
                <div className="dec-pc-home-hero__banner-inner">
                  <div className={`dec-pc-home-hero__banner-viewport${bannerSwipe.dragging ? ' is-dragging' : ''}`} {...bannerSwipe.handlers}>
                    <div className="dec-pc-home-hero__banner-track" style={{ transform: `translateX(calc(-${bannerIndex * 100}% + ${bannerSwipe.offset}px))` }}>
                      {banners.map((banner, index) => (
                        <div className="dec-pc-home-hero__banner-slide" key={String(banner.picId ?? index)}>
                          <div className="dec-pc-home-hero__banner-link" onClick={() => openLink(banner.picLink)}>
                            <img className="dec-pc-home-hero__banner-img" src={picSrc(banner)} alt={banner.picTitle || ''} loading="lazy" />
                          </div>
                        </div>
                      ))}
                    </div>
                    {banners.length > 1 ? (
                      <div className="dec-pc-home-hero__banner-dots">
                        {banners.map((banner, index) => (
                          <span
                            key={String(banner.picId ?? index)}
                            className={`dec-pc-home-hero__banner-dot${index === bannerIndex ? ' is-active' : ''}`}
                            onClick={() => setBannerIndex(index)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="dec-pc-home-hero__promo-group">
              {promoCards.map((card, index) => (
                <div className="dec-pc-home-hero__panel dec-pc-home-hero__promo-card" key={index} onClick={() => openLink(card.link)}>
                  <div className="dec-pc-home-hero__card-header">
                    <div className="dec-pc-home-hero__card-title" title={card.moduleTitle || ''}>{card.moduleTitle || t('促销')}</div>
                    {card.moduleSubTitle ? (
                      <div className="dec-pc-home-hero__card-badge" style={{ background: subTitleBg(card) }}>{card.moduleSubTitle}</div>
                    ) : null}
                  </div>
                  {renderCardProducts(card)}
                </div>
              ))}
            </div>
          </div>

          <div className="dec-pc-home-hero__center-bottom">
            {productCards.length ? (
              <div className="dec-pc-home-hero__product-grid">
                {productCards.map((card, index) => (
                  <div className="dec-pc-home-hero__channel-card" key={index} onClick={() => openLink(card.link)}>
                    <div className="dec-pc-home-hero__card-header">
                      <div className="dec-pc-home-hero__card-title" title={card.moduleTitle || ''}>{card.moduleTitle || t('推荐')}</div>
                      {card.moduleSubTitle ? (
                        <div className="dec-pc-home-hero__card-badge" style={{ background: subTitleBg(card) }}>{card.moduleSubTitle}</div>
                      ) : null}
                    </div>
                    {renderCardProducts(card)}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section className="dec-pc-home-hero__right">
          <div className="dec-pc-home-hero__panel dec-pc-home-hero__user-card">
            {premiumShow ? (
              <div
                className={`dec-pc-home-hero__premium-member${premiumMember.description ? '' : ' is-title-only'}`}
                title={premiumMember.description || premiumMember.title}
                onClick={() => openLink(premiumMember.link)}
              >
                <span className="dec-pc-home-hero__premium-member-title">{premiumMember.title || t('会员')}</span>
                {premiumMember.description ? <span className="dec-pc-home-hero__premium-member-desc">{premiumMember.description}</span> : null}
              </div>
            ) : null}
            <div className={`dec-pc-home-hero__user-top${authed ? ' is-authed' : ''}${premiumShow ? ' has-premium-member' : ''}`}>
              <img className="dec-pc-home-hero__avatar" src={userAvatarSrc} alt="" />
              <div className="dec-pc-home-hero__user-info">
                <div className={`dec-pc-home-hero__user-name${authed ? ' is-authed' : ''}`} title={userDisplayName}>{userDisplayName}</div>
                <div className="dec-pc-home-hero__user-links">
                  {authed ? (
                    <>
                      <Link className="dec-pc-home-hero__user-link" href="/member/profile">{t('账号设置')}</Link>
                      <span className="divider" />
                      <Link className="dec-pc-home-hero__user-link" href="/member/address">{t('收货地址')}</Link>
                    </>
                  ) : (
                    <>
                      {/* 旧版：shopRegClosed===0 才显示「注册」；「入驻」仅 isMerchant/isStore，海外版该位为「登录」 */}
                      {shopRegClosed === 0 ? (
                        <>
                          <Link className="dec-pc-home-hero__user-link" href="/register">{t('注册')}</Link>
                          <span className="divider" />
                        </>
                      ) : null}
                      <Link className="dec-pc-home-hero__user-link" href="/member/login">{t('登录')}</Link>
                    </>
                  )}
                </div>
              </div>
            </div>

            {authed ? (
              <div className={`dec-pc-home-hero__user-assets${needWideAssets ? ' dec-pc-home-hero__user-assets--wide' : ''}`}>
                <Link className="dec-pc-home-hero__asset-item" href="/member/coupon" title={t('优惠券 {n}', { n: assetNumber(profile?.coupon) })}>
                  <div className="dec-pc-home-hero__asset-num">{assetNumber(profile?.coupon)}</div>
                  <div className="dec-pc-home-hero__asset-label">{t('优惠券')}</div>
                </Link>
                <Link className="dec-pc-home-hero__asset-item" href="/member/balance" title={t('余额 ¥{n}', { n: assetMoney(profile?.balance) })}>
                  <div className="dec-pc-home-hero__asset-num">{assetMoney(profile?.balance)}</div>
                  <div className="dec-pc-home-hero__asset-label">{t('余额')}</div>
                </Link>
                <Link className="dec-pc-home-hero__asset-item" href="/member/points" title={t('积分 {n}', { n: assetNumber(profile?.points) })}>
                  <div className="dec-pc-home-hero__asset-num">{assetNumber(profile?.points)}</div>
                  <div className="dec-pc-home-hero__asset-label">{t('积分')}</div>
                </Link>
              </div>
            ) : (
              <>
                <div className="dec-pc-home-hero__user-desc">
                  <div className="title">{right.user?.welcomeText || t('登录后更多精彩')}</div>
                  <div className="subtitle">{t('一键登录，福利好物全拥有')}</div>
                </div>
                <Link className="dec-pc-home-hero__login-btn" href="/member/login">{t('立即登录')}</Link>
              </>
            )}

            <div className="dec-pc-home-hero__user-actions">
              <Link className="dec-pc-home-hero__action-item" href="/member/order">
                <i className="dec-pc-home-hero__action-icon dec-pc-home-hero__action-icon--order" />
                <span>{t('我的订单')}</span>
              </Link>
              <Link className="dec-pc-home-hero__action-item" href="/member/browsinghistory">
                <i className="dec-pc-home-hero__action-icon dec-pc-home-hero__action-icon--history" />
                <span>{t('浏览记录')}</span>
              </Link>
              <Link className="dec-pc-home-hero__action-item" href="/member/favorite">
                <i className="dec-pc-home-hero__action-icon dec-pc-home-hero__action-icon--wish" />
                <span>{t('心愿单')}</span>
              </Link>
              <Link className="dec-pc-home-hero__action-item" href="/member/collectshop">
                <i className="dec-pc-home-hero__action-icon dec-pc-home-hero__action-icon--shop" />
                <span>{t('关注店铺')}</span>
              </Link>
            </div>
          </div>

          <div className="dec-pc-home-hero__panel dec-pc-home-hero__shops">
            <div className="dec-pc-home-hero__shops-header">
              <div className="title">
                {shops.title}
                {shops.subTitle ? <span className="hot" style={{ background: shops.subTitleBg }}>{shops.subTitle}</span> : null}
              </div>
              <div className="more" onClick={() => openLink(shops.moreLink)}>
                {shops.moreText}
                <i className="more-icon" aria-hidden />
              </div>
            </div>
            {shortcuts.length ? (
              <div className="dec-pc-home-hero__shop-list">
                {shortcuts.map((shortcut, index) => (
                  <div className="dec-pc-home-hero__shop-item" key={String(shortcut.picId ?? index)} onClick={() => openLink(shortcut.picLink)}>
                    <div className="dec-pc-home-hero__shop-img-box">
                      <img className="dec-pc-home-hero__shop-icon" src={picSrc(shortcut)} alt="" loading="lazy" />
                    </div>
                    <span className="dec-pc-home-hero__shop-enter" style={{ color: shops.textColor }}>{shortcut.picTitle || t('进入店铺')}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      </div>
      {renderSubCata()}
    </div>
  );
}

/* ======================= 6. pc-home-coupon ======================= */

/** PcCoupon.vue：itemPadding、frame{boxPaddingTop,boxPaddingBottom,boxPadding,backgroundColor,boxRadius 默认 8}、
 * showTitle==1、title、desc、titleColor；内部委托 home/Coupon.vue（/api/home/home/getCoupon）。 */
function Coupon({ module }: ModuleProps) {
    const { t } = useTranslation();
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const frame = module.frame || {};
  const containerModule = {
    boxPaddingTop: frame.boxPaddingTop ?? 0,
    boxPaddingBottom: frame.boxPaddingBottom ?? 0,
    boxPadding: frame.boxPadding ?? 0,
    backgroundColor: frame.backgroundColor ?? 'transparent',
    boxRadius: frame.boxRadius ?? 8,
  };
  const showTitle = Number(module.showTitle) === 1;

  const load = () => {
    setLoading(true);
    apiGet<any>('home/home/getCoupon')
      .then((data) => {
        const list = Array.isArray(data) ? data : (data as any)?.records ?? [];
        setCoupons(Array.isArray(list) ? list.slice(0, 4) : []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const claim = async (coupon: any) => {
    if (!isLoggedIn()) {
      goLogin();
      return;
    }
    const couponId = Number(coupon?.couponId ?? 0);
    setClaimingId(couponId);
    try {
      await apiPost('user/coupon/claim', { couponId });
      showToast('success', '领取成功');
      load();
    } catch (error) {
      showToast('error', errorText(error));
    } finally {
      setClaimingId(null);
    }
  };

  // 旧 components/home/Coupon.vue couponStatus 三态口径：
  // limitNum=0：已领取 / 再次领取(已领过未限量) / 马上领；limitNum>0：马上领 / 已领取(抢光) / 再次领取
  const statusText = (coupon: any): string => {
    const limit = Number(coupon?.limitNum ?? 0);
    const received = Number(coupon?.receiveNum ?? 0);
    if (limit === 0) {
      if (Number(coupon?.isReceive) === 1) return '已领取';
      if (received > 0) return '再次领取';
      return '马上领';
    }
    if (Number(coupon?.isReceive) === 0) return '马上领';
    if (received >= limit) return '已领取';
    return '再次领取';
  };
  // 旧 onSubmit 只拦「已领取」，其余状态（含再次领取）均可领取
  const claimable = (coupon: any): boolean => statusText(coupon) !== '已领取';

  if (loading || !coupons.length) return null;

  return (
    <div style={{ padding: px(module.itemPadding) }}>
      <Container module={containerModule} className="module-ad-con module-pc-coupon">
        {showTitle ? (
          <div className="dec-pc-coupon__header">
            <div className="dec-pc-coupon__header-title" style={{ color: module.titleColor ?? '#2a3145' }}>{module.title || ''}</div>
            {module.desc ? <div className="dec-pc-coupon__header-desc">{module.desc}</div> : null}
          </div>
        ) : null}
        <div className="mod_coupon">
          <div className="coupon_tit">
            <Link href="/coupon/list" target="_blank">
              <h4>{t('领券中心')}</h4>
              <p className="en_tit">COUPON</p>
              <p className="go_coupon">GO <em>&gt;&gt;</em></p>
            </Link>
            <div className="coupon_edge" />
          </div>
          <div className="coupon_list">
            {coupons.map((coupon, index) => (
              <div className="item" key={coupon.couponId ?? index}>
                <div className="coupon_detail">
                  <div className="price">
                    {Number(coupon.couponType) === 2 ? (
                      <div className="coupon_discount">{coupon.couponDiscount}<span>{t('折')}</span></div>
                    ) : (
                      <b>¥{Number(coupon.couponMoney || 0).toFixed(0)}</b>
                    )}
                  </div>
                  <div className="direction">
                    <p className="coupon_sort">{coupon.couponName}</p>
                    <p>{coupon.couponDesc}</p>
                  </div>
                </div>
                <p
                  className={`use_btn${claimable(coupon) ? '' : ' is-disabled'}${claimingId === Number(coupon.couponId) ? ' is-loading' : ''}`}
                  aria-disabled={!claimable(coupon) || claimingId !== null}
                  onClick={() => {
                    if (!claimable(coupon) || claimingId !== null) return;
                    void claim(coupon);
                  }}
                >
                  {claimingId === Number(coupon.couponId) ? t('领取中') : statusText(coupon)}<em>&nbsp;&gt;</em>
                </p>
                <div className="coupon_edge" />
              </div>
            ))}
            <div className="more_coupon">
              <Link href="/coupon/list" target="_blank">{t('查看更多')}</Link>
            </div>
          </div>
        </div>
      </Container>
    </div>
  );
}

/* ======================= 7. pc-home-seckill ======================= */

/** PcSeckillLegacy.vue 字段：frame{boxPadding,boxPaddingTop,boxPaddingBottom,leftAndRightPadding,
 * backgroundColor,boxRadius}、style(1→4列/2→5列/6→横向6列，默认6)、showName/showPrice、goodsGap/goodsPadding、
 * buyBtnStyle、textAlign/textWeight/goodsNamePadding、title{showTitle,titleStyle,titleText,descText,descColor,
 * titleColor,titleRadius,titlePaddingTop,titlePaddingBottom,titleBackground,titleBackground2,titleBackgroundPic,
 * showMore,moreLink,moreColor,countdownLabel}、backgroundColor/boxRadius、seckillTitle（旧字段兼容）。 */
function Seckill({ module }: ModuleProps) {
    const { t } = useTranslation();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const seckillScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch('/api/home/home/getSeckill?page=1&size=10')
      .then((response) => response.json())
      .then((json) => {
        const list = json?.data?.records || json?.records || [];
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const first = products[0];
  const endTimeRaw = first?.seckkillData?.seckillEndTime || first?.seckillEndTime || '';
  const endTime = endTimeRaw ? new Date(endTimeRaw).getTime() : 0;
  useEffect(() => {
    if (!endTime) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endTime]);

  if (loading || !products.length) return null;

  const title = module.title || {};
  const showTitle = Number(title.showTitle ?? 1) === 1;
  const titleText = title.titleText ?? module.seckillTitle ?? t('限时秒杀');
  const style = Number(module.style ?? 6);
  const showName = module.showName !== 0 && module.showName !== false;
  const showPrice = module.showPrice !== 0 && module.showPrice !== false;
  const goodsGap = px(module.goodsGap ?? module.goodsPadding, 10);
  /* 旧 getItemWidth：style1=25%（4个/行）、style2=20%（5个/行）、其余（3/4/7…）默认 25%，
     style 6 才是横向 swiper */
  const columns = style === 1 ? 4 : style === 2 ? 5 : 4;
  const remaining = endTime && now ? Math.max(0, endTime - now) : 0;
  const countdown = now && remaining > 0
    ? `${String(Math.floor(remaining / 3600000)).padStart(2, '0')}:${String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`
    : '';
  const titleBg = title.titleBackground2
    ? `linear-gradient(to right, ${title.titleBackground || ''}, ${title.titleBackground2})`
    : title.titleBackground || '';
  const frame = module.frame || {};
  const frameStyle: Record<string, any> = {
    paddingLeft: px(frame.boxPadding),
    paddingRight: px(frame.boxPadding),
    marginTop: px(frame.boxPaddingTop),
    marginBottom: px(frame.boxPaddingBottom),
    '--seckill-content-padding-x': `${px(frame.leftAndRightPadding ?? module.innerPadding)}px`,
    backgroundColor: frame.backgroundColor || module.backgroundColor || '#fafafa',
    borderRadius: `${px(frame.boxRadius ?? module.boxRadius)}px`,
    overflow: px(frame.boxRadius ?? module.boxRadius) ? 'hidden' : undefined,
  };

  return (
    <div className="module-seckill-goods_ad-wrapper">
      <div
        className={`module-ad-con module-goods_ad module-seckill-goods_ad ad-style__${style} ad-buy_btn_style__${px(module.buyBtnStyle, 3)} ad-goods_style__${module.goodsStyle ?? 1} ad-goods_radio_style__${module.goodsRadioStyle ?? 1} ad-goods_name_row__${module.goodsNameRow ?? 1} ad-text_align__${module.textAlign ?? 1} ad-text_weight__${module.textWeight} ad-goods_name_padding__${module.goodsNamePadding} ad-goods-title_style__${title.titleStyle}`}
        style={frameStyle}
      >
        <div className="module-ad-content">
          <div className="mod_seckill">
            {showTitle ? (
              <div
                className="seckill-top"
                style={{
                  background: titleBg || undefined,
                  borderTopLeftRadius: px(title.titleRadius) ? `${px(title.titleRadius)}px` : '',
                  borderTopRightRadius: px(title.titleRadius) ? `${px(title.titleRadius)}px` : '',
                  paddingTop: `${px(title.titlePaddingTop, 20)}px`,
                  paddingBottom: `${px(title.titlePaddingBottom, 20)}px`,
                }}
              >
                <div className="seckill-title-wrapper">
                  {Number(title.titleStyle) === 3 ? <div className="line" /> : null}
                  {title.titleBackgroundPic?.picUrl ? (
                    <img className="image-size" src={title.titleBackgroundPic.picUrl} alt="" />
                  ) : null}
                  <div className="seckill-title" style={{ color: title.titleColor || '#1a1a1a' }}>{titleText}</div>
                  {title.descText ? (
                    <div className={`seckill-desc ${Number(title.titleStyle) === 2 ? 'big-sm' : 'sm'}`} style={{ color: title.descColor || '#1a1a1a' }}>
                      {title.descText}
                    </div>
                  ) : null}
                </div>
                <div className="seckill-top-right" style={{ color: title.moreColor || '#1a1a1a' }}>
                  {Number(title.showMore) === 1 ? (
                    <a className="seckill-more" href={navHref(title.moreLink) || '/seckill/list'}>{title.moreLink?.title || t('更多')}<i className="iconfont-pc icon-login-jt" /></a>
                  ) : null}
                  {countdown ? (
                    <div className="seckill-count-down">
                      <div className="countdown-box">
                        <span className="countdown-text">{title.countdownLabel || t('距结束')}:</span>
                        <span className="countdown-item">{countdown.split(':')[0]}</span>
                        <span className="countdown-separator-text">:</span>
                        <span className="countdown-item">{countdown.split(':')[1]}</span>
                        <span className="countdown-separator-text">:</span>
                        <span className="countdown-item">{countdown.split(':')[2]}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className={`goods-ad-warp${style === 6 ? ' has-nav' : ''}`}>
              <SwiperNav
                visible={style === 6 && products.length > 6}
                onPrev={() => seckillScrollRef.current?.scrollBy({ left: -seckillScrollRef.current.clientWidth * 0.6, behavior: 'smooth' })}
                onNext={() => seckillScrollRef.current?.scrollBy({ left: seckillScrollRef.current.clientWidth * 0.6, behavior: 'smooth' })}
              />
              <div
                className={`goods-ad-con${style === 6 ? ' is-swiper' : ''}`}
                ref={seckillScrollRef}
                style={{ gap: `${goodsGap}px`, gridTemplateColumns: style === 6 ? undefined : `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {products.map((product, index) => (
                  <div className="proditem goods-ad-item" key={product.productId ?? index}>
                    <div className="item-content">
                      <div className="item-con">
                        <Link href={product.seoLink || `/product/${product.productId ?? ''}`} target="_blank" className="item-image-a" title={product.productName}>
                          <div className="seckill-item-image-wrapper">
                            <div className="item-photo seckill-item-image">
                              <img className="item-image pro_pic" src={product.picUrl || product.picThumb || ''} alt={product.productName || ''} loading="lazy" />
                            </div>
                            {(product.productPrice || (product as any).marketPrice) ? (
                              <div className="seckill-item-discount">
                                {/* 旧 getDiscount：基准价优先 productPrice，回退 marketPrice */}
                                优惠{Math.max(0, Math.round((1 - Number(product.seckillPrice || 0) / Number(product.productPrice || (product as any).marketPrice || 1)) * 100))}%
                              </div>
                            ) : null}
                          </div>
                        </Link>
                        <div className="item-info" style={{ padding: Number(module.goodsNamePadding) === 1 ? '0 10px' : undefined }}>
                          {showName ? <div className="item-name seckill-item__name" style={{ textAlign: Number(module.textAlign) === 2 ? 'center' : 'left' }}>{product.productName}</div> : null}
                        </div>
                        {showPrice ? (
                          <div className="price-container">
                            <div className="seckill-item__price">
                              <div className="price-stack">
                                <span className="price price-miaosha">{formatPrice(product.seckillPrice ?? product.productPrice)}</span>
                                {Number(product.productPrice || product.marketPrice) > 0 ? <s className="price price-origin">{formatPrice(product.productPrice ?? product.marketPrice)}</s> : null}
                              </div>
                            </div>
                            <div className="buy-container">
                              <div className="buy">
                                <button
                                  type="button"
                                  className={`view_detail${productSoldOut(product) ? ' disabled' : ''}`}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void buyProduct(product, { isQuick: 0 });
                                  }}
                                >
                                  <i className="iconfont-pc icon-tianjia" />
                                </button>
                              </div>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================= 8. pc-home-groupon ======================= */

/** PcGrouponLegacy.vue 字段：grouponActivityItem.grouponPromotionId（必填才取数）、
 * style(1→3列/2→4列/3→5列/4→6列/6 横向6列，默认4)、goodsPadding、innerPadding、boxPadding/Top/Bottom、
 * backgroundColor/boxRadius、showName(==1)/showPrice(==1)、cardStyle、textAlign、textWeight、buyBtnStyle、
 * title{...同 Seckill}。数据 /api/promotion/groupon/itemList。 */
function Groupon({ module }: ModuleProps) {
    const { t } = useTranslation();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);
  const grouponScrollRef = useRef<HTMLDivElement | null>(null);

  const promotionId = module?.grouponActivityItem?.grouponPromotionId ? String(module.grouponActivityItem.grouponPromotionId) : '';

  useEffect(() => {
    if (!promotionId) {
      setLoading(false);
      return undefined;
    }
    let cancelled = false;
    fetch(`/api/promotion/groupon/itemList?page=1&size=20&grouponPromotionId=${encodeURIComponent(promotionId)}`)
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return;
        const list = json?.data?.records || json?.records || [];
        setItems(Array.isArray(list) ? list : []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promotionId]);

  const parseTime = (value: unknown): number => {
    if (value === undefined || value === null || value === '') return 0;
    const ms = new Date(String(value).replace(/-/g, '/')).getTime();
    return Number.isFinite(ms) ? ms : 0;
  };
  const notEnded = items.filter((item) => parseTime(item.endTime) >= Date.now());
  const topTime = notEnded.length ? Math.min(...notEnded.map((item) => parseTime(item.endTime)).filter((t) => t > 0)) : 0;

  useEffect(() => {
    if (!topTime) return undefined;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [topTime]);

  if (loading || !notEnded.length) return null;

  const title = module.title || {};
  const showTitle = Number(title.showTitle ?? 0) === 1;
  const titleStyleRaw = Number(module.style ?? 4);
  const style = titleStyleRaw === 1 ? 3 : titleStyleRaw;
  const columns = style === 2 ? 4 : style === 3 ? 5 : style === 4 ? 6 : style === 6 ? 6 : 4;
  const goodsPadding = px(module.goodsPadding);
  const showName = Number(module.showName) === 1;
  const showPrice = Number(module.showPrice) === 1;
  const remaining = topTime && now ? Math.max(0, topTime - now) : 0;
  const countdown = now && remaining > 0
    ? `${String(Math.floor(remaining / 3600000)).padStart(2, '0')}:${String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`
    : '';
  const titleBg = title.titleBackground2
    ? `linear-gradient(to right, ${title.titleBackground || ''}, ${title.titleBackground2})`
    : title.titleBackground || '';
  const radius = px(module.boxRadius);
  const shellStyle: Record<string, any> = {
    backgroundColor: module.backgroundColor || undefined,
    borderRadius: radius ? `${radius}px` : undefined,
    overflow: radius ? 'hidden' : undefined,
    marginLeft: px(module.boxPadding),
    marginRight: px(module.boxPadding),
    marginTop: px(module.boxPaddingTop),
    marginBottom: px(module.boxPaddingBottom),
    padding: px(module.innerPadding) ? `0 ${px(module.innerPadding)}px` : undefined,
  };
  const minGroupNum = (item: any): number => {
    if (!item?.groupNum) return 0;
    try {
      const groups = JSON.parse(item.groupNum);
      return Array.isArray(groups) && groups.length ? Math.min(...groups.map((g: any) => Number(g.groupNum) || 0)) : 0;
    } catch {
      return 0;
    }
  };

  /* 旧 cardStyle=1：图下「拼团」倒计时条（未开始显示距开始），文本格式 X天 HH:MM:SS */
  const isCardStyle1 = Number(module.cardStyle) === 1;
  const cardCountdownText = (item: any): string => {
    const current = now || Date.now();
    const start = parseTime(item.startTime);
    const started = !(start > current);
    const target = started ? parseTime(item.endTime) : start;
    const ms = target - current;
    if (!target || ms <= 0) return '';
    const days = Math.floor(ms / 86400000);
    const hh = String(Math.floor((ms % 86400000) / 3600000)).padStart(2, '0');
    const mm = String(Math.floor((ms % 3600000) / 60000)).padStart(2, '0');
    const ss = String(Math.floor((ms % 60000) / 1000)).padStart(2, '0');
    return days > 0 ? t('{d}天 {t}', { d: days, t: `${hh}:${mm}:${ss}` }) : `${hh}:${mm}:${ss}`;
  };

  return (
    <div className="module-groupon-goods_ad-wrapper">
      <div className={`module-ad-con module-goods_ad module-groupon-goods_ad ad-style__${style} ad-buy_btn_style__${px(module.buyBtnStyle)} ad-goods_style__${module.goodsStyle ?? 1} ad-goods_radio_style__${module.goodsRadioStyle ?? 1} ad-goods_name_row__${module.goodsNameRow ?? 1} ad-goods_name_padding__${module.goodsNamePadding} ad-text_align__${module.textAlign ?? 1} ad-text_weight__${module.textWeight} ad-goods-title_style__${title.titleStyle}`} style={shellStyle}>
        <div className="module-ad-content">
          <div className="mod_groupon">
            {showTitle ? (
              <div
                className="groupon-top"
                style={{
                  background: titleBg || undefined,
                  borderTopLeftRadius: px(title.titleRadius) ? `${px(title.titleRadius)}px` : '',
                  borderTopRightRadius: px(title.titleRadius) ? `${px(title.titleRadius)}px` : '',
                  paddingTop: `${px(title.titlePaddingTop, 20)}px`,
                  paddingBottom: `${px(title.titlePaddingBottom, 20)}px`,
                }}
              >
                <div className="groupon-title-wrapper">
                  {Number(title.titleStyle) === 3 ? <div className="line" /> : null}
                  {title.titleBackgroundPic?.picUrl ? (
                    <img className="image-size" src={title.titleBackgroundPic.picUrl} alt="" />
                  ) : null}
                  <div className="groupon-title" style={{ color: title.titleColor || '#1a1a1a' }}>{title.titleText || t('拼团')}</div>
                  {title.descText ? (
                    <div className={`groupon-desc ${Number(title.titleStyle) === 2 ? 'big-sm' : 'sm'}`} style={{ color: title.descColor || '#1a1a1a' }}>
                      {title.descText}
                    </div>
                  ) : null}
                </div>
                {countdown ? (
                  <div className="groupon-count-down" style={{ color: title.moreColor || '#1a1a1a' }}>
                    <div className="countdown-box">
                      <span className="countdown-text">{title.countdownLabel || t('距结束')}:</span>
                      <span className="countdown-item">{countdown.split(':')[0]}</span>
                      <span className="countdown-separator-text">:</span>
                      <span className="countdown-item">{countdown.split(':')[1]}</span>
                      <span className="countdown-separator-text">:</span>
                      <span className="countdown-item">{countdown.split(':')[2]}</span>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div className={`goods-ad-warp${style === 6 ? ' has-nav' : ''}`} style={{ padding: goodsPadding ? `${goodsPadding}px` : '0' }}>
              <SwiperNav
                visible={style === 6 && notEnded.length > 6}
                onPrev={() => grouponScrollRef.current?.scrollBy({ left: -grouponScrollRef.current.clientWidth * 0.6, behavior: 'smooth' })}
                onNext={() => grouponScrollRef.current?.scrollBy({ left: grouponScrollRef.current.clientWidth * 0.6, behavior: 'smooth' })}
              />
              <div
                className={`goods-ad-con${style === 6 ? ' is-swiper' : ''}`}
                ref={grouponScrollRef}
                style={{ gap: `${goodsPadding}px`, gridTemplateColumns: style === 6 ? undefined : `repeat(${columns}, minmax(0, 1fr))` }}
              >
                {notEnded.map((item, index) => (
                  <div className="proditem goods-ad-item" key={item.productId ?? index}>
                    <div className="item-content">
                      <div className="item-con">
                        <Link href={item.seoLink || `/product/${item.productId ?? ''}`} target="_blank" className="g-item-warp" title={item.productName}>
                          <div className="pic">
                            <div className="groupon-item-image-wrapper">
                              <div className="groupon-item-image" style={{ width: Number(module.cardStyle) === 1 ? '90%' : '100%' }}>
                                <img className="pro_pic" src={item.picUrl || item.picThumb || ''} alt={item.productName || ''} loading="lazy" />
                              </div>
                            </div>
                            {isCardStyle1 ? (
                              <div className="countdown">
                                <div className="title">{t('拼团')}</div>
                                <div className="countdown-time">
                                  <div className="time">{!(parseTime(item.startTime) > (now || Date.now())) ? t('距结束') : '距开始'}</div>
                                  <div className="text">{cardCountdownText(item)}</div>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        </Link>
                        {showName ? (
                          <div className="titleBox groupon-item__name" style={isCardStyle1 ? { marginBottom: 0 } : undefined}>
                            <div
                              className="title product-name-text"
                              data-group-label={t(`${minGroupNum(item) || 0}人团`)}
                              style={{ textAlign: Number(module.textAlign) === 1 ? 'left' : 'center', fontWeight: Number(module.textWeight) === 1 ? 'normal' : 'bold' }}
                            >
                              {item.productName}
                            </div>
                          </div>
                        ) : null}
                        {showPrice ? (
                          isCardStyle1 ? (
                            <div className="priceBox">
                              <div className="priceBoxNum">
                                <span className="minGrouponPrice">{formatPrice(item.minGrouponPrice ?? item.grouponPrice)}</span>
                                <div className="old">
                                  <s>{formatPrice(item.productPrice)}</s>
                                </div>
                              </div>
                              <div className="text">{t('拼')}</div>
                            </div>
                          ) : (
                            <div className="groupon-item__price" style={{ flexDirection: Number(module.textAlign) === 1 ? 'row' : 'column' }}>
                              <div className="price-wrapper">
                                <span className="price price-miaosha">{formatPrice(item.minGrouponPrice ?? item.grouponPrice)}</span>
                                {Number(item.productPrice) > 0 ? <s className="price price-origin">{formatPrice(item.productPrice)}</s> : null}
                              </div>
                              <div className="buy">
                                <button
                                  type="button"
                                  className={`view_detail${productSoldOut(item) ? ' disabled' : ''}`}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    void buyProduct(item, { isQuick: 1 });
                                  }}
                                >
                                  <i className="iconfont-pc icon-tianjia" />
                                </button>
                              </div>
                            </div>
                          )
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================= 9. 其它模块（字段/DOM 对齐旧版） ======================= */

/** PcImageNav.vue：picList、navType(1 固定栅格/2 轮播)、navStyle(1 图+文/2 仅图/3 仅文)、
 * rowNum(3~6)、colNum(1~3)、radioStyle(2 圆角)、picPageType、backgroundColor、frame。 */
function ImageNav({ module }: ModuleProps) {
    const { t } = useTranslation();
  const pics: any[] = Array.isArray(module.picList)
    ? module.picList
    : Array.isArray(module.items)
      ? module.items
      : [];
  const frame = module.frame || {};
  const navType = Number(module.navType ?? 1);
  const navStyle = Number(module.navStyle ?? 1);
  const rowNum = Math.min(6, Math.max(3, px(module.rowNum, 4)));
  const colNum = Math.min(3, Math.max(1, px(module.colNum, 2)));
  const itemsPerPage = rowNum * colNum;
  const showIcon = navStyle === 1 || navStyle === 2;
  const showText = navStyle === 1 || navStyle === 3;
  const radius = Number(module.radioStyle) === 2 ? 8 : 0;
  const pages: any[][] = [];
  for (let start = 0; start < pics.length; start += itemsPerPage) {
    pages.push(pics.slice(start, start + itemsPerPage));
  }
  const { index, setIndex, setPaused } = useCarousel(Math.max(1, pages.length), 3000);
  const imageNavSwipe = useSwipeDrag(index, Math.max(1, pages.length), setIndex);
  if (!pics.length) return null;
  const cssVars: Record<string, any> = {
    '--dec-box-padding': `${px(frame.boxPadding, 10)}px`,
    '--dec-box-padding-top': `${px(frame.boxPaddingTop, 5)}px`,
    '--dec-box-padding-bottom': `${px(frame.boxPaddingBottom, 5)}px`,
    '--dec-box-radius': `${px(frame.boxRadius)}px`,
    '--dec-bg-color': frame.backgroundColor || '#ffffff',
    '--dec-content-bg': module.backgroundColor || '#ffffff',
    '--dec-item-radius': `${radius}px`,
    // 旧版网格：columns=rowNum(3~6)，间距=imgPadding(默认8)，同时作 gap 与内边距
    '--dec-row-num': String(rowNum),
    '--dec-item-gap': `${module.imgPadding ?? 8}px`,
    '--dec-indicator-color': module.swiperPageColor || '#333333',
  };
  const classes = [`dec-pc-image-nav--type-${navType}`, `dec-pc-image-nav--style-${navStyle}`, `dec-pc-image-nav--indicator-${module.picPageType ?? 1}`];
  if (Number(module.radioStyle) === 2) classes.push('dec-pc-image-nav--rounded');
  return (
    <div className={`dec-pc-image-nav ${classes.join(' ')}`} style={cssVars}>
      <div className="dec-pc-image-nav__content">
        {navType === 1 ? (
          <div className="dec-pc-image-nav__grid" style={{ gridTemplateColumns: `repeat(${rowNum}, minmax(0, 1fr))` }}>
            {pages[0].map((item, index) => (
              <div className="dec-pc-image-nav__item" key={index}>
                <a className="dec-pc-image-nav__link" href={navHref(item.picLink) || '#'} target="_blank" rel="noreferrer">
                  {showIcon ? (
                    <div className="dec-pc-image-nav__icon">
                      <img className="dec-pc-image-nav__image" src={item.picUrl || item.picThumb || ''} alt={item.picTitle || ''} loading="lazy" />
                    </div>
                  ) : null}
                  {showText ? <div className="dec-pc-image-nav__text">{item.picTitle}</div> : null}
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="dec-pc-image-nav__carousel"
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
          >
            <div className={`dec-pc-image-nav__carousel-viewport${imageNavSwipe.dragging ? ' is-dragging' : ''}`} {...imageNavSwipe.handlers}>
              <div className="dec-pc-image-nav__carousel-track" style={{ transform: `translateX(calc(-${index * 100}% + ${imageNavSwipe.offset}px))` }}>
                {pages.map((page, pageIndex) => (
                  <div
                    className="dec-pc-image-nav__swiper-page"
                    key={pageIndex}
                    style={{ gridTemplateColumns: `repeat(${rowNum}, minmax(0, 1fr))` }}
                  >
                    {Array.from({ length: itemsPerPage }).map((_, cellIndex) => {
                      const item = page[cellIndex];
                      if (!item) return <div className="dec-pc-image-nav__item" key={`placeholder-${cellIndex}`} aria-hidden />;
                      return (
                        <div className="dec-pc-image-nav__item" key={cellIndex}>
                          <a className="dec-pc-image-nav__link" href={navHref(item.picLink) || '#'} target="_blank" rel="noreferrer">
                            {showIcon ? (
                              <div className="dec-pc-image-nav__icon">
                                <img className="dec-pc-image-nav__image" src={item.picUrl || item.picThumb || ''} alt={item.picTitle || ''} loading="lazy" />
                              </div>
                            ) : null}
                            {showText ? <div className="dec-pc-image-nav__text">{item.picTitle}</div> : null}
                          </a>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            <SwiperNav visible={pages.length > 1} onPrev={() => setIndex(index - 1)} onNext={() => setIndex(index + 1)} />
            {pages.length > 1 ? (
              <div className="dec-pc-image-nav__dots">
                {pages.map((_, dot) => (
                  <button
                    key={dot}
                    type="button"
                    className={dot === index ? 'is-active' : ''}
                    onClick={() => setIndex(dot)}
                    aria-label={t('第 {n} 页', { n: dot + 1 })}
                  />
                ))}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}

/** PcImageSquareAd.vue：picList、picType（5=左大图+右上下2图 / 6=左大图+右上1下2 / 7=上大图+下2图 /
 * 1~4=2/3/4/2x2 列栅格）、imgPadding（--img-gap）、title、frame（TotalContainer + base-class 恒裁切）。
 * DOM 复刻旧版复合结构（image-square-layout + grid-layout-2/3 嵌套），不再平铺。 */
function ImageSquareAd({ module }: ModuleProps) {
  const pics: any[] = Array.isArray(module.picList) ? module.picList : [];
  if (!pics.length) return null;
  const picType = Number(module.picType ?? 5);
  const frame = module.frame || {};
  const xPadding = px(frame.leftAndRightPadding ?? frame.innerPadding ?? 0);
  const cell = (index: number) => {
    const pic = pics[index];
    if (!pic) return null;
    const inner = (
      <div className="item-img-a">
        <img src={pic.picUrl || pic.picThumb || ''} alt={pic.picTitle || ''} loading="lazy" />
      </div>
    );
    return pic.picLink ? (
      <a className="item-content" href={navHref(pic.picLink) || '#'} target="_blank" rel="noreferrer">
        {inner}
      </a>
    ) : (
      <div className="item-content">{inner}</div>
    );
  };
  return (
    <Container module={frame} className="module-image-square-ad">
      <div style={{ padding: `${xPadding}px` }}>
        <ShopTitle title={module.title} />
        {picType === 5 ? (
          <div className="image-list" style={{ ['--img-gap' as string]: `${px(module.imgPadding)}px` }}>
            <div className="image-square-layout image-square-layout-height2">
              <div className="image-ad-item">{cell(0)}</div>
              <div className="grid-layout-2">
                <div className="image-ad-item">{cell(1)}</div>
                <div className="image-ad-item">{cell(2)}</div>
              </div>
            </div>
          </div>
        ) : picType === 7 ? (
          <div className="image-list" style={{ ['--img-gap' as string]: `${px(module.imgPadding)}px` }}>
            <div className="image-square-layout2">
              <div className="image-ad-item">{cell(0)}</div>
              <div className="grid-layout-2">
                <div className="image-ad-item">{cell(1)}</div>
                <div className="image-ad-item">{cell(2)}</div>
              </div>
            </div>
          </div>
        ) : picType === 6 ? (
          <div className="image-list" style={{ ['--img-gap' as string]: `${px(module.imgPadding)}px` }}>
            <div className="image-square-layout image-square-layout3 image-square-layout-height2">
              <div className="image-ad-item">{cell(0)}</div>
              <div className="grid-layout-2">
                <div>
                  <div className="image-ad-item">{cell(1)}</div>
                </div>
                <div className="grid-layout-3">
                  <div className="image-ad-item">{cell(2)}</div>
                  <div className="image-ad-item">{cell(3)}</div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="image-list" style={{ ['--img-gap' as string]: `${px(module.imgPadding)}px` }}>
            <div className={`image-square-layout-${picType} image-square-layout-height1`}>
              {pics.map((pic, index) => (
                <div className="image-ad-item" key={index}>
                  {cell(index)}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Container>
  );
}

/** PcImageHotarea.vue：picList[].hotarea[]（width/height/pageX|left/pageY|top/link.name）、
 * imgPadding、title、frame（TotalContainer）；热区坐标基于 500px 基准，窄容器按比例缩放由 CSS 变量完成。 */
function ImageHotarea({ module }: ModuleProps) {
    const { t } = useTranslation();
  const pics: any[] = Array.isArray(module.picList) ? module.picList : [];
  const frame = module.frame || {};
  const innerPad = px(frame.leftAndRightPadding ?? frame.innerPadding);
  const wrapRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const [widths, setWidths] = useState<Record<number, number>>({});

  useEffect(() => {
    const elements = Object.values(wrapRefs.current).filter((el): el is HTMLDivElement => Boolean(el));
    if (!elements.length || typeof ResizeObserver === 'undefined') return undefined;
    const observer = new ResizeObserver((entries) => {
      setWidths((current) => {
        const next = { ...current };
        entries.forEach((entry) => {
          const element = entry.target as HTMLDivElement;
          const picIndex = Number(element.dataset.picIndex);
          if (Number.isFinite(picIndex)) next[picIndex] = entry.contentRect.width;
        });
        return next;
      });
    });
    elements.forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [pics.length]);

  if (!pics.length) return null;
  const HOTAREA_ORIGINAL_WIDTH = 500;
  const scaleOf = (picIndex: number) => {
    const width = widths[picIndex] || 0;
    return width > 0 ? width / HOTAREA_ORIGINAL_WIDTH : 0;
  };
  const hotareaStyle = (sub: any, picIndex: number): Record<string, string> => {
    const scale = scaleOf(picIndex);
    if (!scale) return parseCssText(sub?.position);
    const w = Number(sub?.width) || 0;
    const h = Number(sub?.height) || 0;
    const left = Number(sub?.left ?? sub?.pageX) || 0;
    const top = Number(sub?.top ?? sub?.pageY) || 0;
    return {
      width: `${scale * w}px`,
      height: `${scale * h}px`,
      left: `${scale * left}px`,
      top: `${scale * top}px`,
    };
  };

  return (
    <Container module={frame}>
      <ShopTitle title={module.title} rightText={module.title?.moreLink?.title} />
      <div className="image-hotarea-warp" style={{ padding: innerPad ? `${innerPad}px` : undefined }}>
        <div className="image-ad-con">
          {pics.map((item, picIndex) => (
            <div className="image-ad-item" key={item.picId ?? picIndex}>
              <div className="item-content" style={{ padding: `${px(module.imgPadding)}px` }}>
                <div
                  className="item-content-hotatrea"
                  data-pic-index={picIndex}
                  ref={(element) => {
                    wrapRefs.current[picIndex] = element;
                  }}
                >
                  <div className="item-img-a">
                    <img className="item-img" src={item.picUrl || ''} alt="" loading="lazy" />
                  </div>
                  {(Array.isArray(item.hotarea) ? item.hotarea : []).map((sub: any, index: number) => (
                    <div
                      className="image-hotarea-link"
                      key={index}
                      style={hotareaStyle(sub, picIndex)}
                      onClick={() => openLink(sub.link)}
                    >
                      <span className="area_box_con_text">{sub.link?.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Container>
  );
}

/** PcTitleAd.vue：title{titleText,descText,titleAlign,titleStyle,titleColor,descColor,titleBackground,
 * titleBackground2,titleRadius,showMore,moreLink,moreColor}、frame{leftAndRightPadding,backgroundColor,boxRadius}。 */
function TitleAd({ module }: ModuleProps) {
    const { t } = useTranslation();
  const title = module.title || {};
  const frame = module.frame || {};
  const leftRight = px(frame.leftAndRightPadding);
  const align = Number(title.titleAlign) || 1;
  const styleType = Number(title.titleStyle) || 1;
  const background = title.titleBackground2 && title.titleBackground
    ? `linear-gradient(to right, ${title.titleBackground}, ${title.titleBackground2})`
    : title.titleBackground || '';
  const containerStyle: Record<string, any> = {
    backgroundColor: frame.backgroundColor || '',
    borderRadius: `${px(frame.boxRadius)}px`,
    overflow: px(frame.boxRadius) ? 'hidden' : undefined,
  };
  return (
    <Container module={frame} className={`module-ad-con module-title_ad ad-title_align__${align}`} style={containerStyle}>
      {!title.titleText || String(title.titleText).trim() === '' ? (
        <div className="module-ad-empty empty-title_ad">
          <div className="image-empty-bg" />
          <div className="desc">{t('点击添加标题')}</div>
        </div>
      ) : (
        <div className={`title-ad-warp ad-title_align__${align}`} style={{ paddingLeft: leftRight, paddingRight: leftRight }}>
          <div className="title-ad-con">
            <div className="title-ad-item">
              <div className="item-content">
                <div
                  className={`image-ad-title ad-title_style__${styleType}`}
                  style={{ borderRadius: `${px(title.titleRadius)}px`, padding: `10px ${leftRight}px`, background: background || undefined }}
                >
                  <div className="image-ad-title-l">
                    <div className="image-ad-title-h" style={{ color: title.titleColor || undefined }}>{title.titleText}</div>
                    {title.descText ? <div className="image-ad-title-d" style={{ color: title.descColor || undefined }}>{title.descText}</div> : null}
                  </div>
                  {Number(title.showMore) === 1 ? (
                    <div className="image-ad-title-r">
                      <a className="more-link" href={navHref(title.moreLink) || '#'} target="_blank" rel="noreferrer" style={{ color: title.moreColor || undefined }}>
                        <div className="flex align-center">
                          <span>{title.moreLink?.title || t('查看更多')}</span>
                          <i className="iconfont-pc icon-login-jt" />
                        </div>
                      </a>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Container>
  );
}

/** PcNotice.vue：module.frame（含 itemBackgroundColor/itemRadius/itemHeight/textColor）+ 兼容平铺字段、
 * icoPic.picUrl、text；frame 默认值 10/5/5/0/#ffffff。 */
function Notice({ module }: ModuleProps) {
  const frame = module.frame || {};
  const containerModule = {
    boxPadding: frame.boxPadding ?? module.boxPadding ?? 10,
    boxPaddingTop: frame.boxPaddingTop ?? module.boxPaddingTop ?? 5,
    boxPaddingBottom: frame.boxPaddingBottom ?? module.boxPaddingBottom ?? 5,
    boxRadius: frame.boxRadius ?? module.boxRadius ?? 0,
    backgroundColor: frame.backgroundColor || module.backgroundColor || '#ffffff',
    innerPadding: frame.innerPadding ?? module.innerPadding ?? 0,
  };
  const itemStyle: Record<string, any> = {
    backgroundColor: frame.itemBackgroundColor ?? '#fff8e6',
    borderRadius: `${px(frame.itemRadius, 4)}px`,
    height: `${px(frame.itemHeight, 35)}px`,
    color: frame.textColor ?? '#555555',
  };
  return (
    <Container module={containerModule} className="module-ad-con module-notice">
      <div className="notice-ad-warp">
        <div className="notice-con">
          <div className="notice-item">
            <div className="item-content">
              <div className="item-notice-con" style={itemStyle}>
                {module.icoPic?.picUrl ? (
                  <div className="item-notice-ico"><img className="item-img" src={module.icoPic.picUrl} alt="" /></div>
                ) : null}
                <div className="item-notice-list">
                  <div className="item-notice-input" style={{ color: frame.textColor ?? '#555555' }}>{module.text || ''}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}

/** PcDivider.vue：lineType(2 显示线)、lineStyle(1..)、frame.itemHeight（默认 10）。 */
function Divider({ module }: ModuleProps) {
  const lineType = Number(module.lineType) || 2;
  const lineStyle = Number(module.lineStyle) || 1;
  const rawHeight = Number(module.frame?.itemHeight);
  const itemHeight = Number.isFinite(rawHeight) ? rawHeight : 10;
  const frameModule = module.frame || {
    innerPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0,
    boxPadding: 0,
    backgroundColor: '',
    boxRadius: 0,
  };
  return (
    <Container module={frameModule} className="module-ad-con module-white_line">
      <div className="white-line-warp">
        <div className="white-line-con" style={{ height: `${itemHeight}px` }}>
          {lineType === 2 ? (
            <div className={`white-line-item line-style-${lineStyle}`}>
              <div className="item-line" />
            </div>
          ) : null}
        </div>
      </div>
    </Container>
  );
}

/** PcSpacer.vue：frame{boxPadding,boxPaddingTop,boxPaddingBottom,boxRadius}、blankHeight、backgroundColor。 */
function Spacer({ module }: ModuleProps) {
  const frame = module.frame || {};
  const height = module.blankHeight ?? 30;
  return (
    <div
      className="pc-spacer module-ad-con module-white_blank"
      style={{
        paddingLeft: px(frame.boxPadding),
        paddingRight: px(frame.boxPadding),
        paddingTop: px(frame.boxPaddingTop),
        paddingBottom: px(frame.boxPaddingBottom),
        boxSizing: 'border-box',
        width: '100%',
      }}
    >
      <div
        className="pc-spacer__content"
        style={{
          width: '100%',
          height: `${height}px`,
          minHeight: '10px',
          backgroundColor: module.backgroundColor || 'transparent',
          borderRadius: `${px(frame.boxRadius)}px`,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

/** PcBanner2.vue：picList、number(1~3 每屏张数，默认 1)、slideGap（默认 12）、
 * frame{boxPadding,boxPaddingTop,boxPaddingBottom,boxRadius,backgroundColor,leftAndRightPadding}。 */
function Banner2({ module }: ModuleProps) {
    const { t } = useTranslation();
  const pics: any[] = Array.isArray(module.picList) ? module.picList : [];
  const frame = module.frame || {};
  const perView = Math.min(3, Math.max(1, Number(module.number) || 1));
  const gap = Number.isFinite(Number(module.slideGap)) ? Math.max(0, Number(module.slideGap)) : 12;
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pages = Math.max(1, pics.length - perView + 1);
  const { index, setIndex } = useCarousel(pages, 5000);
  const banner2Swipe = useSwipeDrag(index, pages, setIndex);
  if (!pics.length) return null;
  const style: Record<string, any> = {
    '--dec-box-padding': `${px(frame.boxPadding)}px`,
    '--dec-box-padding-top': `${px(frame.boxPaddingTop)}px`,
    '--dec-box-padding-bottom': `${px(frame.boxPaddingBottom)}px`,
    '--dec-box-radius': `${px(frame.boxRadius)}px`,
    '--dec-bg-color': frame.backgroundColor || 'transparent',
    '--dec-inner-padding': `${px(frame.leftAndRightPadding)}px`,
    '--dec-slide-gap': `${gap}px`,
  };
  return (
    <div className={`dec-banner2 dec-banner2--num-${perView}`} style={style}>
      <div className="dec-banner2__inner">
        <div className={`dec-banner2__track${banner2Swipe.dragging ? ' is-dragging' : ''}`} ref={trackRef} {...banner2Swipe.handlers} style={{ transform: `translateX(calc(-${index * (100 / perView)}% + ${banner2Swipe.offset}px))` }}>
          {pics.map((pic, i) => (
            <div className="dec-banner2__item" key={i} style={{ width: `calc((100% - ${(perView - 1) * gap}px) / ${perView})` }}>
              <a className="dec-banner2__link" href={navHref(pic.picLink) || '#'} target="_blank" rel="noreferrer">
                <img className="dec-banner2__image" src={pic.picUrl || ''} alt={pic.picTitle || pic.picName || ''} loading="lazy" />
              </a>
            </div>
          ))}
        </div>
        <SwiperNav visible={pages > 1} onPrev={() => setIndex(index - 1)} onNext={() => setIndex(index + 1)} />
        {pages > 1 ? (
          <div className="dec-banner2__dots">
            {Array.from({ length: pages }).map((_, dot) => (
              <button key={dot} type="button" className={dot === index ? 'is-active' : ''} onClick={() => setIndex(dot)} aria-label={t('第 {n} 张', { n: dot + 1 })} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** PcCategoryNav3.vue：picList、titleText、showMore/showMoreText/moreLink、backgroundColor、
 * frame{boxPadding,boxPaddingTop,boxPaddingBottom,boxRadius,boxHeight 默认352}、imageBackgroundColor。 */
function CategoryNav3({ module }: ModuleProps) {
    const { t } = useTranslation();
  const pics: any[] = Array.isArray(module.picList) ? module.picList : [];
  const nav3Ref = useRef<HTMLDivElement | null>(null);
  const frame = module.frame || {};
  const radius = px(frame.boxRadius);
  const style: Record<string, any> = {
    '--dec-box-padding': `${px(frame.boxPadding)}px`,
    '--dec-box-padding-top': `${px(frame.boxPaddingTop)}px`,
    '--dec-box-padding-bottom': `${px(frame.boxPaddingBottom)}px`,
    '--dec-box-radius': `${radius}px`,
    '--dec-bg-color': module.backgroundColor || frame.backgroundColor || 'rgba(0, 0, 0, 0.02)',
    '--dec-box-height': `${px(frame.boxHeight) > 0 ? px(frame.boxHeight) : 352}px`,
    borderRadius: `${radius}px`,
    overflow: radius ? 'hidden' : undefined,
  };
  return (
    <div className="dec-category-nav3" style={style}>
      <div className="dec-category-nav3__top">
        <div className="dec-category-nav3__title">{module.titleText || ''}</div>
        {Number(module.showMore) === 1 ? (
          <a className="dec-category-nav3__more" href={navHref(module.moreLink) || '#'} target="_blank" rel="noreferrer">
            {module.showMoreText || t('更多')}
            <span className="dec-category-nav3__more-icon" aria-hidden>›</span>
          </a>
        ) : null}
      </div>
      {pics.length ? (
        <div className="dec-category-nav3__list-wrap">
          <SwiperNav visible={pics.length > 6} onPrev={() => nav3Ref.current?.scrollBy({ left: -nav3Ref.current.clientWidth * 0.6, behavior: 'smooth' })} onNext={() => nav3Ref.current?.scrollBy({ left: nav3Ref.current.clientWidth * 0.6, behavior: 'smooth' })} />
          <div className="dec-category-nav3__list" ref={nav3Ref}>
          {pics.map((pic, i) => (
            <div className="dec-category-nav3__item" key={i}>
              <a href={navHref(pic.picLink) || '#'} target="_blank" rel="noreferrer" title={pic.picTitle}>
                <div className="dec-category-nav3__image" style={{ backgroundColor: pic.imageBackgroundColor || module.imageBackgroundColor || undefined }}>
                  <img className="dec-category-nav3__img" src={pic.picUrl || pic.picThumb || ''} alt={pic.picTitle || ''} loading="lazy" />
                </div>
                <div className="dec-category-nav3__name">{pic.picTitle}</div>
                {pic.picDesc ? (
                  <div className="dec-category-nav3__desc">
                    <span className="dec-category-nav3__hot">HOT</span>
                    <div className="dec-category-nav3__desc-text">{pic.picDesc}</div>
                  </div>
                ) : null}
              </a>
            </div>
          ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** PcGroupBanner.vue：picList、number(每屏 1~3)、frame{boxPadding,boxPaddingTop,boxPaddingBottom,
 * boxRadius,backgroundColor,slideHeight 默认195}。 */
function GroupBanner({ module }: ModuleProps) {
  const pics: any[] = Array.isArray(module.picList)
    ? module.picList
    : Array.isArray(module.banners)
      ? module.banners
      : [];
  const frame = module.frame || {};
  const perView = Math.min(3, Math.max(1, Number(module.number) || 3));
  const height = px(frame.slideHeight) > 0 ? px(frame.slideHeight) : 195;
  const pages = Math.max(1, pics.length - perView + 1);
  const { index, setIndex } = useCarousel(pages, 5000);
  const groupBannerSwipe = useSwipeDrag(index, pages, setIndex);
  if (!pics.length) return null;
  const style: Record<string, any> = {
    '--dec-box-padding': `${px(frame.boxPadding)}px`,
    '--dec-box-padding-top': `${px(frame.boxPaddingTop)}px`,
    '--dec-box-padding-bottom': `${px(frame.boxPaddingBottom)}px`,
    '--dec-box-radius': `${px(frame.boxRadius)}px`,
    '--dec-bg-color': frame.backgroundColor || 'transparent',
    '--dec-slide-height': `${height}px`,
  };
  return (
    <div className="dec-group-banner" style={style}>
      <div className="dec-group-banner__inner">
        <div className={`dec-group-banner__track${groupBannerSwipe.dragging ? ' is-dragging' : ''}`} {...groupBannerSwipe.handlers} style={{ transform: `translateX(calc(-${index * (100 / perView)}% + ${groupBannerSwipe.offset}px))` }}>
          {pics.map((pic, i) => (
            <div className="dec-group-banner__item" key={i} style={{ width: `calc((100% - ${(perView - 1) * 30}px) / ${perView})` }}>
              <a className="dec-group-banner__link" href={navHref(pic.picLink) || '#'} target="_blank" rel="noreferrer" title={pic.picTitle || ''}>
                <img className="dec-group-banner__image" src={pic.picUrl || ''} alt={pic.picTitle || ''} loading="lazy" />
              </a>
            </div>
          ))}
        </div>
        <SwiperNav visible={pages > 1} onPrev={() => setIndex(index - 1)} onNext={() => setIndex(index + 1)} />
      </div>
    </div>
  );
}

/** PcRecommendProduct.vue：titleName、products{productSelectType,productIds,productCategoryId,
 * productTag,productNumber}、frame{columns 默认5,itemGap,boxPadding,boxPaddingTop,boxPaddingBottom,
 * boxRadius,backgroundColor}；滚动分页（本实现按 productNumber 一次取满，见报告）。 */
function RecommendProduct({ module }: ModuleProps) {
    const { t } = useTranslation();
  const frame = module.frame || {};
  const config = module.products || {};
  const columns = Number(frame.columns) > 0 ? Number(frame.columns) : 5;
  const itemGap = Number(frame.itemGap) >= 0 ? Number(frame.itemGap) : 16;
  const PAGE_SIZE = 20;
  const selectType = Number(config.productSelectType);
  const maxNum = selectType === 1
    ? (Array.isArray(config.productIds) ? config.productIds.length : 0)
    : Math.max(0, px(config.productNumber, 0));

  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [noMore, setNoMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadingRef = useRef(false);
  const noMoreRef = useRef(false);
  const countRef = useRef(0);
  const pageRef = useRef(1);

  const buildParams = (pageNo: number, size: number): Record<string, unknown> => {
    const params: Record<string, unknown> = { page: pageNo, size };
    if (selectType === 1) {
      const ids = Array.isArray(config.productIds) ? config.productIds : [];
      params.ids = ids.join(',');
    } else if (selectType === 2) {
      params.categoryId = config.productCategoryId;
    } else if (selectType === 3) {
      params.introType = config.productTag;
    }
    return params;
  };

  const requestPage = async (targetPage: number): Promise<void> => {
    if (loadingRef.current || noMoreRef.current) return;
    const remaining = maxNum - countRef.current;
    if (remaining <= 0) {
      noMoreRef.current = true;
      setNoMore(true);
      return;
    }
    const size = Math.min(PAGE_SIZE, remaining);
    loadingRef.current = true;
    setLoading(true);
    try {
      const data = await apiGet<{ records?: ProductItem[] }>('product/product/list', buildParams(targetPage, size));
      const records = Array.isArray(data?.records) ? data.records : [];
      setProducts((previous) => (targetPage === 1 ? records : [...previous, ...records]));
      countRef.current = targetPage === 1 ? records.length : countRef.current + records.length;
      if (records.length < size || countRef.current >= maxNum) {
        noMoreRef.current = true;
        setNoMore(true);
      }
      pageRef.current = targetPage;
    } catch {
      noMoreRef.current = true;
      setNoMore(true);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  useEffect(() => {
    products.length; // 保持 lint 关闭时的显式引用
    setProducts([]);
    setNoMore(false);
    loadingRef.current = false;
    noMoreRef.current = false;
    countRef.current = 0;
    pageRef.current = 1;
    void requestPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(config)]);

  const requestRef = useRef(requestPage);
  requestRef.current = requestPage;

  useEffect(() => {
    const onScroll = () => {
      const element = sentinelRef.current;
      if (!element) return;
      if (window.scrollY + window.innerHeight >= element.offsetTop + 20) {
        void requestRef.current(pageRef.current + 1);
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const cssVars: Record<string, any> = {
    '--dec-box-padding': `${px(frame.boxPadding)}px`,
    '--dec-box-padding-top': `${px(frame.boxPaddingTop)}px`,
    '--dec-box-padding-bottom': `${px(frame.boxPaddingBottom)}px`,
    '--dec-box-radius': `${px(frame.boxRadius)}px`,
    '--dec-bg-color': frame.backgroundColor || 'transparent',
    '--dec-item-gap': `${itemGap}px`,
    '--dec-columns': String(columns),
  };

  // 旧 utils/getBuyText（B2B 分支不涉及 C 端海外版）：1=加入购物车，5/6=立即预约，其余=立即购买
  const buyText = (type: unknown): string => {
    const n = Number(type ?? 1);
    if (n === 1) return '加入购物车';
    if (n === 5 || n === 6) return '立即预约';
    return '立即购买';
  };

  return (
    <div className="dec-recommend-product" style={cssVars}>
      {module.titleName ? <h3 className="dec-recommend-product__title">{module.titleName}</h3> : null}
      <div className="dec-recommend-product__list" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap: `${itemGap}px` }}>
        {products.map((product, index) => (
          <div className="dec-recommend-product__item" key={product.productSn || product.productId || index}>
            <div className="dec-recommend-product__card">
              <div className="dec-recommend-product__flip">
                <div className="dec-recommend-product__pic">
                  <Link className="dec-recommend-product__pic-link" href={productDetailHref(product)} target="_blank">
                    <img src={product.picUrl || product.picThumb || ''} alt={product.productName || ''} loading="lazy" />
                  </Link>
                </div>
                <div className="dec-recommend-product__name">
                  <Link href={productDetailHref(product)} target="_blank">
                    {Number((product as any).deliveryMode) === 2 && Number((product as any).deliveryType) === 1 ? (
                      <span className="dec-recommend-product__tag">{t('周期购')}</span>
                    ) : null}
                    {Number((product as any).deliveryMode) === 2 && Number((product as any).deliveryType) === 2 ? (
                      <span className="dec-recommend-product__tag">{t('次卡兑换')}</span>
                    ) : null}
                    {product.productName}
                  </Link>
                </div>
                <div className="dec-recommend-product__price">{formatPrice(product.productPrice)}</div>
              </div>
              <div className="dec-recommend-product__operate">
                <Link className="dec-recommend-product__detail" href={productDetailHref(product)} target="_blank">{t('查看详情')}</Link>
                <button
                  type="button"
                  className={`dec-recommend-product__buy${productSoldOut(product) ? ' is-disabled' : ''}`}
                  onClick={() => void buyProduct(product, { isQuick: Number((product as any).productType ?? 1) !== 1 ? 1 : 0 })}
                >
                  {buyText((product as any).productType)}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div ref={sentinelRef}>
        {loading ? (
          <div className="dec-recommend-product__loading"><div className="gif-loading" /></div>
        ) : null}
        {noMore && products.length > 0 ? <div className="dec-recommend-product__end">{t('没有更多喽~')}</div> : null}
      </div>
    </div>
  );
}

/** PcProductGroup.vue：productGroups[]{title,titlePic,sourceType,productGroupId,productList}、
 * groupTitle.showTitle、showProductName/showSales/showProductPrice/crossedOutPrice、
 * productCardStyle/listStyle、cardPadding/cardRadius、productColor{titleColor,priceColor,backgroundColor,
 * infoLeftRightPadding}、moduleStyle{boxPadding,boxPaddingTop,boxPaddingBottom,backgroundColor}、
 * contentStyle{paddingTop,paddingBottom,paddingLeftRight,boxRadius,backgroundColor}、buyBtnStyle.showBtn。 */
function ProductGroup({ module }: ModuleProps) {
    const { t } = useTranslation();
  const groups: Array<Record<string, any>> = Array.isArray(module.productGroups) ? module.productGroups : [];
  const [active, setActive] = useState(0);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  /** 活动数据（原版 usePromotionActivity：POST product/product/promotion → {[productId]: {activityInfo}}） */
  const [promotions, setPromotions] = useState<Record<string, { activityInfo?: Array<{ type?: number; typeText?: string }> }>>({});
  const productColor = module.productColor || {};
  const groupTitle = module.groupTitle || {};
  const moduleStyle = module.moduleStyle || {};
  const contentStyle = module.contentStyle || {};
  const listStyle = Number(module.listStyle ?? 4);
  const cardRadius = px(module.cardRadius, 4);
  /* 旧版 getColumnsCount（取数 size=cols*3 用）：{4:4, 6:5, 7:6}，其余兜底 4 */
  const columns = listStyle === 6 ? 5 : listStyle === 7 ? 6 : 4;
  /* 渲染列数（旧 itemWidthStyle 语义）：1~4=listStyle 列，5=瀑布（2列+每3项跨全行），6=5列，7=6列 */
  const gridColumns = listStyle === 5 ? 2 : listStyle >= 1 && listStyle <= 4 ? listStyle : columns;
  const showGroupTitle = Number(groupTitle.showTitle ?? 1) === 1;
  const showName = Number(module.showProductName ?? 1) !== 0;
  const showPrice = Number(module.showProductPrice ?? 1) !== 0;
  const showCrossed = Number(module.crossedOutPrice ?? 1) !== 0;
  const showSales = Number(module.showSales ?? 1) !== 0;
  const showBuy = Number(module.buyBtnStyle?.showBtn ?? 1) !== 0;
  const showShopTag = Number(module.showShopTag ?? 1) !== 0;

  /* 旧版 tab 左右箭头：溢出时显示，滚动/切换后更新位置 */
  const tabsRef = useRef<HTMLDivElement | null>(null);
  const [showLeftArrow, setShowLeftArrow] = useState(false);
  const [showRightArrow, setShowRightArrow] = useState(false);

  const updateArrows = () => {
    const el = tabsRef.current;
    if (!el) {
      setShowLeftArrow(false);
      setShowRightArrow(false);
      return;
    }
    setShowLeftArrow(el.scrollLeft > 0);
    setShowRightArrow(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  };

  useEffect(() => {
    updateArrows();
    const onResize = () => updateArrows();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groups.length, showGroupTitle]);

  const scrollTabs = (direction: 'left' | 'right') => {
    const el = tabsRef.current;
    if (!el) return;
    const step = el.clientWidth * 0.6;
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' });
  };

  // 旧版 handleTabClick：切换分组并让点击的 tab 滚动到居中
  const handleTabClick = (index: number) => {
    setActive(index);
    requestAnimationFrame(() => {
      const container = tabsRef.current;
      if (!container) return;
      const tabEl = container.children[index] as HTMLElement | undefined;
      if (!tabEl) return;
      const containerRect = container.getBoundingClientRect();
      const tabRect = tabEl.getBoundingClientRect();
      const tabCenter = (tabRect.left + tabRect.right) / 2 - containerRect.left;
      const containerCenter = container.clientWidth / 2;
      container.scrollBy({ left: tabCenter - containerCenter, behavior: 'smooth' });
    });
  };

  useEffect(() => {
    let cancelled = false;
    const group = groups[active];
    if (!group) {
      setProducts([]);
      setLoading(false);
      return undefined;
    }
    // 旧 fetchProductList 开头 clearPromotionList：切换分组先清空上一组活动标签
    setPromotions({});
    setLoading(true);
    // 旧 usePromotionActivity.fetchPromotionList：自动携带首个商品的 shopId，失败即清空
    const requestPromotions = (list: any[]) => {
      const promotionItems = list
        .map((p: any) => ({ productId: p.productId ?? p.id }))
        .filter((p: any) => p.productId != null && String(p.productId) !== '');
      if (!promotionItems.length) {
        if (!cancelled) setPromotions({});
        return;
      }
      const rawShopId = list.find((item: any) => item.shopId)?.shopId;
      fetch('/api/product/product/promotion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ products: promotionItems, ...(rawShopId ? { shopId: String(rawShopId) } : {}), from: 'list' }),
      })
        .then((r) => r.json())
        .then((j) => {
          if (!cancelled) setPromotions(j?.data && typeof j.data === 'object' ? j.data : {});
        })
        .catch(() => {
          if (!cancelled) setPromotions({});
        });
    };
    if (group.sourceType === 'productGroup' && group.productGroupId) {
      const params = new URLSearchParams({ page: '1', size: String(columns * 3), productGroupId: String(group.productGroupId) });
      fetch(`/api/product/product/list?${params.toString()}`)
        .then((response) => response.json())
        .then((json) => {
          if (cancelled) return;
          const records = json?.data?.records || json?.data || json?.records || [];
          const list = Array.isArray(records) ? records : [];
          setProducts(list);
          requestPromotions(list);
        })
        .catch(() => {
          if (!cancelled) setProducts([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    } else {
      const fromList = Array.isArray(group.productList) ? group.productList : [];
      const ids = fromList
        .map((item: any) => item.productId ?? item.id)
        .filter((id: any) => Boolean(id) && String(id) !== '0');
      if (!ids.length) {
        setProducts([]);
        setLoading(false);
        return undefined;
      }
      const params = new URLSearchParams({ ids: ids.join(','), size: String(ids.length) });
      fetch(`/api/product/product/list?${params.toString()}`)
        .then((response) => response.json())
        .then((json) => {
          if (cancelled) return;
          const records = json?.data?.records || json?.data || json?.records || [];
          const list = Array.isArray(records) ? records : [];
          setProducts(list);
          requestPromotions(list);
        })
        .catch(() => {
          // 旧版：接口异常时降级使用装修数据中已有的商品信息
          if (!cancelled) {
            setProducts(fromList);
            requestPromotions(fromList);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(groups), active]);

  if (!groups.length) return null;
  const cssVars: Record<string, any> = {
    '--dec-box-padding': `${px(moduleStyle.boxPadding, 10)}px`,
    '--dec-box-padding-top': `${px(moduleStyle.boxPaddingTop, 5)}px`,
    '--dec-box-padding-bottom': `${px(moduleStyle.boxPaddingBottom, 5)}px`,
    '--dec-module-bg': moduleStyle.backgroundColor ?? 'transparent',
    '--dec-content-padding-top': `${px(contentStyle.paddingTop)}px`,
    '--dec-content-padding-bottom': `${px(contentStyle.paddingBottom)}px`,
    '--dec-content-padding-lr': `${px(contentStyle.paddingLeftRight)}px`,
    '--dec-content-radius': `${px(contentStyle.boxRadius)}px`,
    '--dec-content-bg': contentStyle.backgroundColor ?? 'transparent',
    '--dec-card-padding': `${px(module.cardPadding)}px`,
    '--dec-card-radius': `${cardRadius}px`,
    '--dec-card-bg': productColor.backgroundColor ?? '#ffffff',
    '--dec-info-padding-lr': `${px(productColor.infoLeftRightPadding, 3)}px`,
    '--dec-title-color': productColor.titleColor ?? '#19191b',
    '--dec-title-weight': String(module.productNameWeight ?? 400),
    '--dec-title-size': `${px(module.productNameSize, 16)}px`,
    '--dec-title-rows': String(module.productNameRow ?? 1),
    '--dec-price-color': themeAwareColor(productColor.priceColor, 'var(--price)'),
    // 旧版 itemGap = productColor.infoLeftRightPadding（默认 3），同时是商品间距
    '--dec-item-gap': `${Math.max(0, px(productColor.infoLeftRightPadding, 3))}px`,
    // 划线价颜色（旧 pc.crossedOutPriceColor，默认 #999999）
    '--dec-origin-price-color': productColor.crossedOutPriceColor ?? '#999999',
    // 分组标题样式体系（旧 gt.* 十项，缺省值对齐旧版）
    '--dec-tab-margin-lr': `${px(groupTitle.marginLeftRight)}px`,
    '--dec-tab-title-size': `${px(groupTitle.bigTitleFontSize, 14)}px`,
    '--dec-tab-title-color': groupTitle.titleColor ?? '#444444',
    '--dec-tab-title-active-color': groupTitle.activeTitleColor ?? '#FF0F23',
    '--dec-tab-active-bg': groupTitle.activeTitleBgColor ?? '#ffebf1',
    '--dec-tab-title-min-width': `${px(groupTitle.titleMinWidth, 80)}px`,
    '--dec-tab-title-padding-tb': `${px(groupTitle.titlePaddingTopBottom, 8)}px`,
    '--dec-tab-title-padding-lr': `${px(groupTitle.titlePaddingLeftRight, 12)}px`,
    '--dec-tab-title-radius': `${px(groupTitle.titleRadius, 4)}px`,
    '--dec-tab-line-color': groupTitle.splitLineColor ?? '#DADADA',
  };
  return (
    <div
      className={`dec-product-group dec-product-group--card-style-${module.productCardStyle ?? 1} dec-product-group--list-style-${listStyle}`}
      style={cssVars}
    >
      {/* 旧版 __container 背景来自 contentStyle.backgroundColor（--dec-content-bg），勿再叠画 moduleStyle 背景 */}
      <div className="dec-product-group__container">
        {showGroupTitle ? (
          <div className="dec-product-group__tabs-wrapper">
            {showLeftArrow ? (
              <div className="dec-product-group__arrow dec-product-group__arrow--left" onClick={() => scrollTabs('left')}>
                <span className="dec-product-group__arrow-btn">
                  <svg className="dec-product-group__arrow-icon dec-product-group__arrow-icon--flip" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 5 7 7-7 7" />
                  </svg>
                </span>
              </div>
            ) : null}
            <div className="dec-product-group__tabs" ref={tabsRef} onScroll={updateArrows}>
              {groups.map((group, index) => (
                <div
                  className={`dec-product-group__tab${index === active ? ' dec-product-group__tab--active' : ''}`}
                  key={index}
                  onClick={() => handleTabClick(index)}
                >
                  {index > 0 ? <div className="dec-product-group__tab-line" /> : null}
                  <div className="dec-product-group__tab-content">
                    {picSrc(group.titlePic) ? <img className="dec-product-group__tab-icon" src={picSrc(group.titlePic)} alt="" /> : null}
                    <div className="dec-product-group__tab-title">{group.title || t('分组 {n}', { n: index + 1 })}</div>
                  </div>
                </div>
              ))}
            </div>
            {showRightArrow ? (
              <div className="dec-product-group__arrow dec-product-group__arrow--right" onClick={() => scrollTabs('right')}>
                <span className="dec-product-group__arrow-btn">
                  <svg className="dec-product-group__arrow-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m9 5 7 7-7 7" />
                  </svg>
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="dec-product-group__products">
          <div className="dec-product-group__list">
            {loading ? (
              Array.from({ length: gridColumns }).map((_, index) => (
                <div className="dec-product-group__item" key={`skeleton-${index}`}>
                  <div className="dec-product-group__card"><span className="dec-skeleton-line" /></div>
                </div>
              ))
            ) : products.length ? (
              products.map((product, index) => {
                const tags = activityTagsOf(promotions, product.productId);
                return (
                // 旧 listStyle=5 瀑布：index%3===0 的项占满整行，其余两项各占一半
                <div
                  className="dec-product-group__item"
                  key={product.productSn || product.productId || index}
                  style={listStyle === 5 && index % 3 === 0 ? { gridColumn: '1 / -1' } : undefined}
                >
                  <Link className="dec-product-group__card" href={product.seoLink || `/product/${product.productSn || product.productId || ''}`} target="_blank">
                    <div className="dec-product-group__image">
                      <img className="dec-product-group__image-inner" src={product.picUrl || product.picThumb || ''} alt={product.productName || ''} loading="lazy" />
                    </div>
                    <div className="dec-product-group__info">
                      {showName ? <div className="dec-product-group__name">{product.productName}</div> : null}
                      {showSales ? (
                        <div className="dec-product-group__status-wrap">
                          <div className="dec-product-group__sales">已售 {product.virtualSales ?? 0}</div>
                        </div>
                      ) : null}
                      {tags.length ? (
                        <div className="dec-product-group__tag-wrap">
                          {tags.map((tag) => (
                            <span className="dec-product-group__tag" key={tag}>{tag}</span>
                          ))}
                        </div>
                      ) : null}
                      <div className="dec-product-group__price-box">
                        <div className="dec-product-group__price-row">
                          {/* 旧 FormatPrice 三段式：￥16px + 整数 28px/600 + 小数 16px，色 var(--primary-dark-2) */}
                          {showPrice ? (
                            <span className="dec-product-group__price">
                              <span className="dec-product-group__price-currency">￥</span>
                              <span className="dec-product-group__price-int">{priceParts(product.productPrice).int}</span>
                              <span className="dec-product-group__price-dec">{priceParts(product.productPrice).dec}</span>
                            </span>
                          ) : null}
                          {showCrossed ? (
                            <s className="dec-product-group__price-origin">
                              <span className="dec-product-group__price-origin-currency">￥</span>
                              {priceParts((product as any).marketPrice).int}
                              {priceParts((product as any).marketPrice).dec}
                            </s>
                          ) : null}
                        </div>
                        {showBuy ? (
                          <button
                            type="button"
                            className={`dec-product-group__cart-btn dec-product-group__cart-btn--style-${Number(module.buyBtnStyle?.btnType ?? 1) || 1}${productSoldOut(product) ? ' is-disabled' : ''}`}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void buyProduct(product);
                            }}
                          >
                            <span className="dec-product-group__cart-inner">
                              {Number(module.buyBtnStyle?.btnType ?? 1) === 2 ? (
                                <BuyIconCart />
                              ) : Number(module.buyBtnStyle?.btnType ?? 1) === 3 ? (
                                <BuyIconCartCircle />
                              ) : (
                                <BuyIconPlus />
                              )}
                            </span>
                          </button>
                        ) : null}
                      </div>
                      {/* 原版 __shop：多商户显示 shop.shopTitle，否则「官方自营」 */}
                      {showShopTag ? (
                        <div className="dec-product-group__shop">{(product as any).shop?.shopTitle || t('官方自营')}</div>
                      ) : null}
                    </div>
                  </Link>
                </div>
                );
              })
            ) : (
              <div className="dec-empty">{t('该分组暂无商品')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ======================= 9.5 ProductGroup 购买按钮图标（旧 SvgIcon buy-jia/buy-cart/buy-cart-circle） ======================= */

function BuyIconPlus() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 4.5v15M4.5 12h15" />
    </svg>
  );
}

function BuyIconCart() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 3.5h2.2l2.2 10.9a1.6 1.6 0 0 0 1.6 1.3h8.2a1.6 1.6 0 0 0 1.6-1.25L20.3 7H6" />
      <circle cx="9.5" cy="19.6" r="1.4" />
      <circle cx="17.5" cy="19.6" r="1.4" />
    </svg>
  );
}

function BuyIconCartCircle() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="12" cy="12" r="10.2" />
      <g strokeLinecap="round" strokeLinejoin="round">
        <path d="M7.5 8.5h1.6l1.5 7.1a1.2 1.2 0 0 0 1.2 1h4.1a1.2 1.2 0 0 0 1.2-.95L18.3 11H9.4" />
        <circle cx="11" cy="18.4" r="0.9" />
        <circle cx="15.6" cy="18.4" r="0.9" />
      </g>
    </svg>
  );
}

/* ======================= 10. 契约渲染（原版 camelCase type） ======================= */

/** 契约渲染计划的目标组件表：键与 contract.ts 的 ContractRenderPlan.component 对应。 */
export const CONTRACT_COMPONENTS: Record<string, (props: ModuleProps) => JSX.Element | null> = {
  GroupBanner,
  Product,
  RecommendProduct,
  Coupon,
  Seckill,
  Groupon,
  ImageAd,
  ContractBanner,
  ContractCatProduct,
  ContractCategoryHot,
  ContractCustomAd,
  ContractCustomAd1,
  CategoryNav3,
  Banner2,
  // ---- 店铺装修（旧版 pages/shop/src/ShopHomepage.vue 的 camelCase type）----
  ImageNav,
  ImageSquareAd,
  ImageHotarea,
  TitleAd,
  Notice,
  Divider,
  Spacer,
};

/** pcBanner bannerStyle=1：picList 首图主图 + picList2 小图列 + picList3 图标行（原版轮播降级为静态图）。 */
function ContractBanner({ module }: ModuleProps) {
  const main: any[] = module.main || [];
  const recommend: any[] = module.recommend || [];
  const icons: any[] = module.icons || [];
  const hero = main[0];
  if (!hero && !recommend.length && !icons.length) return null;
  return (
    <Container module={FLAT_FRAME}>
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          {hero ? (
            <a href={navHref(hero.picLink) || '#'} target="_blank" rel="noreferrer">
              <img src={picSrc(hero)} alt={hero.picTitle || ''} style={{ width: '100%', display: 'block', borderRadius: 8 }} />
            </a>
          ) : null}
        </div>
        {recommend.length ? (
          <div style={{ width: 252, flexShrink: 0, display: 'grid', gap: 8, alignContent: 'start' }}>
            {recommend.slice(0, 4).map((pic: any, index: number) => (
              <a key={index} href={navHref(pic.picLink) || '#'} target="_blank" rel="noreferrer">
                <img src={picSrc(pic)} alt={pic.picTitle || ''} style={{ width: '100%', display: 'block', borderRadius: 8 }} />
              </a>
            ))}
          </div>
        ) : null}
      </div>
      {icons.length ? (
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          {icons.map((pic: any, index: number) => (
            <a key={index} href={navHref(pic.picLink) || '#'} target="_blank" rel="noreferrer" style={{ flex: 1 }}>
              <img src={picSrc(pic)} alt={pic.picTitle || ''} style={{ width: '100%', display: 'block' }} />
            </a>
          ))}
        </div>
      ) : null}
    </Container>
  );
}

/** pcCatProductNormal / pcCatProductWide / pcCatProductSimple 共用：标题 + 关键词链接行 + 可选图片条 + 商品网格。
 *  原版视觉字段（CatProductNormal.vue / CatProductWide.vue）：
 *  - color/color2 → 标题栏 `linear-gradient(30deg, color, color2)` 白字渐变条；
 *  - enTitle（Wide）→ 渐变栏内的英文副标题；
 *  - picList2 → 促销卡列（Normal 前 4 张 / Wide 前 6 张），副标题用 color 着色。 */
function ContractCatProduct({ module }: ModuleProps) {
    const { t } = useTranslation();
  const links: Array<{ link: string; text: string }> = module.links || [];
  const moreHref = linkHref(module.moreLink);
  const bannerPics: any[] = module.banner?.picList || [];
  const promoPics: any[] = module.picList2 || [];
  const color = typeof module.color === 'string' ? module.color : '';
  const color2 = typeof module.color2 === 'string' ? module.color2 : '';
  const enTitle = typeof module.enTitle === 'string' ? module.enTitle : '';
  /**
   * 旧版分类商品模块有两种形态，宽度语义不同，不能混用：
   * - pcCatProductNormal（CatProductNormal.vue:169-171）：楼层块固定 608px 宽，
   *   在旧链首页 .home-warp 的 flex 两列里占一列；
   * - pcCatProductSimple（CatProductSimple.vue:97-120）：baseStyle==2 为
   *   「左图 230px + 右商品 950px」的左右结构，整块仍是通栏。
   */
  const columnWidth = module.layoutWidth === 608 ? 608 : undefined;
  /**
   * pcCatProductSimple 的 baseStyle==2：左图 + 右侧商品网格
   * （旧版 components/home/CatProductSimple.vue:16-21，
   *  左图取 picList[0]，左 230px / 右 950px 的 flex 布局）。
   */
  const isSimpleLeftLayout = Number(module.baseStyle) === 2 && bannerPics.length > 0;
  const leftPic = isSimpleLeftLayout ? bannerPics[0] : null;
  // 旧版 floor_tit 渐变条（CatProductNormal.vue:124 / CatProductWide.vue:118-119）
  const titGradient = color || color2
    ? `linear-gradient(30deg, ${color || color2} 0%, ${color2 || color} 100%)`
    : undefined;
  const promoCount = module.layoutWidth === 608 ? 4 : 6;
  const promoCards = (promoPics.length ? (
    <div className="dec-cat-promo">
      {promoPics.slice(0, promoCount).map((pic: any, index: number) => (
        <a
          key={index}
          className="dec-cat-promo__card"
          href={navHref(pic.picLink) || '#'}
          target="_blank"
          rel="noreferrer"
          title={pic.picTitle || ''}
        >
          <p className="dec-cat-promo__tit">{pic.picTitle || ''}</p>
          <p className="dec-cat-promo__sub" style={color ? { color } : undefined}>{pic.picDesc || ''}</p>
          <span className="dec-cat-promo__img">
            <img src={picSrc(pic)} alt={pic.picTitle || ''} loading="lazy" />
          </span>
        </a>
      ))}
    </div>
  ) : null);
  return (
    <Container module={FLAT_FRAME} className="dec-cat-product" style={columnWidth ? { width: `${columnWidth}px` } : undefined}>
      {titGradient ? (
        <div className="dec-cat-product__tit" style={{ background: titGradient }}>
          <div className="dec-cat-product__tit-row">
            <h4>{module.title?.titleText || module.title || ''}<i className="iconfont-pc icon-yuanjiaojiantouyou" /></h4>
            {enTitle ? <p className="dec-cat-product__tit-en">{enTitle}</p> : null}
          </div>
          {links.length ? (
            <div className="dec-cat-product__tit-links">
              {links.map((item, index) => (
                <a key={index} href={navHref(item.link) || '#'}>{item.text}{index < links.length - 1 ? ' |' : ''}</a>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <ShopTitle title={module.title} />
      )}
      {!titGradient && (links.length || moreHref) ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 12, margin: '4px 0 10px', fontSize: 13, color: '#666' }}>
          {links.map((item, index) => (
            <a key={index} href={navHref(item.link) || '#'}>{item.text}</a>
          ))}
          {moreHref ? <a href={moreHref} style={{ marginLeft: 'auto', color: 'var(--pc-primary)' }}>{t('查看更多 ›')}</a> : null}
        </div>
      ) : null}
      {isSimpleLeftLayout ? (
        <div className="dec-cat-product__simple">
          {/* 左侧固定图（picList[0]） */}
          <div className="dec-cat-product__simple-left">
            {leftPic?.picLink ? (
              <a href={navHref(leftPic.picLink) || '#'} target="_blank" rel="noreferrer">
                <img src={leftPic.picUrl || leftPic.picThumb || ''} alt={module.title?.titleText || ''} />
              </a>
            ) : (
              <img src={leftPic?.picUrl || leftPic?.picThumb || ''} alt={module.title?.titleText || ''} />
            )}
          </div>
          {/* 右侧商品网格 */}
          <div className="dec-cat-product__simple-right">
            <Product module={{ products: module.product || {}, frame: FLAT_FRAME }} />
          </div>
        </div>
      ) : (
        <>
          {/* 原版：左侧 picList 轮播/图条 + 右侧 picList2 促销卡（CatProductNormal.vue:22-48） */}
          <div className={promoCards ? 'dec-cat-product__row' : undefined}>
            {bannerPics.length ? <ImageAd module={{ picList: bannerPics, frame: FLAT_FRAME }} /> : null}
            {promoCards}
          </div>
          <Product module={{ products: module.product || {}, frame: FLAT_FRAME }} />
        </>
      )}
    </Container>
  );
}

/** pcCategoryNav / pcCategoryNav3 / pcCatWide 共用：热门分类卡片（category/hot），可按 catIds 过滤。 */
function ContractCategoryHot({ module }: ModuleProps) {
    const { t } = useTranslation();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const catIds: number[] = module.catIds || [];

  useEffect(() => {
    let cancelled = false;
    fetch('/api/category/category/hot')
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return;
        const list = json?.data?.records || json?.data || json?.records || [];
        setCategories(Array.isArray(list) ? list : []);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;
  const filtered = catIds.length ? categories.filter((category) => catIds.includes(Number(category.categoryId))) : categories;
  if (!filtered.length) return null;
  const rowNum = Math.min(10, Math.max(1, Number(module.rowNum) || 6));
  const moreHref = module.showMore ? linkHref(module.moreLink) : '';

  return (
    <Container module={FLAT_FRAME}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <ShopTitle title={module.title} />
        {moreHref ? <a href={moreHref} style={{ fontSize: 13, color: '#666', whiteSpace: 'nowrap' }}>{module.moreText || t('查看更多')} ›</a> : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rowNum}, minmax(0, 1fr))`, gap: 12 }}>
        {filtered.map((category: any, index: number) => (
          <a key={category.categoryId || index} href={`/search?categoryId=${category.categoryId || ''}`} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '8px 4px', textAlign: 'center' }}>
            <img src={category.categoryPic || category.picUrl || category.picThumb || ''} alt={category.categoryName || ''} style={{ width: 48, height: 48, objectFit: 'contain', background: module.imageBackgroundColor || 'transparent', borderRadius: 8 }} />
            <span style={{ fontSize: 14, color: '#333' }}>{category.categoryName || t('分类')}</span>
          </a>
        ))}
      </div>
    </Container>
  );
}

/** pcCustomAd1 / pcCustomAd2 共用：可选链接行 + 三组图片顺次平铺。 */
function ContractCustomAd({ module }: ModuleProps) {
  const groups: any[][] = module.groups || [];
  const links: Array<{ link: string; text: string }> = module.links || [];
  const hasPics = groups.some((group) => group.length);
  if (!hasPics && !links.length) return null;
  return (
    <Container module={FLAT_FRAME}>
      {links.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '0 0 10px', fontSize: 13, color: '#666' }}>
          {links.map((item, index) => (
            <a key={index} href={navHref(item.link) || '#'}>{item.text}</a>
          ))}
        </div>
      ) : null}
      {groups.map((group, index) => (group.length ? <ImageAd key={index} module={{ picList: group, frame: FLAT_FRAME }} /> : null))}
    </Container>
  );
}

/** pcCustomAd1 专用：CustomAd1.vue 固定三列编辑版式 ——
 *  左大图(picList[0] 270x400) + 中「每日推荐」(picList2：banner + 行卡) + 右「热销精品」
 *  (picList3：banner + 两行卡 + 底部两张 GO >> 图)，标题条金色 #dfa747 / 橙色 #f39156。 */
function ContractCustomAd1({ module }: ModuleProps) {
  const { t } = useTranslation();
  const left: any[] = module.picList || [];
  const rec: any[] = module.picList2 || [];
  const hot: any[] = module.picList3 || [];
  if (!left.length && !rec.length && !hot.length) return null;
  const pic = (item: any) => item?.picUrl || item?.picThumb || '';
  const href = (item: any) => navHref(item?.picLink) || '#';
  const SectionTit = ({ text, icon, tone }: { text: string; icon: string; tone: string }) => (
    <h4 className="dec-ad1__tit">
      <em style={{ background: tone, borderTopColor: tone }}>
        <u className="dec-ad1__tri-l" style={{ borderBottomColor: tone }} />
        <u className="dec-ad1__tri-r" style={{ borderBottomColor: tone }} />
        <i className={`iconfont-pc ${icon}`} />
        <span>{text}</span>
      </em>
    </h4>
  );
  return (
    <Container module={FLAT_FRAME}>
      <div className="dec-ad1">
        {/* 左：大图 270x400 */}
        <div className="dec-ad1__left">
          {left[0] ? (
            <a href={href(left[0])} target="_blank" rel="noreferrer" title={left[0]?.picTitle || ''}>
              <img className="dec-ad1__left-img" src={pic(left[0])} alt={left[0]?.picTitle || ''} />
            </a>
          ) : null}
        </div>
        {/* 中：每日推荐（picList2[0] 竖图 + picList2[1..] 行卡） */}
        {rec.length ? (
          <div className="dec-ad1__panel dec-ad1__mr10">
            <SectionTit text={t('每日推荐')} icon="icon-jingpin" tone="#dfa747" />
            <div className="dec-ad1__panel-body">
              {rec[0] ? (
                <a className="dec-ad1__banner" href={href(rec[0])} target="_blank" rel="noreferrer" title={rec[0]?.picTitle || ''}>
                  <img className="dec-ad1__banner-img" src={pic(rec[0])} alt={rec[0]?.picTitle || ''} />
                </a>
              ) : null}
              <div className="dec-ad1__rows">
                <ul>
                  {rec.slice(1).map((item, index) => (
                    <li key={index}>
                      <a href={href(item)} target="_blank" rel="noreferrer" title={item?.picTitle || ''}>
                        <p className="dec-ad1__row-tit">{item?.picTitle || ''}</p>
                        <p className="dec-ad1__row-sub">{item?.picDesc || ''}</p>
                        <img className="dec-ad1__row-img" src={pic(item)} alt={item?.picTitle || ''} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : null}
        {/* 右：热销精品（picList3[0] banner + [1]/[2] 行卡 + [3]/[4] GO >> 图） */}
        {hot.length ? (
          <div className="dec-ad1__panel">
            <SectionTit text={t('热销精品')} icon="icon-jingpintuijian" tone="#f39156" />
            <div className="dec-ad1__panel-body dec-ad1__panel-body--hot">
              {hot[0] ? (
                <a className="dec-ad1__banner dec-ad1__banner--hot" href={href(hot[0])} target="_blank" rel="noreferrer" title={hot[0]?.picTitle || ''}>
                  <img className="dec-ad1__banner-img" src={pic(hot[0])} alt={hot[0]?.picTitle || ''} />
                  <p className="dec-ad1__row-tit">{hot[0]?.picTitle || ''}</p>
                  <p className="dec-ad1__row-sub">{hot[0]?.picDesc || ''}</p>
                </a>
              ) : null}
              <div className="dec-ad1__rows">
                <ul>
                  {hot.slice(1, 3).map((item, index) => (
                    <li key={index}>
                      <a href={href(item)} target="_blank" rel="noreferrer" title={item?.picTitle || ''}>
                        <p className="dec-ad1__row-tit">{item?.picTitle || ''}</p>
                        <p className="dec-ad1__row-sub">{item?.picDesc || ''}</p>
                        <img className="dec-ad1__row-img" src={pic(item)} alt={item?.picTitle || ''} />
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="dec-ad1__life">
              {hot.slice(3, 5).map((item, index) => (
                <a key={index} className="dec-ad1__life-item" href={href(item)} target="_blank" rel="noreferrer" title={item?.picTitle || ''}>
                  <img className="dec-ad1__life-img" src={pic(item)} alt={item?.picTitle || ''} />
                  <p className="dec-ad1__life-tit">{item?.picTitle || ''}</p>
                  <p className="dec-ad1__life-go">GO<em> &gt;&gt;</em></p>
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Container>
  );
}

/* ======================= 注册表 / 渲染入口 ======================= */

function Fallback({ module }: ModuleProps) {
    const { t } = useTranslation();
  return (
    <Container module={FLAT_FRAME}>
      <div className="dec-fallback">
        <span>{module.label || t('装修模块')}</span>
        <span className="dec-fallback__hint">{t('该模块已注册，React 版渲染待补齐')}</span>
      </div>
    </Container>
  );
}

export const PC_MODULE_REGISTRY: Record<string, (props: ModuleProps) => JSX.Element | null> = {
  'pc-image-ad': ImageAd,
  'pc-image-nav': ImageNav,
  'pc-image-square-ad': ImageSquareAd,
  'pc-image-hotarea': ImageHotarea,
  'pc-title-ad': TitleAd,
  'pc-notice': Notice,
  'pc-divider': Divider,
  'pc-spacer': Spacer,
  'pc-home-quick-nav': QuickNav,
  'pc-category-nav': CategoryNav,
  'pc-home-hero': HomeHero,
  'pc-product': Product,
  'pc-recommend-product': RecommendProduct,
  'pc-product-group': ProductGroup,
  'pc-home-coupon': Coupon,
  'pc-home-seckill': Seckill,
  'pc-home-groupon': Groupon,
  'pc-group-banner': GroupBanner,
  'pc-banner2': Banner2,
  'pc-category-nav3': CategoryNav3,
};

export function DecorateRenderer({ modules }: { modules: DecorateModule[] }) {
  type ModuleComponent = (props: ModuleProps) => JSX.Element | null;
  /**
   * 旧链首页容器内是 flex 两列（.home-warp），宽模块（分类商品系 608px）占一列、
   * 窄模块并排另一列；customAd / recommendProduct 这类横贯模块需独占整行。
   * 新版此前全部单列纵向流 → 旧版后台配的版式在首页看不到。
   */
  const FULL_WIDTH_TYPES = new Set(['pcCustomAd1', 'pcCustomAd2', 'pcRecommendProduct', 'pcGroupBanner', 'pcCoupon']);
  return (
    <div className="decorate-renderer">
      {modules
        .filter((item) => item.isShow !== false)
        .map((item, index) => {
          let Component: ModuleComponent | undefined = PC_MODULE_REGISTRY[item.type];
          let moduleProps: { module: Record<string, any> } = {
            module: { ...item.module, label: item.label, frame: item.module?.frame },
          };
          if (!Component) {
            const adapter = CONTRACT_ADAPTERS[item.type];
            if (adapter) {
              const plan: ContractRenderPlan = adapter(item);
              const contractComponent: ModuleComponent | undefined = CONTRACT_COMPONENTS[plan.component];
              if (contractComponent) {
                Component = contractComponent;
                moduleProps = { module: plan.module };
              }
            }
          }
          if (!Component) Component = Fallback;
          const isFullWidth = FULL_WIDTH_TYPES.has(item.type);
          return (
            <div
              className={`decorate-renderer__module home-warp__item${isFullWidth ? ' home-warp__item--full' : ''}`}
              key={item.moduleIndex ?? `${item.type}-${index}`}
            >
              <Component module={moduleProps.module} />
            </div>
          );
        })}
    </div>
  );
}

export type { PageModule };

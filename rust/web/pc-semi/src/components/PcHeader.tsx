'use client';

/**
 * PC 头部主体（源码：PcHeaderOverseasRuntime.vue / PcHeaderSimpleRuntime.vue）
 *
 * 结构对齐源码：
 * .pc-header-runtime > PcHeaderTopBar
 *   ├ 购物车页：PcHeaderCartContent（仅 logo + 购物车标题 + 搜索）
 *   └ 其它页面：.page-container(.pc-header-divider--*) > .page-header-inner > .page-c-warap
 *       ├ .page-header-home__left：.logo-slot(.logo-slot--wide) + .logo(.logo--left/center/right) + .category-nav
 *       ├ .page-header-home__center：.search-nav-box > .search-bar + .sub-nav.sub-nav--stacked(.sub-nav--home)
 *       └ .page-header-home__right：.language-bar + .mine-bar + .car-bar
 *
 * styleType：1=简约风，2=跨境风（跨境站点默认 2，与源码 isOverseas 口径一致）。
 * isWhite：源码 PageHeader 固定传 true（全站白色头部）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import PcHeaderTopBar from '@/components/PcHeaderTopBar';
import PcHeaderCartContent from '@/components/PcHeaderCartContent';
import PcHeaderSimple from '@/components/PcHeaderSimple';
import PcLocaleSelect from '@/components/PcLocaleSelect';
import PcMine from '@/components/PcMine';
import PcCartEntry from '@/components/PcCartEntry';
import PcAllCategory from '@/components/PcAllCategory';
import PcSearchBox from '@/components/PcSearchBox';
import PcShopSearchInput from '@/components/PcShopSearchInput';
import type { PcHeaderConfig } from '@/decorate/types';
import { imageUrl } from '@/decorate/components/common';
import type { PcHeaderBootstrap } from '@/lib/header-bootstrap';

const FALLBACK_NAV = [
  { title: '首页', link: '/' },
  { title: '全部商品', link: '/search' },
  { title: '回收业务', link: '/search?keyword=回收' },
  { title: '工程服务', link: '/search?keyword=工程' },
  { title: '资讯中心', link: '/article' },
];

type DividerStyle = 'shadow' | 'border' | 'none';
type HeaderConfig = Record<string, any>;

function normalizeBottomDividerStyle(value: unknown, fallback: DividerStyle): DividerStyle {
  if (value == null) return fallback;
  if (typeof value === 'number') {
    if (value === 1) return 'shadow';
    if (value === 2) return 'border';
    if (value === 0) return 'none';
    return fallback;
  }
  const raw = String(value).trim().toLowerCase();
  if (['1', 'shadow', '阴影'].includes(raw)) return 'shadow';
  if (['2', 'border', 'line', '边框'].includes(raw)) return 'border';
  if (['3', 'none', 'hidden', 'no', '不显示', '无'].includes(raw)) return 'none';
  return fallback;
}

function resolveFiniteNonNegativePx(value: unknown): number | null {
  if (value == null) return null;
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, number);
}

function resolveMainNavSpacingPx(config: HeaderConfig, dir: 'top' | 'bottom'): number | null {
  const keys =
    dir === 'top'
      ? ['mainNavMarginTop', 'mainNavTopMargin', 'mainNavPaddingTop']
      : ['mainNavMarginBottom', 'mainNavBottomMargin', 'mainNavPaddingBottom', 'componentMarginBottom'];
  for (const key of keys) {
    const value = resolveFiniteNonNegativePx(config[key]);
    if (value != null) return value;
  }
  return null;
}

function navHrefOf(item: Record<string, any>): string {
  const link = item?.link;
  if (!link) return '/';
  if (typeof link === 'string') return link;
  return link.link || link.appLink || '/';
}

function navTitleOf(item: Record<string, any>): string {
  return String(item?.title ?? item?.name ?? item?.label ?? '');
}

export default function PcHeader({
  config,
  isWhite = true,
  page = '',
  shopSearch,
  bootstrap = null,
}: {
  config?: PcHeaderConfig | null;
  isWhite?: boolean;
  page?: string;
  shopSearch?: boolean;
  /** 服务端预取的头部公共数据（Logo / 语言 / 货币），由 PcHeaderWithData 注入 */
  bootstrap?: PcHeaderBootstrap | null;
}) {
  const pathname = usePathname();
  const header = (config || {}) as HeaderConfig;

  const bootstrapLogo = typeof bootstrap?.base?.shopLogo === 'string' ? bootstrap.base.shopLogo : '';
  /** Logo 链接的可访问名称：图片是装饰性的，靠这个名称让读屏/自动检查能认出“回首页”链接。 */
  const shopName = String((bootstrap?.base as Record<string, unknown> | undefined)?.shopTitle || '万物新生');
  const [siteLogo, setSiteLogo] = useState(bootstrapLogo);
  const [mainNav, setMainNav] = useState<Array<Record<string, any>> | null>(null);
  const [logoAreaHeight, setLogoAreaHeight] = useState(60);
  const [logoAreaShiftY, setLogoAreaShiftY] = useState(0);
  const [navOffsetLeft, setNavOffsetLeft] = useState<number | null>(null);
  const [navOffsetRight, setNavOffsetRight] = useState<number | null>(null);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);

  const logo = imageUrl(header.logoPic);
  const logoWidth = Number(header.logoWidth) || 110;
  const logoHeight = Number(header.logoHeight) || 40;
  const logoAlign = Number(header.logoAlign) || 1;
  const logoAlignClass = logoAlign === 2 ? 'logo--center' : logoAlign === 3 ? 'logo--right' : 'logo--left';

  // 源码：styleType 缺省时跨境版为 2；本站为跨境站点。
  const styleType: 1 | 2 = Number(header.styleType) === 1 ? 1 : 2;
  const isHome = pathname === '/';
  const isCartPage = pathname === '/cart' || pathname.startsWith('/cart/');
  const resolvedShopSearch = shopSearch ?? pathname.startsWith('/shop/search');

  const showMainNav = Number(header.showMainNav ?? 1) !== 0;
  const showCategory =
    Number(header.showCategory ?? 1) !== 0 && (!isHome || Number(header.showHomeCategory ?? 1) !== 0);
  const showRightCart = Number(header.rightCartShow ?? 1) !== 0;
  const cartStyle = Number(header.cartStyle) || 1;
  const cartPic = imageUrl(header.cartPic as any);

  const searchAccentColor =
    Number(header.searchColorType ?? 1) === 2 ? String(header.searchColor || '#1a1a1a') : '';

  const dividerClass = useMemo(() => {
    const keys = [
      'bottomDividerType',
      'bottomDividerStyle',
      'headerBottomDividerStyle',
      'headerDividerStyle',
      'bottomLineStyle',
      'headerBottomLineStyle',
      'splitLineStyle',
    ];
    const key = keys.find((item) => header[item] != null);
    const style = normalizeBottomDividerStyle(key ? header[key] : undefined, 'shadow');
    return `pc-header-divider--${style}`;
  }, [header]);

  useEffect(() => {
    if (logo || siteLogo) return;
    let cancelled = false;
    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => {
        const url = json?.data?.shopLogo;
        if (!cancelled && typeof url === 'string' && url) setSiteLogo(url);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [logo, siteLogo]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/common/pc/getNav')
      .then((response) => response.json())
      .then((json) => {
        if (cancelled) return;
        const list = Array.isArray(json?.data?.mainNav) ? json.data.mainNav : [];
        setMainNav(list);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const navItems = useMemo<Array<Record<string, any>>>(() => {
    if (mainNav && mainNav.length) return mainNav;
    if (Array.isArray(header.mainNav) && header.mainNav.length) return header.mainNav as Array<Record<string, any>>;
    return FALLBACK_NAV as Array<Record<string, any>>;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mainNav, header.mainNav]);

  // 源码 measureSearchBlockHeight：logo 高度/垂直偏移与导航左右缩进按搜索框实际尺寸计算。
  useEffect(() => {
    if (isCartPage) return;
    if (typeof window === 'undefined') return;
    let frame = 0;
    const measure = () => {
      const root = searchWrapRef.current;
      if (!root) return;
      const searchRect = root.getBoundingClientRect();
      const wrapper = headerWrapperRef.current;
      const wrapperRect = wrapper?.getBoundingClientRect();
      if (wrapper && wrapperRect && Number.isFinite(searchRect.left) && Number.isFinite(searchRect.right) && searchRect.right > searchRect.left) {
        const style = window.getComputedStyle(wrapper);
        const contentLeft = wrapperRect.left + (Number.parseFloat(style.paddingLeft) || 0);
        const contentRight = wrapperRect.right - (Number.parseFloat(style.paddingRight) || 0);
        setNavOffsetLeft(Math.max(0, Math.round(searchRect.left - contentLeft)));
        setNavOffsetRight(Math.max(0, Math.round(contentRight - searchRect.right)));
      } else {
        setNavOffsetLeft(null);
        setNavOffsetRight(null);
      }
      const input = root.querySelector<HTMLElement>('.top-search') || root;
      const rect = input.getBoundingClientRect();
      if (Number.isFinite(rect.top) && Number.isFinite(rect.bottom) && rect.bottom > rect.top) {
        setLogoAreaHeight(Math.max(40, Math.ceil(rect.bottom - rect.top)));
        if (wrapperRect && Number.isFinite(wrapperRect.top) && wrapperRect.height > 0) {
          const searchCenterY = (rect.top + rect.bottom) / 2;
          const firstRowHeight = Math.min(wrapperRect.height, 60);
          const wrapperCenterY = wrapperRect.top + firstRowHeight / 2;
          setLogoAreaShiftY(Math.round(searchCenterY - wrapperCenterY));
        }
      }
    };
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = 0;
        measure();
      });
    };
    schedule();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(schedule);
      if (searchWrapRef.current) observer.observe(searchWrapRef.current);
      if (headerWrapperRef.current) observer.observe(headerWrapperRef.current);
    } else {
      window.addEventListener('resize', schedule, { passive: true });
    }
    return () => {
      if (frame) cancelAnimationFrame(frame);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', schedule);
    };
  }, [isCartPage, resolvedShopSearch, isHome, showCategory, showRightCart]);

  const headerVars: React.CSSProperties = {
    ['--pc-header-logo-area-h' as string]: `${logoAreaHeight}px`,
    ['--pc-header-logo-area-shift-y' as string]: `${logoAreaShiftY}px`,
    ['--pc-header-search-extra-bottom' as string]: '0px',
    ['--pc-header-padding-bottom' as string]: '0px',
  };
  const categoryNavStyle: React.CSSProperties = {
    ['--pc-header-category-mt' as string]: `${resolveFiniteNonNegativePx(header.categoryMarginTop) ?? 0}px`,
  };
  const searchAccentStyle: React.CSSProperties = searchAccentColor
    ? ({ ['--pc-header-search-accent' as string]: searchAccentColor } as React.CSSProperties)
    : {};
  const mainNavSpacingVars: React.CSSProperties = {
    ['--pc-header-main-nav-mt' as string]: `${resolveMainNavSpacingPx(header, 'top') ?? 0}px`,
    ...(resolveMainNavSpacingPx(header, 'bottom') != null
      ? { ['--pc-header-main-nav-mb' as string]: `${resolveMainNavSpacingPx(header, 'bottom')}px` }
      : {}),
    ...(navOffsetLeft != null ? { ['--pc-header-nav-offset-left' as string]: `${navOffsetLeft}px` } : {}),
    ...(navOffsetRight != null ? { ['--pc-header-nav-offset-right' as string]: `${navOffsetRight}px` } : {}),
  };

  if (styleType === 1) {
    return <PcHeaderSimple config={header} isWhite={isWhite} page={page} shopSearch={resolvedShopSearch} bootstrap={bootstrap} />;
  }

  const logoSrc = logo || siteLogo;

  return (
    <div className="pc-header-runtime">
      <PcHeaderTopBar config={header} styleType={styleType} isWhite={isWhite} baseConfig={bootstrap?.base} />

      {isCartPage ? (
        <PcHeaderCartContent config={header} isWhite={isWhite} page={page} shopSearch={resolvedShopSearch} />
      ) : (
        <div className={`page-container ${dividerClass}`}>
          <div className="page-header-inner" style={headerVars}>
            <div className="page-c-warap" ref={headerWrapperRef}>
              <div className="page-header-home__left">
                <div className={`logo-slot${showCategory ? '' : ' logo-slot--wide'}`}>
                  <div className={`logo ${logoAlignClass}`}>
                    <div className="logo-area">
                      <Link href="/" className="alv1 logo-link" aria-label={shopName}>
                        {logoSrc ? (
                          <img src={logoSrc} style={{ width: logoWidth, height: logoHeight, objectFit: 'contain' }} alt={shopName} />
                        ) : null}
                      </Link>
                    </div>
                  </div>
                </div>
                {showCategory ? (
                  <div className="category-nav" style={categoryNavStyle}>
                    <PcAllCategory isWhite={isWhite} />
                  </div>
                ) : null}
              </div>

              <div className="page-header-home__center">
                <div className="search-nav-box">
                  <div
                    className={`search-bar${searchAccentColor ? ' search-bar--accent' : ''}`}
                    ref={searchWrapRef}
                    style={searchAccentStyle}
                  >
                    {resolvedShopSearch ? (
                      <PcShopSearchInput page={page} />
                    ) : (
                      <PcSearchBox isWhite={isWhite} accentColor={searchAccentColor} />
                    )}
                  </div>
                  {showMainNav ? (
                    <ul className={`sub-nav sub-nav--stacked${isHome ? ' sub-nav--home' : ''}`} style={mainNavSpacingVars}>
                      {navItems.map((item, index) => (
                        <li key={index}>
                          <Link className="alv1" href={navHrefOf(item)}>
                            {navTitleOf(item)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>

              <div className="page-header-home__right">
                <div className="language-bar">
                  <PcLocaleSelect
                    isWhite={isWhite}
                    langLabelMode="localeCode"
                    className="item"
                    initialLocales={bootstrap?.locales}
                    initialCurrencies={bootstrap?.currencies}
                  />
                </div>
                <div className="mine-bar">
                  <PcMine isWhite={isWhite} baseConfig={bootstrap?.base} />
                </div>
                {showRightCart ? (
                  <div className="car-bar">
                    <PcCartEntry cartStyle={cartStyle} cartPic={cartPic} />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


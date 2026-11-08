'use client';

/**
 * PC 头部主体·简约风（源码：PcHeaderSimpleRuntime.vue，styleType=1）
 *
 * 结构与源码对齐：
 * .pc-header-runtime > PcHeaderTopBar(styleType=1)
 *   ├ 购物车页：PcHeaderCartContent
 *   └ .pc-header-simple > .pc-header-simple__header(--white / divider) > .pc-container
 *       └ .pc-header > .pc-header__wrapper（grid）
 *           ├ .pc-header-home__left：.pc-header__logo-slot + .pc-header__logo + .category-nav
 *           ├ .pc-header-home__center：.pc-header__search-nav > .pc-header__search + .sub-nav
 *           └ .pc-header-home__right：.pc-header__cart > .pc-cart（图标/图片两种样式）
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ShoppingCart from '@icon-park/react/es/icons/ShoppingCart';
import PcHeaderTopBar from '@/components/PcHeaderTopBar';
import PcHeaderCartContent from '@/components/PcHeaderCartContent';
import PcAllCategory from '@/components/PcAllCategory';
import PcSearchBox from '@/components/PcSearchBox';
import PcShopSearchInput from '@/components/PcShopSearchInput';
import type { PcHeaderConfig } from '@/decorate/types';
import { imageUrl } from '@/decorate/components/common';
import type { PcHeaderBootstrap } from '@/lib/header-bootstrap';

import { useTranslation } from 'react-i18next';
const FALLBACK_NAV = [
  { title: '首页', link: '/' },
  { title: '全部商品', link: '/search' },
  { title: '回收业务', link: '/search?keyword=回收' },
  { title: '工程服务', link: '/search?keyword=工程' },
  { title: '资讯中心', link: '/article' },
];

type DividerStyle = 'shadow' | 'border' | 'none';

function normalizeDivider(value: unknown, fallback: DividerStyle): DividerStyle {
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

function resolvePx(value: unknown): number | null {
  if (value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, number) : null;
}

function resolveMainNavSpacingPx(config: Record<string, any>, dir: 'top' | 'bottom'): number | null {
  const keys =
    dir === 'top'
      ? ['mainNavMarginTop', 'mainNavTopMargin', 'mainNavTopSpace', 'mainNavSpaceTop', 'mainNavPaddingTop', 'mainNavTopPadding', 'subNavMarginTop', 'subNavTopMargin', 'navMarginTop', 'navTopMargin']
      : ['mainNavMarginBottom', 'mainNavBottomMargin', 'mainNavBottomSpace', 'mainNavSpaceBottom', 'mainNavPaddingBottom', 'mainNavBottomPadding', 'subNavMarginBottom', 'subNavBottomMargin', 'navMarginBottom', 'navBottomMargin', 'componentMarginBottom'];
  for (const key of keys) {
    const value = resolvePx(config[key]);
    if (value != null) return value;
  }
  return null;
}

function navHref(item: Record<string, any>): string {
  const link = item?.link;
  if (!link) return '/';
  if (typeof link === 'string') return link;
  return link.link || link.appLink || '/';
}

export default function PcHeaderSimple({
  config,
  isWhite = true,
  page = '',
  shopSearch = false,
  bootstrap = null,
}: {
  config?: PcHeaderConfig | Record<string, any> | null;
  isWhite?: boolean;
  page?: string;
  shopSearch?: boolean;
  /** 服务端预取的头部公共数据（Logo），首屏即渲染 */
  bootstrap?: PcHeaderBootstrap | null;
}) {
    const { t } = useTranslation();
  const pathname = usePathname();
  const header = (config || {}) as Record<string, any>;
  const bootstrapLogo = typeof bootstrap?.base?.shopLogo === 'string' ? bootstrap.base.shopLogo : '';
  /** Logo 链接的可访问名称（图片是装饰性的，名称用它）。 */
  const shopName = String((bootstrap?.base as Record<string, unknown> | undefined)?.shopTitle || '万物新生');
  const [siteLogo, setSiteLogo] = useState(bootstrapLogo);
  const [mainNav, setMainNav] = useState<Array<Record<string, any>> | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [logoAreaHeight, setLogoAreaHeight] = useState(60);
  const [logoAreaShiftY, setLogoAreaShiftY] = useState(0);
  const [searchExtraBottom, setSearchExtraBottom] = useState(0);
  const [navOffsetLeft, setNavOffsetLeft] = useState<number | null>(null);
  const [navOffsetRight, setNavOffsetRight] = useState<number | null>(null);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const headerWrapperRef = useRef<HTMLDivElement>(null);

  const logo = imageUrl(header.logoPic);
  const logoWidth = Number(header.logoWidth) || 110;
  const logoHeight = Number(header.logoHeight) || 40;
  const logoAlign = Number(header.logoAlign) || 1;
  const logoAlignClass = logoAlign === 2 ? 'logo--center' : logoAlign === 3 ? 'logo--right' : 'logo--left';

  const isHome = pathname === '/';
  const isCartPage = pathname === '/cart' || pathname.startsWith('/cart/');
  const showMainNav = Number(header.showMainNav ?? 1) !== 0;
  const showCategory =
    Number(header.showCategory ?? 1) !== 0 && (!isHome || Number(header.showHomeCategory ?? 1) !== 0);
  const showRightCart = Number(header.rightCartShow ?? 1) !== 0;
  const cartStyle = Number(header.cartStyle) || 1;
  const cartPic = imageUrl(header.cartPic as any);
  const searchAccentColor =
    Number(header.searchColorType ?? 1) === 2 ? String(header.searchColor || '#1a1a1a') : '';

  const dividerClass = useMemo(() => {
    const keys = ['bottomDividerType', 'bottomDividerStyle', 'headerBottomDividerStyle', 'headerDividerStyle', 'bottomLineStyle', 'headerBottomLineStyle', 'splitLineStyle'];
    const key = keys.find((item) => header[item] != null);
    const style = normalizeDivider(key ? header[key] : undefined, 'border');
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
        if (!cancelled) setMainNav(Array.isArray(json?.data?.mainNav) ? json.data.mainNav : []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) return;
    let cancelled = false;
    fetch('/api/cart/cart/list', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
      .then((response) => response.json())
      .then((json) => {
        if (!cancelled) setCartCount(Number(json?.data?.total?.totalCount || 0));
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
  }, [mainNav, header.mainNav]);

  // 源码 ResizeObserver：logo 高度 + 导航左右缩进跟随搜索框实际尺寸
  useEffect(() => {
    if (isCartPage || typeof window === 'undefined') return;
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
        setSearchExtraBottom(0);
        if (wrapperRect && Number.isFinite(wrapperRect.top) && Number.isFinite(wrapperRect.height) && wrapperRect.height > 0) {
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
  }, [isCartPage, shopSearch, isHome, showCategory, showRightCart]);

  const headerVars: React.CSSProperties = {
    ['--pc-header-logo-area-h' as string]: `${logoAreaHeight}px`,
    ['--pc-header-logo-area-shift-y' as string]: `${logoAreaShiftY}px`,
    ['--pc-header-search-extra-bottom' as string]: `${searchExtraBottom}px`,
    ['--pc-header-padding-bottom' as string]: '0px',
  };
  const categoryNavStyle: React.CSSProperties = {
    ['--pc-header-category-mt' as string]: `${resolvePx(header.categoryMarginTop) ?? 0}px`,
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

  const logoSrc = logo || siteLogo;

  return (
    <div className="pc-header-runtime">
      <PcHeaderTopBar config={header} styleType={1} isWhite={isWhite} />

      {isCartPage ? (
        <PcHeaderCartContent config={header} isWhite={isWhite} page={page} shopSearch={shopSearch} />
      ) : (
        <div className="pc-header-simple">
          <div className={`pc-header-simple__header${isWhite ? ' pc-header-simple__header--white' : ''} ${dividerClass}`}>
            <div className="pc-container">
              <div className="pc-header" style={headerVars}>
                <div className="pc-header__wrapper" ref={headerWrapperRef}>
                  <div className="pc-header-home__left">
                    <div className={`pc-header__logo-slot${showCategory ? '' : ' pc-header__logo-slot--wide'}`}>
                      <div className={`pc-header__logo ${logoAlignClass}`}>
                        <div className="pc-header__logo-area">
                          <Link href="/" className="alv1 pc-header__logo-link" aria-label={shopName}>
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

                  <div className="pc-header-home__center">
                    <div className="pc-header__search-nav">
                      <div
                        className={`pc-header__search${searchAccentColor ? ' pc-header__search--accent' : ''}`}
                        ref={searchWrapRef}
                        style={searchAccentStyle}
                      >
                        {shopSearch ? (
                          <PcShopSearchInput page={page} />
                        ) : (
                          <PcSearchBox isWhite={isWhite} accentColor={searchAccentColor} />
                        )}
                      </div>
                      {showMainNav ? (
                        <ul className={`sub-nav sub-nav--stacked${isHome ? ' sub-nav--home' : ''}`} style={mainNavSpacingVars}>
                          {navItems.map((item, index) => (
                            <li key={index}>
                              <Link className="alv1" href={navHref(item)}>
                                {String(item?.title ?? '')}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>

                  <div className={`pc-header-home__right${showRightCart ? '' : ' pc-header-home__right--empty'}`}>
                    {showRightCart ? (
                      <div
                        className={`pc-header__cart${cartStyle === 2 ? ' pc-header__cart--pic' : ''}`}
                        role="button"
                        tabIndex={0}
                        onClick={() => {
                          window.location.href = '/cart';
                        }}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') window.location.href = '/cart';
                        }}
                      >
                        <div className={`pc-cart${cartStyle === 2 ? ' pc-cart--pic' : ''}${cartStyle === 2 && cartPic ? ' pc-cart--has-pic' : ''}`}>
                          {cartStyle === 2 ? (
                            cartPic ? (
                              <img className="pc-cart__pic" src={cartPic} alt="" />
                            ) : (
                              <div className="pc-cart__pic-empty">{t('购物车')}</div>
                            )
                          ) : (
                            <>
                              <span className="pc-icon pc-icon--cart pc-cart__icon">
                                <ShoppingCart size={20} />
                              </span>
                              {cartCount > 0 ? <span className="pc-cart__count">{cartCount}</span> : null}
                              <span className="pc-cart__text">{t('购物车')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


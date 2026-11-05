'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import { normalizeLocale, writeLocaleCookie } from '@/i18n';

type Region = { regionId: number; regionName: string };
type LocaleItem = { localeCode: string; language: string; isDefault?: number };
type NavItem = { id?: number; title?: string; link?: any; children?: NavItem[] };

function readNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function navHref(link: any): string {
  if (!link) return '';
  if (typeof link === 'string') return link;
  return link.link || link.appLink || '';
}

export default function PcHeaderTopBar({ config, showLocale = true, styleType = 1 }: { config: Record<string, any>; showLocale?: boolean; styleType?: number }) {
  const { i18n } = useTranslation();
  const [regions, setRegions] = useState<Region[]>([]);
  const [localeList, setLocaleList] = useState<LocaleItem[]>([]);
  const [localeCode, setLocaleCode] = useState('');
  const [regionId, setRegionId] = useState<number | null>(null);
  const [regionReady, setRegionReady] = useState(false);
  const [regionOpen, setRegionOpen] = useState(false);
  const [user, setUser] = useState<Record<string, any> | null>(null);
  const [siteNav, setSiteNav] = useState<NavItem[]>([]);
  const [cartCount, setCartCount] = useState(0);
  const [openMenu, setOpenMenu] = useState<'user' | 'member' | 'site' | null>(null);
  const regionTimer = useRef<number | null>(null);

  const showBar = readNumber(config.showBenefitBar, 1) !== 0 && readNumber(config.showTopMenuBar, 1) !== 0;
  const showRegion = readNumber(config.showTopRegion, 1) !== 0;
  const showMemberName = readNumber(config.showTopMemberName, 1) !== 0;
  const showMessage = readNumber(config.showTopMessage, 1) !== 0;
  const showOrders = readNumber(config.showTopOrders, 1) !== 0;
  const showSiteNav = readNumber(config.showTopSiteNav, 1) !== 0;
  const showCart = readNumber(config.topMenuCartShow, 1) !== 0;
  const showMemberCenter = readNumber(config.showTopMemberCenter, 1) !== 0;

  const memberCenterItems: Array<{ title: string; link: string }> = Array.isArray(config.memberCenterItems)
    ? config.memberCenterItems
        .map((item: any) => ({
          title: item?.picTitle || item?.title || '',
          link: item?.picLink?.link || item?.link || '',
        }))
        .filter((item: any) => item.title)
    : [
        { title: '我的足迹', link: '/member/browsingHistory/list' },
        { title: '我的优惠券', link: '/member/coupon/list' },
      ];

  useEffect(() => {
    fetch('/api/common/i18n/getLocales')
      .then((response) => response.json())
      .then((json) => {
        const list: LocaleItem[] = Array.isArray(json?.data) ? json.data : [];
        setLocaleList(list);
        const fromCookie = document.cookie.match(/(?:^|; )locale=([^;]+)/)?.[1] || '';
        const current = list.find((item) => item.localeCode === fromCookie)
          || list.find((item) => item.isDefault === 1)
          || list[0];
        if (current) setLocaleCode(current.localeCode);
      })
      .catch(() => undefined);

    fetch('/api/common/pc/getNav')
      .then((response) => response.json())
      .then((json) => setSiteNav(Array.isArray(json?.data?.topBarNav) ? json.data.topBarNav : []))
      .catch(() => undefined);

    const cookieId = Number(document.cookie.match(/(?:^|; )userProvinceId=([^;]+)/)?.[1]);
    const regionListRequest = fetch('/api/sys/region/getProvinceList').then((response) => response.json());
    if (Number.isFinite(cookieId) && cookieId > 0) {
      // 旧版 HeaderRegion：cookie 已存在时不请求 getUserRegion，直接使用用户选择的地区。
      setRegionId(cookieId);
      regionListRequest
        .then((regionJson) => setRegions(Array.isArray(regionJson?.data) ? regionJson.data : []))
        .catch(() => undefined)
        .finally(() => setRegionReady(true));
    } else {
      Promise.all([
        regionListRequest,
        fetch('/api/sys/region/getUserRegion').then((response) => response.json()),
      ])
        .then(([regionJson, userRegionJson]) => {
          setRegions(Array.isArray(regionJson?.data) ? regionJson.data : []);
          setRegionId(Number(userRegionJson?.data?.regionId) || null);
        })
        .catch(() => undefined)
        .finally(() => setRegionReady(true));
    }

    const token = localStorage.getItem('accessToken');
    if (token) {
      fetch('/api/user/user/detail', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
        .then((response) => response.json())
        .then((json) => setUser(json?.data || null))
        .catch(() => undefined);
      fetch('/api/cart/cart/list', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
        .then((response) => response.json())
        .then((json) => setCartCount(Number(json?.data?.total?.totalCount || 0)))
        .catch(() => undefined);
    }
  }, []);

  const selectRegion = (region: Region) => {
    setRegionId(region.regionId);
    document.cookie = `userProvinceId=${region.regionId}; path=/; max-age=31536000; SameSite=Lax`;
    setRegionOpen(false);
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    document.cookie = 'accessToken=; path=/; max-age=0';
    window.location.href = '/';
  };

  const enterRegion = () => {
    if (regionTimer.current) window.clearTimeout(regionTimer.current);
    setRegionOpen(true);
  };
  const leaveRegion = () => {
    regionTimer.current = window.setTimeout(() => setRegionOpen(false), 120);
  };

  if (!showBar) return null;

  const regionName = regions.find((item) => item.regionId === regionId)?.regionName || '';

  const changeLocale = (code: string) => {
    if (!code || code === localeCode) return;
    const next = normalizeLocale(code);
    writeLocaleCookie(next);
    setLocaleCode(code);
    void i18n.changeLanguage(next);
  };
  const userDisplayName = String(user?.nickname || user?.dimUsername || '会员');
  const backgroundColor = String(config.benefitBarBackgroundColor || '#1a1a1a');
  const textColor = String(config.topMenuTextColor || '#ffffffd6');
  const hoverColor = String(config.topMenuTextHoverColor || '#ffffff');
  const hasValue = (value: unknown) => value !== undefined && value !== null && String(value).trim() !== '';

  return (
    <div className={`pc-topbar pc-topbar--style-${styleType}`} style={{ background: backgroundColor, color: textColor, ['--pc-topbar-hover' as string]: hoverColor }}>
      <div className="pc-topbar__inner">
        {styleType === 1 ? (
        <div className="pc-topbar__left">
          {showRegion ? regionReady ? (
            <div className="pc-topbar__region" onMouseEnter={enterRegion} onMouseLeave={leaveRegion}>
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden="true">
                <path fill="currentColor" d="M12 2a7 7 0 0 0-7 7c0 5.25 7 13 7 13s7-7.75 7-13a7 7 0 0 0-7-7Zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5Z" />
              </svg>
              <span>{regionName}</span>
              {regionOpen && regions.length ? (
                <div className="pc-topbar__dropdown pc-topbar__region-dropdown">
                  {regions.map((region) => (
                    <button key={region.regionId} type="button" className={region.regionId === regionId ? 'is-active' : ''} onClick={() => selectRegion(region)}>
                      {region.regionName}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <div className="pc-topbar__region is-placeholder" aria-hidden="true"><span>全国</span></div>
          ) : null}

          {showMemberName ? (
            <div className="pc-topbar__member">
              {user ? (
                <div className="pc-topbar__user" onMouseEnter={() => setOpenMenu('user')} onMouseLeave={() => setOpenMenu(null)}>
                  <Link href="/member" className="pc-topbar__user-name">{userDisplayName} ▾</Link>
                  {openMenu === 'user' ? (
                    <div className="pc-topbar__dropdown pc-topbar__member-dropdown">
                      <div className="pc-topbar__member-head">
                        <span className="pc-topbar__avatar">{user.avatar ? <img src={user.avatar} alt="" /> : userDisplayName.slice(0, 1)}</span>
                        <b>{userDisplayName}</b>
                      </div>
                      <Link href="/member">账号管理</Link>
                      <button type="button" onClick={logout}>退出</button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="pc-topbar__auth">
                  <Link href="/login">你好，请登录</Link>
                  <span className="pc-topbar__sep" />
                  <Link href="/register">注册</Link>
                </div>
              )}
            </div>
          ) : null}
        </div>
        ) : null}

        <div className="pc-topbar__right">
          {showLocale && localeList.length > 1 ? (
            <select
              className="pc-topbar__locale"
              value={localeCode}
              onChange={(event) => changeLocale(event.target.value)}
              aria-label="切换语言"
            >
              {localeList.map((item) => (
                <option key={item.localeCode} value={item.localeCode}>{item.language}</option>
              ))}
            </select>
          ) : null}
          {showCart ? (
            <Link href="/cart" className="pc-topbar__link">
              购物车{cartCount > 0 ? ` ${cartCount}` : ''}
            </Link>
          ) : null}

          {styleType === 1 && showMemberCenter ? (
            <div className="pc-topbar__menu" onMouseEnter={() => setOpenMenu('member')} onMouseLeave={() => setOpenMenu(null)}>
              <button type="button" className="pc-topbar__link">会员中心 ▾</button>
              {openMenu === 'member' ? (
                <div className="pc-topbar__dropdown">
                  {memberCenterItems.map((item) => <Link key={item.title} href={item.link || '/member'}>{item.title}</Link>)}
                </div>
              ) : null}
            </div>
          ) : null}

          {styleType === 1 && showMessage ? <Link href="/member/userMessage/list" className="pc-topbar__link">站内消息</Link> : null}
          {styleType === 1 && showOrders ? <Link href="/member/order/list" className="pc-topbar__link">我的订单</Link> : null}

          {showSiteNav && siteNav.length ? (
            <div className="pc-topbar__menu" onMouseEnter={() => setOpenMenu('site')} onMouseLeave={() => setOpenMenu(null)}>
              <button type="button" className="pc-topbar__link">站点导航 ▾</button>
              {openMenu === 'site' ? (
                <div className="pc-topbar__dropdown pc-topbar__site-dropdown">
                  {siteNav.map((nav) => (
                    <div key={nav.id || nav.title} className="pc-topbar__site-group">
                      {hasValue(navHref(nav.link)) ? <Link href={navHref(nav.link)}>{nav.title}</Link> : <b>{nav.title}</b>}
                      {(nav.children || []).map((child) => (
                        <Link key={child.id || child.title} href={navHref(child.link) || '/'} className="pc-topbar__site-child">{child.title}</Link>
                      ))}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

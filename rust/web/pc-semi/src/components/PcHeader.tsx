'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Search from '@icon-park/react/es/icons/Search';
import HamburgerButton from '@icon-park/react/es/icons/HamburgerButton';
import Close from '@icon-park/react/es/icons/Close';
import PcHeaderTopBar from '@/components/PcHeaderTopBar';
import PcLocaleSelect from '@/components/PcLocaleSelect';
import PcMine from '@/components/PcMine';
import PcCartEntry from '@/components/PcCartEntry';
import type { PcHeaderConfig } from '@/decorate/types';
import { imageUrl } from '@/decorate/components/common';

const FALLBACK_NAV = [
  { title: '首页', link: '/' },
  { title: '全部商品', link: '/search' },
  { title: '回收业务', link: '/search?keyword=回收' },
  { title: '工程服务', link: '/search?keyword=工程' },
  { title: '资讯中心', link: '/article' },
];

export default function PcHeader({ config }: { config?: PcHeaderConfig | null }) {
  const pathname = usePathname();
  const [keyword, setKeyword] = useState('');
  const [siteLogo, setSiteLogo] = useState('');
  const [logoReady, setLogoReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const header = config || {};
  const logo = imageUrl(header.logoPic);
  const logoWidth = Number(header.logoWidth) || (pathname === '/' ? 190 : 140);
  // 旧版 PcHeaderRuntime：styleType 1=简约风，2=跨境风；跨境站点默认 2。
  const styleType = Number(header.styleType) === 1 ? 1 : 2;
  const showCategory = Number(header.showCategory ?? 1) !== 0
    && (pathname !== '/' || Number(header.showHomeCategory ?? 1) !== 0);
  const showRightCart = Number(header.rightCartShow ?? 1) !== 0;
  const cartStyle = Number(header.cartStyle) || 1;
  const cartPic = imageUrl(header.cartPic as any);
  const logoAlign = Number(header.logoAlign) || 1;

  useEffect(() => {
    if (logo) {
      setLogoReady(true);
      return;
    }
    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => {
        const url = json?.data?.shopLogo;
        if (typeof url === 'string' && url) setSiteLogo(url);
      })
      .catch(() => undefined)
      .finally(() => setLogoReady(true));
  }, [logo]);

  useEffect(() => {
    if (!menuOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [menuOpen]);
  const showNav = Number(header.showMainNav ?? 1) === 1;
  const navItems: Array<{ title?: string; link?: string; name?: string; label?: string }> = Array.isArray(header.mainNav) && header.mainNav.length ? header.mainNav : FALLBACK_NAV;

  const goSearch = () => {
    if (keyword.trim()) window.location.href = `/search?keyword=${encodeURIComponent(keyword.trim())}`;
  };

  return (
    <header className={`pc-header pc-header--style-${styleType} ${header.isWhite === 0 ? 'pc-header--dark' : ''}`}>
      <PcHeaderTopBar config={header as Record<string, any>} showLocale={styleType !== 2} />

      <div className="pc-container pc-header__main">
        <div className="pc-header__left">
          <Link href="/" className={`pc-header__brand pc-header__brand--align-${logoAlign}`}>
            {logo || siteLogo ? <img src={logo || siteLogo} alt="万物新生" style={{ width: logoWidth, maxWidth: '100%', maxHeight: Number(header.logoHeight) || 49, objectFit: 'contain' }} /> : !logoReady ? <span className="pc-header__brand-placeholder" style={{ width: logoWidth }} /> : null}
          </Link>
          {showCategory ? <Link href="/search" className="pc-header__category">全部商品分类</Link> : null}
        </div>

        <div className="pc-header__center">
          <div className="pc-header__search">
            <span className="pc-header__search-icon"><Search size={18} /></span>
            <input
              className="pc-header__search-input"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') goSearch();
              }}
              placeholder="搜索商品 / 分类 / 品牌"
            />
            <button type="button" className="pc-header__search-button" onClick={goSearch}>
              搜索
            </button>
          </div>

          {showNav ? (
            <nav className="pc-header__nav">
              <div className="pc-header__nav-inner">
                {navItems.map((item, index) => (
                  <Link key={index} href={item.link || '/'}>
                    {item.title || item.name || item.label}
                  </Link>
                ))}
              </div>
            </nav>
          ) : null}
        </div>

        <div className="pc-header__right">
          {styleType === 2 ? <PcLocaleSelect className="pc-header__locale" /> : null}
          <button
            type="button"
            className="pc-header__menu-btn"
            aria-label="打开菜单"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <HamburgerButton size={20} />
          </button>

          <div className="pc-header__actions">
            {styleType === 2 ? <PcMine /> : null}
            {showRightCart ? <PcCartEntry cartStyle={cartStyle} cartPic={cartPic} /> : null}
          </div>
        </div>
      </div>

      {menuOpen ? (
        <div className="pc-mobile-nav">
          <button type="button" className="pc-mobile-nav__overlay" aria-label="关闭菜单" onClick={() => setMenuOpen(false)} />
          <div className="pc-mobile-nav__panel">
            <div className="pc-mobile-nav__head">
              <b>菜单</b>
              <button type="button" aria-label="关闭菜单" onClick={() => setMenuOpen(false)}><Close size={20} /></button>
            </div>
            {navItems.map((item, index) => (
              <Link key={index} href={item.link || '/'} onClick={() => setMenuOpen(false)}>
                {item.title || item.name || item.label}
              </Link>
            ))}
            <Link href="/member" onClick={() => setMenuOpen(false)}>我的账户</Link>
            <Link href="/cart" onClick={() => setMenuOpen(false)}>购物车</Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

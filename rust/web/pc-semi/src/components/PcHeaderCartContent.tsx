'use client';

/**
 * 购物车页头部主体（源码：PcHeaderCartContent.vue）
 *
 * 仅 logo + 「购物车」标题 + 搜索框（无分类/导航），span 底部用 bottomDividerType 控制。
 * - bottomDividerType：0=不展示 / 1=阴影 / 其它=边框（购物车页默认边框）
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import PcSearchBox from '@/components/PcSearchBox';
import PcShopSearchInput from '@/components/PcShopSearchInput';
import type { PcHeaderConfig } from '@/decorate/types';
import { imageUrl } from '@/decorate/components/common';

export default function PcHeaderCartContent({
  config,
  isWhite = true,
  page = '',
  shopSearch = false,
}: {
  config?: PcHeaderConfig | Record<string, any> | null;
  isWhite?: boolean;
  page?: string;
  shopSearch?: boolean;
}) {
  const { t } = useTranslation();
  const header = (config || {}) as Record<string, any>;
  const [siteLogo, setSiteLogo] = useState('');
  const [cartCount, setCartCount] = useState(0);

  const logoSrc = imageUrl(header.logoPic) || siteLogo;
  const logoWidth = Number(header.logoWidth) || 110;
  const logoHeight = Number(header.logoHeight) || 40;
  const logoAlign = Number(header.logoAlign) || 1;
  const logoAlignClass = logoAlign === 2 ? 'logo--center' : logoAlign === 3 ? 'logo--right' : 'logo--left';

  useEffect(() => {
    if (imageUrl(header.logoPic)) return;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshCartCount = useCallback(() => {
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

  useEffect(() => {
    void refreshCartCount();
    // 旧版购物车每次变更后调 asyncGetCartCount 同步头部角标（index.vue:591 _getCartCount）
    window.addEventListener('pc-cart-change', refreshCartCount);
    return () => window.removeEventListener('pc-cart-change', refreshCartCount);
  }, [refreshCartCount]);

  const rawDivider = header.bottomDividerType;
  const dividerClass = rawDivider === 0 ? 'pc-header-divider--none' : rawDivider === 1 ? 'pc-header-divider--shadow' : 'pc-header-divider--border';

  return (
    <div className={`pc-header-cart-content ${dividerClass}`}>
      <div className="container">
        <div className="pc-header-cart__wrapper">
          <div className="pc-header-cart__left">
            <div className={`pc-header__logo ${logoAlignClass}`}>
              <Link href="/" className="alv1 pc-header__logo-link" aria-label={t('万物新生')}>
                {logoSrc ? (
                  <img src={logoSrc} style={{ width: logoWidth, height: logoHeight, objectFit: 'contain' }} alt={t('万物新生')} />
                ) : null}
              </Link>
            </div>
            <div className="cart-title">
              <span className="text">{t('购物车')}</span>
              {cartCount > 0 ? <span className="count">({cartCount})</span> : null}
            </div>
          </div>

          <div className="pc-header-cart__right">
            <div className="pc-header__search" style={{ ['--search-btn-text' as string]: `'${t('搜索')}'` } as React.CSSProperties}>
              {shopSearch ? <PcShopSearchInput page={page} /> : <PcSearchBox isWhite={isWhite} enableGuess={false} />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

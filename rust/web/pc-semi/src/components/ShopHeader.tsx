'use client';

/**
 * 店铺头部
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/shop/src/ShopRefHeader.vue
 * 结构：顶部行（站点 logo + 搜索框 + 搜全站/搜本店）
 *       信息行（店铺 logo / 名称 / 资质 / 粉丝 / 评分 / 客服 / 关注）
 */
import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@douyinfe/semi-ui';

import { useTranslation } from 'react-i18next';
export interface ShopHeaderInfo {
  shopId?: number;
  shopTitle?: string;
  shopLogo?: string;
  collectCount?: number;
  collectShop?: boolean;
  tipNames?: string[];
  businessLicensePic?: string;
  [key: string]: unknown;
}

export default function ShopHeader({
  shopInfo,
  siteLogo,
  onCollect,
  onSearch,
}: {
  shopInfo: ShopHeaderInfo;
  siteLogo?: string;
  onCollect?: () => void;
  onSearch?: (keyword: string, scope: 'site' | 'shop') => void;
}) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const hasLicense = Boolean(shopInfo?.businessLicensePic);

  const submit = (scope: 'site' | 'shop') => {
    if (onSearch) {
      onSearch(keyword.trim(), scope);
      return;
    }
    const target = scope === 'shop'
      ? `/shop/search/${shopInfo?.shopId || ''}?keyword=${encodeURIComponent(keyword.trim())}`
      : `/search?keyword=${encodeURIComponent(keyword.trim())}`;
    window.location.href = target;
  };

  return (
    <header className="shop-ref-header">
      <div className="shop-ref-header__container">
        <div className="shop-ref-header__top">
          <Link href="/" className="shop-ref-header__site-logo">
            {siteLogo ? <img src={siteLogo} alt="logo" /> : <span>{t('万物新生')}</span>}
          </Link>
          <div className="shop-ref-header__search">
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit('site');
              }}
              placeholder={t('搜索商品')}
            />
            <button type="button" className="shop-ref-header__btn" onClick={() => submit('site')}>{t('搜全站')}</button>
            {shopInfo?.shopId ? (
              <button type="button" className="shop-ref-header__btn is-shop" onClick={() => submit('shop')}>{t('搜本店')}</button>
            ) : null}
          </div>
        </div>

        <div className="shop-ref-header__info">
          <div className="shop-ref-header__card">
            <div className="shop-ref-header__logo">
              {shopInfo?.shopLogo ? <img src={String(shopInfo.shopLogo)} alt={shopInfo.shopTitle || ''} /> : <span>{t('店')}</span>}
            </div>
            <div className="shop-ref-header__meta">
              <div className="shop-ref-header__title-row">
                <span className="shop-ref-header__title">{shopInfo?.shopTitle || '店铺名称'}</span>
                {hasLicense ? (
                  <Link href={`/shop/license?id=${shopInfo?.shopId || ''}`} className="shop-ref-header__license">{t('查看资质')}</Link>
                ) : null}
              </div>
              <div className="shop-ref-header__sub">
                <span className="shop-ref-header__fans">{Number(shopInfo?.collectCount || 0)} 粉丝</span>
                {(shopInfo?.tipNames || []).map((tip, index) => (
                  <span className="shop-ref-header__tip" key={`${tip}-${index}`}>{tip}</span>
                ))}
              </div>
            </div>
            <div className="shop-ref-header__actions">
              <Button onClick={() => { window.location.href = `/chat?shopId=${shopInfo?.shopId || 0}`; }}>{t('客服')}</Button>
              <Button
                theme={shopInfo?.collectShop ? 'light' : 'solid'}
                type="primary"
                className={shopInfo?.collectShop ? 'is-followed' : ''}
                onClick={onCollect}
              >
                {shopInfo?.collectShop ? '已关注' : '+ 关注'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

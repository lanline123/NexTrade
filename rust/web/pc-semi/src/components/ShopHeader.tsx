'use client';

/**
 * 店铺头部（店铺默认首页 / 店内搜索页共用）。
 * 源码对照：view/pc/pages/shop/src/ShopRefHeader.vue（<template> 类名逐条照抄）
 * 样式：app/shop-page.scss → .pg-shop-ref-header
 *
 * .shop-ref-header > .container
 *   > .top-row  > a.site-logo > img  +  .search-wrap > input + button.btn.btn-site(.btn-site--only) + button.btn.btn-shop
 *   > .info-row > .info-card
 *       > .shop-main > .shop-logo(img) + .shop-meta
 *                       > .shop-title-row > span.shop-title + span.meta-link
 *                       > .shop-sub > .el-rate + span.fans
 *                       > .shop-score > span.score-item × N
 *       > .shop-actions > button.action-btn（客服）+ button.follow-btn(.followed)（关注）
 *
 * Element Plus 的 el-rate / el-button 在仓库里没有默认样式，这里用旧版 :deep() 已经
 * 写到的 .el-rate / .el-rate__item 类名做静态替身（同 fnd_23 的做法）。
 */
import { useState } from 'react';
import Link from 'next/link';

import { useTranslation } from 'react-i18next';
export interface ShopHeaderInfo {
  shopId?: number;
  shopTitle?: string;
  shopLogo?: string;
  collectCount?: number;
  collectShop?: boolean;
  shopStar?: number;
  tipNames?: string[];
  businessLicensePic?: string;
  [key: string]: unknown;
}

export default function ShopHeader({
  shopInfo,
  siteLogo,
  onCollect,
  onSearch,
  showShopSearch = true,
  isShopSearchPage = false,
}: {
  shopInfo: ShopHeaderInfo;
  siteLogo?: string;
  onCollect?: () => void;
  onSearch?: (keyword: string, scope: 'site' | 'shop') => void;
  /** 旧版 commonStore.searchSelfStore === 1 时才出「搜本店」 */
  showShopSearch?: boolean;
  /** 店内搜索页里多一个「店铺首页」按钮 */
  isShopSearchPage?: boolean;
}) {
  const { t } = useTranslation();
  const [keyword, setKeyword] = useState('');
  const hasLicense = Boolean(shopInfo?.businessLicensePic);
  const rating = Number(shopInfo?.shopStar || 0);

  const submit = (scope: 'site' | 'shop') => {
    if (onSearch) {
      onSearch(keyword.trim(), scope);
      return;
    }
    const target =
      scope === 'shop'
        ? `/shop/search/${shopInfo?.shopId || ''}?keyword=${encodeURIComponent(keyword.trim())}`
        : `/search?keyword=${encodeURIComponent(keyword.trim())}`;
    window.location.href = target;
  };

  return (
    <div className="shop-ref-header">
      <div className="container">
        <div className="top-row">
          <Link href="/" className="site-logo">
            {siteLogo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={siteLogo} alt="logo" />
            ) : (
              <span>{t('万物新生')}</span>
            )}
          </Link>
          <div className="search-wrap">
            <input
              type="text"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submit('site');
              }}
              placeholder={t('搜索宝贝')}
            />
            <button
              type="button"
              className={`btn btn-site${showShopSearch ? '' : ' btn-site--only'}`}
              onClick={() => submit('site')}
            >
              {t('搜索')}
            </button>
            {showShopSearch ? (
              <button type="button" className="btn btn-shop" onClick={() => submit('shop')}>
                {t('搜本店')}
              </button>
            ) : null}
          </div>
        </div>

        <div className="info-row">
          <div className="info-card">
            <div className="shop-main">
              <div className="shop-logo">
                {shopInfo?.shopLogo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={String(shopInfo.shopLogo)} alt={shopInfo.shopTitle || ''} />
                ) : (
                  <span className="image-slot">{t('店')}</span>
                )}
              </div>
              <div className="shop-meta">
                <div className="shop-title-row">
                  <span className="shop-title">{shopInfo?.shopTitle || t('店铺名称')}</span>
                  {hasLicense ? (
                    <Link href={`/shop/license?shopId=${shopInfo?.shopId || ''}`} className="meta-link">
                      {t('查看资质')}
                    </Link>
                  ) : null}
                </div>
                <div className="shop-sub">
                  <div className="el-rate">
                    {[1, 2, 3, 4, 5].map((index) => (
                      <div className="el-rate__item" key={index}>
                        <i
                          className="el-rate__icon"
                          style={{
                            fontStyle: 'normal',
                            fontSize: 12,
                            lineHeight: '12px',
                            color: index <= Math.round(rating) ? '#ff4d4f' : '#d9d9d9',
                          }}
                        >
                          ★
                        </i>
                      </div>
                    ))}
                  </div>
                  <span className="fans">
                    {Number(shopInfo?.collectCount || 0)}
                    {t('粉丝')}
                  </span>
                </div>
                <div className="shop-score">
                  {(shopInfo?.tipNames || []).map((tip, index) => (
                    <span className="score-item" key={`${tip}-${index}`}>
                      {tip}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="shop-actions">
              {isShopSearchPage ? (
                <Link href={`/shop/${shopInfo?.shopId || ''}`} className="action-btn">
                  {t('店铺首页')}
                </Link>
              ) : null}
              <button
                type="button"
                className="action-btn"
                onClick={() => {
                  window.location.href = `/chat?shopId=${shopInfo?.shopId || 0}`;
                }}
              >
                {t('客服')}
              </button>
              <button
                type="button"
                className={`follow-btn${shopInfo?.collectShop ? ' followed' : ''}`}
                onClick={onCollect}
              >
                {shopInfo?.collectShop ? t('已关注') : t('关注')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

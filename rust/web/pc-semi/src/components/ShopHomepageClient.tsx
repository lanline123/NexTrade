'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { ShopDetail, ShopDecorateData } from '@/lib/api';

function picUrl(pic: any): string { return pic?.picUrl || pic?.picThumb || ''; }
function linkHref(link: any): string { return link?.link || '#'; }
function moduleFrame(module: any): React.CSSProperties {
  const frame = module?.frame || {};
  return {
    padding: `${Number(frame.boxPaddingTop ?? 5)}px ${Number(frame.boxPadding ?? 10)}px ${Number(frame.boxPaddingBottom ?? 5)}px`,
    background: frame.backgroundColor || 'transparent',
    borderRadius: Number(frame.boxRadius) || 0,
  };
}

function ShopProductBlock({ shopId, module }: { shopId: number; module: any }) {
  const [products, setProducts] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    const count = Number(module?.productNumber || module?.products?.productNumber || 8);
    fetch(`/api/product/product/list?shopId=${shopId}&page=1&size=${count}`)
      .then((response) => response.json())
      .then((json) => {
        const records = json?.data?.records || json?.data || json?.records || [];
        if (!cancelled) setProducts(Array.isArray(records) ? records : []);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [shopId, module]);
  if (!products.length) return null;
  return (
    <div className="shop-decoration__products" style={moduleFrame(module)}>
      <div className="shop-decoration__product-grid">
        {products.map((product) => (
          <Link key={product.productId} href={`/product/${product.productId}`} className="shop-decoration__product" target="_blank">
            <div className="shop-decoration__product-img"><img src={product.picThumb || product.picUrl || ''} alt={product.productName || ''} loading="lazy" /></div>
            <div className="shop-decoration__product-name">{product.productName}</div>
            <div className="shop-decoration__product-price">¥ {Number(product.productPrice || 0).toFixed(2)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ShopInfoBlock({ shop, module }: { shop: ShopDetail | null; module: any }) {
  if (!shop) return null;
  return (
    <div className="shop-decoration__info" style={moduleFrame(module)}>
      <img className="shop-decoration__logo" src={shop.shopLogo || ''} alt={shop.shopTitle || ''} />
      <div className="shop-decoration__meta">
        <h1>{shop.shopTitle || '店铺详情'}</h1>
        <div className="shop-decoration__rating">
          <span>{shop.shopStar ? `${Number(shop.shopStar).toFixed(1)} 分` : '暂无评分'}</span>
          <span>{Number(shop.collectCount || 0)} 粉丝</span>
        </div>
        {shop.description ? <p>{shop.description}</p> : null}
      </div>
    </div>
  );
}

function ShopNoticeBlock({ module }: { module: any }) {
  const items = module?.noticeList || module?.items || [];
  if (!items.length) return null;
  return (
    <div className="shop-decoration__notice" style={moduleFrame(module)}>
      <span className="shop-decoration__notice-tag">{module.noticeTitle || '公告'}</span>
      <div className="shop-decoration__notice-list">
        {items.slice(0, 5).map((item: any, index: number) => (
          <a key={index} href={linkHref(item.picLink || item.link)}>{item.picTitle || item.title || ''}</a>
        ))}
      </div>
    </div>
  );
}

function ShopGalleryBlock({ module, type }: { module: any; type: string }) {
  const pics = module?.picList || module?.items || [];
  if (!pics.length) return null;
  return (
    <div className={`shop-decoration__gallery shop-decoration__gallery--${type}`} style={moduleFrame(module)}>
      {pics.map((pic: any, index: number) => (
        <a key={index} href={linkHref(pic.picLink)} target="_blank" rel="noreferrer">
          <img src={picUrl(pic)} alt={pic.picTitle || ''} loading="lazy" />
        </a>
      ))}
    </div>
  );
}

export default function ShopHomepageClient({ shopId, shop, data }: { shopId: number; shop: ShopDetail | null; data: ShopDecorateData | null }) {
  const modules: NonNullable<ShopDecorateData['moduleList']> = (data?.moduleList || []).filter((item) => item.isShow !== false);
  if (!modules.length) return null;
  return (
    <div className="shop-decoration">
      {modules.map((item: NonNullable<ShopDecorateData['moduleList']>[number], index: number) => {
        const module = item.module || {};
        switch (item.type) {
          case 'shopInfo': return <ShopInfoBlock key={index} shop={shop} module={module} />;
          case 'notice': return <ShopNoticeBlock key={index} module={module} />;
          case 'imageSquareAd':
          case 'imageNav': return <ShopGalleryBlock key={index} module={module} type="grid" />;
          case 'imageAd': return <ShopGalleryBlock key={index} module={module} type="ad" />;
          case 'imageHotarea': return <ShopGalleryBlock key={index} module={module} type="hotarea" />;
          case 'whiteBlank': return <div key={index} style={{ height: `${Number(module.blankHeight) || 20}px` }} />;
          case 'whiteLine': return <div key={index} className="shop-decoration__line" style={moduleFrame(module)} />;
          case 'titleAd': return <div key={index} className="shop-decoration__title" style={moduleFrame(module)}>{module.title?.titleText || module.titleText || ''}</div>;
          case 'product': return <ShopProductBlock key={index} shopId={shopId} module={module} />;
          default: return null;
        }
      })}
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ShopCategoryMenu from '@/components/ShopCategoryMenu';
import { PC_MODULE_REGISTRY, CONTRACT_COMPONENTS } from '@/decorate/components/modules';
import { CONTRACT_ADAPTERS } from '@/decorate/components/contract';
import type { ShopDetail, ShopDecorateData } from '@/lib/api';

import { useTranslation } from 'react-i18next';
import { formatPrice } from '@/lib/currency';
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
    const { t } = useTranslation();
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
            <div className="shop-decoration__product-price">{formatPrice(product.productPrice)}</div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function ShopInfoBlock({ shop, module }: { shop: ShopDetail | null; module: any }) {
    const { t } = useTranslation();
  if (!shop) return null;
  return (
    <div className="shop-decoration__info" style={moduleFrame(module)}>
      <img className="shop-decoration__logo" src={shop.shopLogo || ''} alt={shop.shopTitle || ''} />
      <div className="shop-decoration__meta">
        <h1>{shop.shopTitle || t('店铺详情')}</h1>
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
    const { t } = useTranslation();
  const items = module?.noticeList || module?.items || [];
  if (!items.length) return null;
  return (
    <div className="shop-decoration__notice" style={moduleFrame(module)}>
      <span className="shop-decoration__notice-tag">{module.noticeTitle || t('公告')}</span>
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

/**
 * 源码 pages/shop/src/ShopRefHeader.vue：店铺资质 / 粉丝 / 评分 / 客服 / 关注区。
 * ShopHomepage 原版通过 CommonPageHeader 带出，这里在装修模块列表前独立补齐。
 */
function ShopRefHeaderBlock({ shop, shopId }: { shop: ShopDetail | null; shopId: number }) {
    const { t } = useTranslation();
  const hasLicense = Boolean((shop as any)?.businessLicensePic);
  const tips: string[] = Array.isArray((shop as any)?.tipNames) ? (shop as any).tipNames : [];
  return (
    <div className="shop-decoration__ref-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: '#fff', padding: 16, borderRadius: 12, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
        <div style={{ width: 88, height: 88, border: '1px solid #eee', borderRadius: 6, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb' }}>
          {shop?.shopLogo ? <img src={shop.shopLogo} alt={shop.shopTitle || ''} style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span>{t('店')}</span>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 style={{ fontSize: 22, margin: 0, color: '#11192d', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shop?.shopTitle || t('店铺名称')}</h1>
            {hasLicense ? <Link href={`/shop/license?id=${shopId}`} style={{ fontSize: 12, color: '#999', textDecoration: 'none', whiteSpace: 'nowrap' }}>{t('查看资质')}</Link> : null}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 13, color: '#888' }}>
            <span>评分：{shop?.shopStar ? `${Number(shop.shopStar).toFixed(1)} 分` : '暂无评分'}</span>
            <span>{Number(shop?.collectCount || 0)} 粉丝</span>
          </div>
          {tips.length ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              {tips.map((tip, index) => (
                <span key={`${tip}-${index}`} style={{ fontSize: 12, color: '#50607a', background: '#f3f6f8', borderRadius: 4, padding: '4px 8px' }}>{tip}</span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <Link href={`/chat?shopId=${shopId}`} style={{ fontSize: 14, color: '#333', border: '1px solid #e2e4e6', borderRadius: 8, padding: '8px 14px', textDecoration: 'none' }}>{t('客服')}</Link>
        <Link href="/member/collectshop" style={{ fontSize: 14, color: '#fff', background: 'var(--pc-primary, #e01222)', borderRadius: 8, padding: '8px 14px', textDecoration: 'none' }}>
          {(shop as any)?.collectShop ? t('已关注') : '+ 关注'}
        </Link>
      </div>
    </div>
  );
}

/** 未识别装修模块的兜底卡片：保留模块标题 + 图片/商品占位，不再留空或显示「待补齐」 */
function ShopFallbackBlock({ shopId, module, label }: { shopId: number; module: any; label?: string }) {
    const { t } = useTranslation();
  const title = label || module?.title?.titleText || module?.titleText || module?.title || t('店铺精选');
  const pics = module?.picList || module?.items || [];
  return (
    <div className="shop-decoration__fallback" style={{ ...moduleFrame(module), background: '#fff', border: '1px solid #eee', borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>{String(title)}</span>
        <Link href={`/shop/${shopId}`} style={{ fontSize: 13, color: 'var(--pc-primary, #e01222)', textDecoration: 'none' }}>{t('查看全部商品 ›')}</Link>
      </div>
      {pics.length ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {pics.slice(0, 4).map((pic: any, index: number) => (
            <img key={index} src={picUrl(pic)} alt={pic.picTitle || ''} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 6 }} loading="lazy" />
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 13, color: '#999' }}>{t('更多精选商品，敬请查看')}</div>
      )}
    </div>
  );
}

export default function ShopHomepageClient({ shopId, shop, data }: { shopId: number; shop: ShopDetail | null; data: ShopDecorateData | null }) {
    const { t } = useTranslation();
  const modules: NonNullable<ShopDecorateData['moduleList']> = (data?.moduleList || []).filter((item) => item.isShow !== false);

  /** 源码 ShopCategoryMenu.vue：左侧店铺分类树（客户端拉取，接口不可用时降级为空列表） */
  const [categories, setCategories] = useState<any[]>([]);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/shop/category/tree?shopId=${shopId}`)
      .then((response) => response.json())
      .then((json) => {
        const rows = json?.data?.records || json?.data || json?.records || [];
        if (!cancelled) setCategories(Array.isArray(rows) ? rows : []);
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [shopId]);

  /**
   * 店铺装修模块渲染。
   *
   * 旧版 pages/shop/src/ShopHomepage.vue 按 item.type 渲染 components/shop/** 的 11 个组件，
   * 并区分 item.module.isFluxWidth（0=容器内 / 1=通栏）与 item.isShow（显隐）。
   * 新版此前自建 switch，modules.tsx 里已写好的 ImageAd / ImageHotarea / ImageNav /
   * ImageSquareAd / TitleAd / Notice / Coupon / Product / Divider / Spacer 全闲置 → 店铺装修整体降级。
   *
   * 现改为复用统一渲染器 PC_MODULE_REGISTRY + CONTRACT_ADAPTERS：
   * - camelCase type（shopInfo/notice/coupon/imageAd/...）经 contract.ts 适配到现有组件；
   * - isShow=false 的模块跳过；
   * - isFluxWidth=1 的模块通栏渲染，其余在容器内。
   */
  const renderModule = (item: NonNullable<ShopDecorateData['moduleList']>[number], index: number) => {
    const module = item.module || {};
    // shopInfo 由 ShopRefHeaderBlock 独立承担（消费整个 shopInfo 对象），避免重复渲染
    if (item.type === 'shopInfo') return null;
    if (item.isShow === false) return null;

    const registryKey = item.type;
    let Component: ((props: { module: Record<string, any> }) => JSX.Element | null) | undefined =
      PC_MODULE_REGISTRY[registryKey];
    let moduleProps: Record<string, any> = { ...module, label: item.label, frame: module?.frame };

    if (!Component) {
      const adapter = CONTRACT_ADAPTERS[item.type];
      if (adapter) {
        const plan = adapter(item as any);
        const contractComponent = CONTRACT_COMPONENTS[plan.component];
        if (contractComponent) {
          Component = contractComponent as any;
          moduleProps = plan.module;
        }
      }
    }

    if (!Component) {
      return <ShopFallbackBlock key={index} shopId={shopId} module={module} />;
    }

    // 通栏（isFluxWidth=1）→ 突破容器宽度；其余在容器内
    const isFluxWidth = Number((module as any).isFluxWidth) === 1;
    const body = <Component module={moduleProps} />;

    if (isFluxWidth) {
      return (
        <div key={index} className="shop-decoration__flux">
          {body}
        </div>
      );
    }
    return (
      <div key={index} className="shop-decoration__module">
        {body}
      </div>
    );
  };

  return (
    <div className="shop-decoration" style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
      <aside className="shop-decoration__side" style={{ width: 220, flexShrink: 0, background: '#fff', padding: 12, borderRadius: 8 }}>
        <ShopCategoryMenu shopId={shopId} categories={categories as any} />
      </aside>
      <div className="shop-decoration__modules" style={{ flex: 1, minWidth: 0 }}>
        {/* 源码 ShopRefHeader.vue：店铺资质 / 粉丝 / 评分 / 客服 / 关注区 */}
        <ShopRefHeaderBlock shop={shop} shopId={shopId} />
        {modules.map(renderModule)}
      </div>
    </div>
  );
}

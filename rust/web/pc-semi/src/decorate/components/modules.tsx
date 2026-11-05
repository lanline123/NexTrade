'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { DecorateModule, PageModule } from '../types';
import { Frame, imageUrl, linkUrl, ModuleHeading, ModuleTitle, SafeImage } from './common';
import { CONTRACT_ADAPTERS, FLAT_FRAME, linkHref, type ContractRenderPlan } from './contract';

type ModuleProps<T = Record<string, any>> = { module: T };

function ImageAd({ module }: ModuleProps) {
  const pics = module.picList || [];
  if (!pics.length) return null;
  return (
    <Frame frame={module.frame}>
      <ModuleTitle title={module.title} />
      <div className={`dec-image-ad dec-image-ad--${module.picType === 2 ? 'carousel' : 'grid'}`}>
        {pics.map((pic: any, index: number) => (
          <a key={index} href={linkUrl(pic.picLink)} className="dec-image-ad__item">
            <SafeImage src={imageUrl(pic)} alt={pic.picTitle || ''} />
          </a>
        ))}
      </div>
    </Frame>
  );
}

function ImageNav({ module }: ModuleProps) {
  const items = module.items || module.picList || [];
  if (!items.length) return null;
  return (
    <Frame frame={module.frame}>
      <div className="dec-image-nav">
        {items.map((item: any, index: number) => (
          <a key={index} href={linkUrl(item.picLink)} className="dec-image-nav__item">
            <SafeImage src={imageUrl(item)} alt={item.picTitle || ''} />
            {item.picTitle ? <span>{item.picTitle}</span> : null}
          </a>
        ))}
      </div>
    </Frame>
  );
}

function ImageSquareAd({ module }: ModuleProps) {
  const pics = module.picList || module.items || [];
  if (!pics.length) return null;
  return (
    <Frame frame={module.frame}>
      <div className="dec-square-ad">
        {pics.map((pic: any, index: number) => (
          <a key={index} href={linkUrl(pic.picLink)} className="dec-square-ad__item">
            <SafeImage src={imageUrl(pic)} alt={pic.picTitle || ''} />
            {pic.picTitle ? <span>{pic.picTitle}</span> : null}
          </a>
        ))}
      </div>
    </Frame>
  );
}

function ImageHotarea({ module }: ModuleProps) {
  const pic = module.pic || module.backgroundPic || {};
  return (
    <Frame frame={module.frame}>
      <div className="dec-hotarea">
        <SafeImage src={imageUrl(pic)} alt="" />
        {(module.hotareas || []).map((area: any, index: number) => (
          <a
            key={index}
            href={linkUrl(area.link || area.picLink)}
            className="dec-hotarea__area"
            style={{
              left: `${area.left ?? 0}%`,
              top: `${area.top ?? 0}%`,
              width: `${area.width ?? 10}%`,
              height: `${area.height ?? 10}%`,
            }}
          />
        ))}
      </div>
    </Frame>
  );
}

function TitleAd({ module }: ModuleProps) {
  const title = module.title || {};
  const frame = module.frame || {};
  const titleRadius = Number(title.titleRadius) || 0;
  const leftRight = Number(frame.leftAndRightPadding) || 0;
  const align = Number(title.titleAlign) || 1;
  const styleType = Number(title.titleStyle) || 1;
  const background = title.titleBackground2 && title.titleBackground
    ? `linear-gradient(to right, ${title.titleBackground}, ${title.titleBackground2})`
    : title.titleBackground || '';
  const titleBarStyle: Record<string, string> = {
    borderRadius: `${titleRadius}px`,
    padding: `10px ${leftRight}px`,
  };
  if (background) titleBarStyle.background = background;
  return (
    <Frame frame={frame}>
      {!title.titleText || String(title.titleText).trim() === '' ? (
        <div className="module-ad-empty empty-title_ad">
          <div className="image-empty-bg" />
          <div className="desc">点击添加标题</div>
        </div>
      ) : (
        <div className={`title-ad-warp ad-title_align__${align}`} style={{ paddingLeft: `${leftRight}px`, paddingRight: `${leftRight}px` }}>
          <div className="title-ad-con">
            <div className="title-ad-item">
              <div className="item-content">
                <div className={`image-ad-title ad-title_style__${styleType}`} style={titleBarStyle}>
                  <div className="image-ad-title-l">
                    <div className="image-ad-title-h" style={{ color: title.titleColor || undefined }}>{title.titleText}</div>
                    {title.descText ? (
                      <div className="image-ad-title-d" style={{ color: title.descColor || undefined }}>{title.descText}</div>
                    ) : null}
                  </div>
                  {Number(title.showMore) === 1 ? (
                    <div className="image-ad-title-r">
                      <a className="more-link" href={linkUrl(title.moreLink)} style={{ color: title.moreColor || undefined }}>
                        <div className="flex align-center">
                          <span>{title.moreLink?.title || '查看更多'}</span>
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
    </Frame>
  );
}

function Notice({ module }: ModuleProps) {
  const frame = module.frame ?? {};
  const containerModule = {
    boxPadding: frame.boxPadding ?? module.boxPadding ?? 10,
    boxPaddingTop: frame.boxPaddingTop ?? module.boxPaddingTop ?? 5,
    boxPaddingBottom: frame.boxPaddingBottom ?? module.boxPaddingBottom ?? 5,
    boxRadius: frame.boxRadius ?? module.boxRadius ?? 0,
    backgroundColor: frame.backgroundColor || module.backgroundColor || '#ffffff',
    innerPadding: frame.innerPadding ?? module.innerPadding ?? 0,
  };
  const itemStyle = {
    backgroundColor: frame.itemBackgroundColor ?? '#fff8e6',
    borderRadius: `${frame.itemRadius ?? 4}px`,
    height: `${frame.itemHeight ?? 35}px`,
    color: frame.textColor ?? '#555555',
  };
  const icon = imageUrl(module.icoPic);
  return (
    <Frame frame={containerModule}>
      <div className="notice-ad-warp module-ad-con module-notice">
        <div className="notice-con">
          <div className="notice-item">
            <div className="item-content">
              <div className="item-notice-con" style={itemStyle}>
                {icon ? (
                  <div className="item-notice-ico"><img className="item-img" src={icon} alt="" /></div>
                ) : null}
                <div className="item-notice-list">
                  <div className="item-notice-input" style={{ color: frame.textColor ?? '#555555' }}>
                    {module.text || ''}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Divider({ module }: ModuleProps) {
  const lineType = Number(module.lineType) || 2;
  const lineStyle = Number(module.lineStyle) || 1;
  const rawHeight = Number(module.frame?.itemHeight);
  const itemHeight = Number.isFinite(rawHeight) ? rawHeight : 10;
  const frameModule = module.frame ?? {
    innerPadding: 0,
    boxPaddingTop: 0,
    boxPaddingBottom: 0,
    boxPadding: 0,
    backgroundColor: '',
    boxRadius: 0,
  };
  return (
    <Frame frame={frameModule}>
      <div className="white-line-warp">
        <div className="white-line-con" style={{ height: `${itemHeight}px` }}>
          {lineType === 2 ? (
            <div className={`white-line-item line-style-${lineStyle}`}>
              <div className="item-line" />
            </div>
          ) : null}
        </div>
      </div>
    </Frame>
  );
}

function Spacer({ module }: ModuleProps) {
  const frame = module.frame ?? {};
  const height = module.blankHeight ?? 30;
  return (
    <div
      className="pc-spacer module-ad-con module-white_blank"
      style={{
        paddingLeft: `${frame.boxPadding ?? 0}px`,
        paddingRight: `${frame.boxPadding ?? 0}px`,
        paddingTop: `${frame.boxPaddingTop ?? 0}px`,
        paddingBottom: `${frame.boxPaddingBottom ?? 0}px`,
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
          borderRadius: `${frame.boxRadius ?? 0}px`,
          boxSizing: 'border-box',
        }}
      />
    </div>
  );
}

function QuickNav({ module }: ModuleProps) {
  const items = module.items || [];
  const style = module.style || {};
  return (
    <Frame frame={module.frame}>
      <nav
        className="dec-quick-nav"
        style={{
          justifyContent: style.containerAlign === 2 ? 'center' : style.containerAlign === 3 ? 'flex-end' : 'flex-start',
          gap: `${style.itemGap ?? 24}px`,
          color: style.textColor || '#344054',
          fontSize: `${style.fontSize ?? 14}px`,
        }}
      >
        {items.map((item: any, index: number) => (
          <a key={index} href={linkUrl(item.picLink)} className="dec-quick-nav__item">
            <SafeImage src={item.picThumb || item.picUrl} alt={item.picTitle || ''} />
            <span style={{ fontWeight: style.fontWeight || 500 }}>{item.picTitle || item.picLink?.name}</span>
          </a>
        ))}
      </nav>
    </Frame>
  );
}

function CategoryNav({ module }: ModuleProps) {
  const categories = module.categories || module.items || [];
  return (
    <Frame frame={module.frame}>
      <div className="dec-category-card">
        <div className="dec-category-nav">
          {(categories.length ? categories : Array.from({ length: 8 })).map((item: any, index: number) => (
            <a key={index} href={linkUrl(item?.picLink)} className="dec-category-nav__item">
              <span>{item?.picTitle || item?.title || '商品分类'}</span>
              <span className="dec-arrow">›</span>
            </a>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function HomeHero({ module }: ModuleProps) {
  const left = module.left || {};
  const center = module.center || {};
  const right = module.right || {};
  const style = module.style || {};
  const banners = center.banners || [];
  const categories = left.categories || [];
  const cards = center.modules || [];

  const formatHeroPrice = (value: any) => {
    if (value === undefined || value === null || value === '') return '-';
    const text = String(value);
    if (text.includes('¥')) return text;
    const amount = Number(value);
    return Number.isFinite(amount) ? `¥ ${amount.toLocaleString('zh-CN')}` : text;
  };

  const renderMiniProducts = (card: any) => (
    <div className="dec-hero__card-products">
      {(card.products || []).slice(0, 2).map((product: any, index: number) => (
        <div key={index} className="dec-hero__card-product">
          <div className="dec-hero__card-img-box">
            <SafeImage src={imageUrl(product.pic)} alt={product.productName || ''} />
            {product.label ? <span className="dec-hero__card-label">{product.label}</span> : null}
          </div>
          {card.showPrice !== 0 ? (
            <div className="dec-hero__card-price">{formatHeroPrice(product.price)}</div>
          ) : null}
        </div>
      ))}
    </div>
  );

  return (
    <Frame frame={module.frame} className="dec-hero-frame">
      <div
        className="dec-hero"
        style={{
          ['--dec-hero-height' as string]: `${style.height ?? 336}px`,
          ['--dec-hero-gap' as string]: `${style.gap ?? 16}px`,
          ['--dec-hero-left' as string]: `${style.leftWidth ?? 252}px`,
          ['--dec-hero-right' as string]: `${style.rightWidth ?? 252}px`,
          ['--dec-hero-panel' as string]: style.panelBackgroundColor || '#ffffff',
          ['--dec-hero-radius' as string]: `${style.panelRadius ?? 8}px`,
        }}
      >
        <aside className="dec-hero__left dec-hero__panel">
          <div className="dec-hero__cate-list" style={{ background: left.backgroundColor, color: left.textColor }}>
            {left.title ? <div className="dec-hero__cate-title-head">{left.title}</div> : null}
            {categories.slice(0, left.showCount || 12).map((item: any, index: number) => (
              <a key={index} href={linkUrl(item.picLink)} className="dec-hero__cate-item">
                <span>{item.picTitle || item.picName}</span>
                <span className="dec-arrow">›</span>
              </a>
            ))}
          </div>
        </aside>

        <section className="dec-hero__center">
          <div className="dec-hero__center-top">
            <div className="dec-hero__banner">
              {banners.length ? (
                <a href={linkUrl(banners[0].picLink)} className="dec-hero__banner-link">
                  <SafeImage src={imageUrl(banners[0])} alt={banners[0].picTitle || ''} />
                </a>
              ) : <div className="dec-hero__banner-empty" />}
            </div>
            <div className="dec-hero__promo-group">
              {cards.slice(0, 2).map((card: any, index: number) => (
                <a key={index} href={linkUrl(card.link)} className="dec-hero__panel dec-hero__promo-card">
                  <div className="dec-hero__card-header">
                    <span className="dec-hero__card-title">{card.moduleTitle || card.title || '促销'}</span>
                    {card.moduleSubTitle ? <span className="dec-hero__card-badge" style={card.moduleSubTitleBgColorA ? { background: `linear-gradient(90deg, ${card.moduleSubTitleBgColorA}, ${card.moduleSubTitleBgColorB || card.moduleSubTitleBgColorA})` } : undefined}>{card.moduleSubTitle}</span> : null}
                  </div>
                  {renderMiniProducts(card)}
                </a>
              ))}
            </div>
          </div>
          <div className="dec-hero__center-bottom">
            <div className="dec-hero__product-grid">
              {cards.slice(2, 6).map((card: any, index: number) => (
                <a key={index} href={linkUrl(card.link)} className="dec-hero__channel-card">
                  <div className="dec-hero__card-header">
                    <span className="dec-hero__card-title">{card.moduleTitle || card.title || '推荐'}</span>
                    {card.moduleSubTitle ? <span className="dec-hero__card-badge" style={card.moduleSubTitleBgColorA ? { background: `linear-gradient(90deg, ${card.moduleSubTitleBgColorA}, ${card.moduleSubTitleBgColorB || card.moduleSubTitleBgColorA})` } : undefined}>{card.moduleSubTitle}</span> : null}
                  </div>
                  {renderMiniProducts(card)}
                </a>
              ))}
            </div>
          </div>
        </section>

        <aside className="dec-hero__right">
          <div className="dec-hero__panel dec-hero__user-card">
            <div className="dec-hero__user-top">
              <div className="dec-hero__avatar">
                <SafeImage src={imageUrl(right.user?.avatar)} alt="" />
              </div>
              <div className="dec-hero__user-text">
                <div className="dec-hero__welcome">{right.user?.welcomeText || 'Hi，欢迎来到万物新生'}</div>
                <div className="dec-hero__user-sub">一键登录，福利好物全拥有</div>
              </div>
            </div>
            <div className="dec-hero__user-login-row">
              <a href="/login" className="dec-hero__login">立即登录</a>
              <a href="/register" className="dec-hero__register">注册</a>
            </div>
            <div className="dec-hero__stats">
              {(right.stats || []).slice(0, 3).map((stat: any, index: number) => (
                <div key={index} className="dec-hero__stat">
                  <b>{stat.value || '-'}</b>
                  <span>{stat.label || ''}</span>
                </div>
              ))}
            </div>
            <div className="dec-hero__user-actions">
              <a href="/member/order/list">我的订单</a>
              <a href="/member/favorite">心愿单</a>
              <a href="/member/coupon">优惠券</a>
            </div>
          </div>

          <div className="dec-hero__panel dec-hero__shops">
            <div className="dec-hero__shops-head">
              <div className="dec-hero__shops-title">
                <b>{right.shopsTitle || '特色产品'}</b>
                {right.shopsSubTitle ? <span className="dec-hero__shops-badge" style={{ background: right.shopsSubTitleBg || '#ff4e4e' }}>{right.shopsSubTitle}</span> : null}
              </div>
              <a href={linkUrl(right.shopsMoreLink)}>{right.shopsMoreText || '查看更多'} ›</a>
            </div>
            <div className="dec-hero__shortcuts">
              {(right.shortcuts || []).slice(0, 8).map((item: any, index: number) => (
                <a key={index} href={linkUrl(item.picLink)} className="dec-hero__shortcut">
                  <SafeImage src={imageUrl(item)} alt="" />
                  <span>{item.picTitle}</span>
                </a>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </Frame>
  );
}
interface ProductItem {
  productId?: number;
  productSn?: string;
  seoLink?: string;
  productName?: string;
  productPrice?: number | string;
  picThumb?: string;
  picUrl?: string;
  brief?: string;
  productStock?: number;
}

function Product({ module }: ModuleProps) {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);
  const config = module.products || {};
  const columns = Number(module.style) === 2 ? 5 : 4;

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ page: '1' });
    if (config.productSelectType === 1 && Array.isArray(config.productIds) && config.productIds.length) {
      params.set('ids', config.productIds.join(','));
      params.set('size', String(config.productIds.length));
    } else {
      params.set('size', String(config.productNumber || (columns === 5 ? 10 : 8)));
      if (config.productCategoryId) params.set('categoryId', String(config.productCategoryId));
      if (config.productTag) params.set('tag', String(config.productTag));
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
  }, [JSON.stringify(config), columns]);

  return (
    <Frame frame={module.frame}>
      <ModuleHeading title={module.title?.titleText} subTitle={module.title?.descText} />
      {loading ? (
        <div className="dec-product-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {Array.from({ length: columns }).map((_, index) => (
            <div key={index} className="dec-product-card">
              <span className="dec-skeleton-line" />
              <span className="dec-skeleton-line" />
            </div>
          ))}
        </div>
      ) : (
        <div className="dec-product-grid" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}>
          {products.map((product) => (
            <Link
              key={product.productSn || product.productId}
              href={`/product/${product.productId || ''}`}
              className="dec-product-card"
            >
              <div className="dec-product-card__image">
                <SafeImage src={product.picThumb || product.picUrl || ''} alt={product.productName || ''} />
              </div>
              <div className="dec-product-card__name">{product.productName || '商品'}</div>
              {module.showBrief ? <div className="dec-product-card__brief">{product.brief || ''}</div> : null}
              <div className="dec-product-card__price">
                <b>¥</b> {Number(product.productPrice || 0).toFixed(2)}
              </div>
            </Link>
          ))}
          {!products.length ? <div className="dec-empty">暂未获取到商品数据</div> : null}
        </div>
      )}
    </Frame>
  );
}

function Coupon({ module }: ModuleProps) {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    fetch('/api/home/home/getCoupon')
      .then((response) => response.json())
      .then((json) => {
        const list = json?.data || json?.records || [];
        setCoupons(Array.isArray(list) ? list.slice(0, 4) : []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const claim = async (coupon: any) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch('/api/user/coupon/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ couponId: coupon.couponId }),
      });
      const json = await response.json();
      if (!response.ok || (json.code !== undefined && json.code !== 0)) throw new Error(json.msg || '领取失败');
      load();
    } catch (error) {
      alert(error instanceof Error ? error.message : '领取失败');
    }
  };

  if (loading || !coupons.length) return null;

  return (
    <Frame frame={module.frame}>
      <div className="dec-coupon-head">
        <b>{module.title || '领券中心'}</b>
        {module.desc ? <span>{module.desc}</span> : null}
        <Link href="/coupon/list">查看更多 &gt;</Link>
      </div>
      <div className="dec-coupon-grid">
        {coupons.map((coupon) => (
          <div key={coupon.couponId} className="dec-coupon-card">
            <div className="dec-coupon-card__value">
              {coupon.couponType === 2 ? <b>{coupon.couponDiscount}<small>折</small></b> : <b><small>¥</small>{Number(coupon.couponMoney || 0).toFixed(0)}</b>}
              <span>满 {Number(coupon.minOrderAmount || 0).toFixed(0)} 可用</span>
            </div>
            <div className="dec-coupon-card__info">
              <b>{coupon.couponName || '优惠券'}</b>
              <span>{coupon.couponDesc || '全场通用'}</span>
            </div>
            <button type="button" onClick={() => void claim(coupon)}>
              {coupon.isReceive ? '已领取' : '立即领取'}
            </button>
          </div>
        ))}
      </div>
    </Frame>
  );
}

function Seckill({ module }: ModuleProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(0);

  useEffect(() => {
    fetch('/api/home/home/getSeckill?page=1&size=6')
      .then((response) => response.json())
      .then((json) => {
        const list = json?.data?.records || json?.records || [];
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  const endTime = (() => {
    const first = products[0];
    const raw = first?.seckkillData?.seckillEndTime || first?.seckillEndTime;
    const time = raw ? new Date(raw).getTime() : 0;
    return Number.isFinite(time) ? time : 0;
  })();

  useEffect(() => {
    if (!endTime) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [endTime]);

  if (loading || !products.length) return null;

  const remaining = endTime && now ? Math.max(0, endTime - now) : 0;
  const countdown = now && remaining > 0
    ? `${String(Math.floor(remaining / 3600000)).padStart(2, '0')}:${String(Math.floor((remaining % 3600000) / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`
    : '';

  return (
    <Frame frame={module.frame}>
      <div className="dec-promo-head">
        <div>
          <b>{module.title?.titleText || '限时秒杀'}</b>
          <span>{module.title?.descText || '每日限时低价'}</span>
        </div>
        <div className="dec-promo-head__right">
          {countdown ? <span className="dec-promo-countdown">距结束 {countdown}</span> : null}
          <Link href="/search?tag=seckill">更多秒杀 &gt;</Link>
        </div>
      </div>
      <div className="dec-promo-grid">
        {products.map((product) => (
          <Link key={product.productId} href={`/product/${product.productId}`} className="dec-promo-card">
            <div className="dec-promo-card__image"><SafeImage src={product.picThumb || product.picUrl || ''} alt={product.productName || ''} /></div>
            <div className="dec-promo-card__name">{product.productName}</div>
            <div className="dec-promo-card__price">
              <b>¥ {Number(product.seckillPrice || product.productPrice || 0).toFixed(2)}</b>
              <s>¥ {Number(product.productPrice || 0).toFixed(2)}</s>
            </div>
            <div className="dec-promo-card__meta">已抢 {product.seckillSales || 0} 件</div>
          </Link>
        ))}
      </div>
    </Frame>
  );
}

function Groupon({ module }: ModuleProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/promotion/groupon/itemList?page=1&size=6')
      .then((response) => response.json())
      .then((json) => {
        const list = json?.data?.records || json?.records || [];
        setProducts(Array.isArray(list) ? list : []);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  if (loading || !products.length) return null;

  return (
    <Frame frame={module.frame}>
      <div className="dec-promo-head">
        <div>
          <b>{module.title?.titleText || '拼团活动'}</b>
          <span>{module.title?.descText || '邀请好友一起拼'}</span>
        </div>
        <Link href="/search?tag=groupon">更多拼团 &gt;</Link>
      </div>
      <div className="dec-promo-grid">
        {products.map((product) => (
          <Link key={product.productId || product.id} href={`/product/${product.productId || product.id}`} className="dec-promo-card">
            <div className="dec-promo-card__image"><SafeImage src={product.picThumb || product.picUrl || ''} alt={product.productName || ''} /></div>
            <div className="dec-promo-card__name">{product.productName}</div>
            <div className="dec-promo-card__price">
              <b>¥ {Number(product.grouponPrice || product.productPrice || 0).toFixed(2)}</b>
              <s>¥ {Number(product.productPrice || 0).toFixed(2)}</s>
            </div>
            <div className="dec-promo-card__meta">{product.grouponNum || 2} 人成团</div>
          </Link>
        ))}
      </div>
    </Frame>
  );
}

function ProductGroup({ module }: ModuleProps) {
  const groups: Array<Record<string, any>> = Array.isArray(module.productGroups) ? module.productGroups : [];
  const [active, setActive] = useState(0);
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const group = groups[active];
    if (!group) {
      setProducts([]);
      setLoading(false);
      return;
    }
    const params = new URLSearchParams({ page: '1', size: '12' });
    if (group.sourceType === 'productGroup' && group.productGroupId) {
      params.set('productGroupId', String(group.productGroupId));
    } else {
      const ids = (Array.isArray(group.productList) ? group.productList : [])
        .map((item: any) => item.productId || item.id)
        .filter(Boolean);
      if (!ids.length) {
        setProducts([]);
        setLoading(false);
        return;
      }
      params.set('ids', ids.join(','));
      params.set('size', String(ids.length));
    }
    setLoading(true);
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
  }, [JSON.stringify(groups), active]);

  if (!groups.length) return null;
  const showTitle = Number(module.groupTitle?.showTitle ?? 1) !== 0;
  const showName = Number(module.showProductName ?? 1) !== 0;
  const showPrice = Number(module.showProductPrice ?? 1) !== 0;

  return (
    <Frame frame={module.frame}>
      {showTitle ? (
        <div className="dec-product-group__tabs">
          {groups.map((group, index) => (
            <button
              key={index}
              type="button"
              className={index === active ? 'is-active' : ''}
              onClick={() => setActive(index)}
            >
              {group.titlePic ? <SafeImage src={imageUrl(group.titlePic)} alt="" /> : null}
              <span>{group.title || `分组 ${index + 1}`}</span>
            </button>
          ))}
        </div>
      ) : null}
      {loading ? (
        <div className="dec-product-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="dec-product-card"><span className="dec-skeleton-line" /></div>
          ))}
        </div>
      ) : (
        <div className="dec-product-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {products.map((product) => (
            <Link key={product.productSn || product.productId} href={`/product/${product.productId || ''}`} className="dec-product-card">
              <div className="dec-product-card__image">
                <SafeImage src={product.picThumb || product.picUrl || ''} alt={product.productName || ''} />
              </div>
              {showName ? <div className="dec-product-card__name">{product.productName || '商品'}</div> : null}
              {showPrice ? <div className="dec-product-card__price"><b>¥</b> {Number(product.productPrice || 0).toFixed(2)}</div> : null}
            </Link>
          ))}
          {!products.length ? <div className="dec-empty">该分组暂无商品</div> : null}
        </div>
      )}
    </Frame>
  );
}

function RecommendProduct({ module }: ModuleProps) {
  return <Product module={{ ...module, products: { ...(module.products || {}), productSelectType: 3 } }} />;
}

function Banner2({ module }: ModuleProps) {
  const pics: any[] = Array.isArray(module.picList) ? module.picList : [];
  const perView = Math.min(3, Math.max(1, Number(module.number) || 1));
  const gap = Number.isFinite(Number(module.slideGap)) ? Math.max(0, Number(module.slideGap)) : 12;
  const frame = module.frame || {};
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const maxIndex = Math.max(0, pics.length - perView);
  const style = {
    '--dec-box-padding': `${Number(frame.boxPadding) || 0}px`,
    '--dec-box-padding-top': `${Number(frame.boxPaddingTop) || 0}px`,
    '--dec-box-padding-bottom': `${Number(frame.boxPaddingBottom) || 0}px`,
    '--dec-box-radius': `${Number(frame.boxRadius) || 0}px`,
    '--dec-bg-color': frame.backgroundColor || 'transparent',
    '--dec-inner-padding': `${Number(frame.leftAndRightPadding) || 0}px`,
    '--dec-slide-gap': `${gap}px`,
  } as React.CSSProperties;

  const goTo = (next: number) => {
    const target = Math.max(0, Math.min(maxIndex, next));
    setIndex(target);
    const track = trackRef.current;
    const child = track?.children[target] as HTMLElement | undefined;
    if (track && child) {
      track.scrollTo({ left: child.offsetLeft - track.offsetLeft, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (pics.length <= perView) return undefined;
    const timer = window.setInterval(() => {
      setIndex((current) => {
        const next = current >= maxIndex ? 0 : current + 1;
        const track = trackRef.current;
        const child = track?.children[next] as HTMLElement | undefined;
        if (track && child) track.scrollTo({ left: child.offsetLeft - track.offsetLeft, behavior: 'smooth' });
        return next;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [pics.length, perView, maxIndex]);

  if (!pics.length) return null;
  return (
    <div className="dec-banner2" style={style}>
      <div className="dec-banner2__inner">
        <div
          className="dec-banner2__track"
          ref={trackRef}
          style={{ gridAutoColumns: `calc((100% - ${(perView - 1) * gap}px) / ${perView})`, gap }}
          onScroll={(event) => {
            const el = event.currentTarget;
            const child = el.children[0] as HTMLElement | undefined;
            if (child && child.offsetWidth + gap > 0) {
              setIndex(Math.round(el.scrollLeft / (child.offsetWidth + gap)));
            }
          }}
        >
          {pics.map((pic: any, i: number) => (
            <a key={i} className="dec-banner2__item" href={linkUrl(pic.picLink)} target="_blank" rel="noreferrer">
              <SafeImage src={imageUrl(pic)} alt={pic.picTitle || pic.picName || ''} className="dec-banner2__image" />
            </a>
          ))}
        </div>
        {pics.length > perView ? (
          <>
            <button type="button" className="dec-banner2__arrow dec-banner2__arrow--prev" onClick={() => goTo(index - 1)} aria-label="上一张">‹</button>
            <button type="button" className="dec-banner2__arrow dec-banner2__arrow--next" onClick={() => goTo(index + 1)} aria-label="下一张">›</button>
            <div className="dec-banner2__dots">
              {Array.from({ length: maxIndex + 1 }).map((_, dot) => (
                <button key={dot} type="button" className={dot === index ? 'is-active' : ''} onClick={() => goTo(dot)} aria-label={`第 ${dot + 1} 张`} />
              ))}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function CategoryNav3({ module }: ModuleProps) {
  const pics: any[] = Array.isArray(module.picList) ? module.picList : [];
  const frame = module.frame || {};
  const listRef = useRef<HTMLDivElement | null>(null);
  const style = {
    '--dec-box-padding': `${Number(frame.boxPadding) || 0}px`,
    '--dec-box-padding-top': `${Number(frame.boxPaddingTop) || 0}px`,
    '--dec-box-padding-bottom': `${Number(frame.boxPaddingBottom) || 0}px`,
    '--dec-box-radius': `${Number(frame.boxRadius) || 0}px`,
    '--dec-bg-color': module.backgroundColor || frame.backgroundColor || 'rgba(0, 0, 0, 0.02)',
    '--dec-box-height': `${Number(frame.boxHeight) > 0 ? Number(frame.boxHeight) : 352}px`,
  } as React.CSSProperties;
  const scroll = (delta: number) => {
    listRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };
  return (
    <div className="dec-category-nav3" style={style}>
      <div className="dec-category-nav3__top">
        <div className="dec-category-nav3__title">{module.titleText || ''}</div>
        {Number(module.showMore) === 1 ? (
          <a className="dec-category-nav3__more" href={linkUrl(module.moreLink)}>
            {module.showMoreText || '更多'}<span aria-hidden>›</span>
          </a>
        ) : null}
      </div>
      {pics.length ? (
        <div className="dec-category-nav3__list-wrap">
          <div className="dec-category-nav3__list" ref={listRef}>
            {pics.map((pic: any, i: number) => (
              <div className="dec-category-nav3__item" key={i}>
                <a href={linkUrl(pic.picLink)} target="_blank" rel="noreferrer">
                  <div className="dec-category-nav3__image" style={{ backgroundColor: pic.imageBackgroundColor || module.imageBackgroundColor || undefined }}>
                    <SafeImage src={imageUrl(pic)} alt={pic.picTitle || ''} className="dec-category-nav3__img" />
                  </div>
                  <div className="dec-category-nav3__name">{pic.picTitle}</div>
                  {pic.picDesc ? <div className="dec-category-nav3__desc"><span className="dec-category-nav3__hot">HOT</span><span className="dec-category-nav3__desc-text">{pic.picDesc}</span></div> : null}
                </a>
              </div>
            ))}
          </div>
          {pics.length > 6 ? (
            <>
              <button type="button" className="dec-category-nav3__arrow dec-category-nav3__arrow--prev" onClick={() => scroll(-1488)} aria-label="上一页">‹</button>
              <button type="button" className="dec-category-nav3__arrow dec-category-nav3__arrow--next" onClick={() => scroll(1488)} aria-label="下一页">›</button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function GroupBanner({ module }: ModuleProps) {
  const pics = module.banners || module.picList || [];
  return (
    <Frame frame={module.frame}>
      <div className="dec-group-banner">
        {pics.map((pic: any, index: number) => (
          <a key={index} href={linkUrl(pic.picLink)}>
            <SafeImage src={imageUrl(pic)} alt={pic.picTitle || ''} />
          </a>
        ))}
      </div>
    </Frame>
  );
}

function Fallback({ module }: ModuleProps) {
  return (
    <Frame frame={module.frame}>
      <div className="dec-fallback">
        <span>{module.label || '装修模块'}</span>
        <span className="dec-fallback__hint">
          该模块已注册，React 版渲染待补齐
        </span>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------------------
// 原版契约（camelCase type）专用渲染组件：数据由 contract.ts 适配函数产出，
// 内部尽量复用上方现有渲染器；原版专属视觉字段降级省略。
// ---------------------------------------------------------------------------

/** pcBanner bannerStyle=1：picList 首图主图 + picList2 小图列 + picList3 图标行（原版轮播降级为静态图）。 */
function ContractBanner({ module }: ModuleProps) {
  const main: any[] = module.main || [];
  const recommend: any[] = module.recommend || [];
  const icons: any[] = module.icons || [];
  const hero = main[0];
  if (!hero && !recommend.length && !icons.length) return null;
  return (
    <Frame frame={module.frame} className="dec-hero-frame">
      <div style={{ display: 'flex', gap: 16, alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 auto', minWidth: 0 }}>
          {hero ? (
            <a href={linkUrl(hero.picLink)}>
              <SafeImage
                src={imageUrl(hero)}
                alt={hero.picTitle || ''}
                style={{ width: '100%', display: 'block', borderRadius: 8 }}
              />
            </a>
          ) : (
            <div style={{ height: 280, background: '#fff', borderRadius: 8 }} aria-hidden />
          )}
        </div>
        {recommend.length ? (
          <div style={{ width: 252, flexShrink: 0, display: 'grid', gap: 8, alignContent: 'start' }}>
            {recommend.slice(0, 4).map((pic: any, index: number) => (
              <a key={index} href={linkUrl(pic.picLink)}>
                <SafeImage
                  src={imageUrl(pic)}
                  alt={pic.picTitle || ''}
                  style={{ width: '100%', display: 'block', borderRadius: 8 }}
                />
              </a>
            ))}
          </div>
        ) : null}
      </div>
      {icons.length ? (
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          {icons.map((pic: any, index: number) => (
            <a key={index} href={linkUrl(pic.picLink)} style={{ flex: 1 }}>
              <SafeImage src={imageUrl(pic)} alt={pic.picTitle || ''} style={{ width: '100%', display: 'block' }} />
            </a>
          ))}
        </div>
      ) : null}
    </Frame>
  );
}

/** pcCatProductNormal / pcCatProductWide / pcCatProductSimple 共用：标题 + 关键词链接行 + 可选图片条 + 商品网格。 */
function ContractCatProduct({ module }: ModuleProps) {
  const links: Array<{ link: string; text: string }> = module.links || [];
  const moreHref = linkHref(module.moreLink);
  const bannerPics: any[] = module.banner?.picList || [];
  return (
    <Frame frame={module.frame}>
      <ModuleHeading title={module.title?.titleText} subTitle={module.title?.descText} />
      {links.length || moreHref ? (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 12,
            margin: '4px 0 10px',
            fontSize: 13,
            color: '#666',
          }}
        >
          {links.map((item, index) => (
            <a key={index} href={item.link || '#'}>
              {item.text}
            </a>
          ))}
          {moreHref ? (
            <a href={moreHref} style={{ marginLeft: 'auto', color: '#ff4e4e' }}>
              查看更多 ›
            </a>
          ) : null}
        </div>
      ) : null}
      {bannerPics.length ? <ImageAd module={{ picList: bannerPics, frame: FLAT_FRAME }} /> : null}
      <Product module={{ products: module.product || {}, frame: FLAT_FRAME }} />
    </Frame>
  );
}

/** pcCategoryNav / pcCategoryNav3 / pcCatWide 共用：热门分类卡片（category/category/hot），可按 catIds 过滤。 */
function ContractCategoryHot({ module }: ModuleProps) {
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
  // pcCatWide 只展示 catIds 命中的分类；pcCategoryNav / pcCategoryNav3 展示全部热门分类
  const filtered = catIds.length
    ? categories.filter((category) => catIds.includes(Number(category.categoryId)))
    : categories;
  if (!filtered.length) return null;
  const rowNum = Math.min(10, Math.max(1, Number(module.rowNum) || 6));
  const moreHref = module.showMore ? linkHref(module.moreLink) : '';

  return (
    <Frame frame={module.frame}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <ModuleHeading title={module.title?.titleText || '热门分类'} subTitle={module.title?.descText} />
        {moreHref ? (
          <a href={moreHref} style={{ fontSize: 13, color: '#666', whiteSpace: 'nowrap' }}>
            {module.moreText || '查看更多'} ›
          </a>
        ) : null}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rowNum}, minmax(0, 1fr))`, gap: 12 }}>
        {filtered.map((category: any, index: number) => (
          <a
            key={category.categoryId || index}
            href={`/search?categoryId=${category.categoryId || ''}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
              padding: '8px 4px',
              textAlign: 'center',
            }}
          >
            <SafeImage
              src={category.categoryPic || category.picUrl || category.picThumb}
              alt={category.categoryName || ''}
              style={{ width: 48, height: 48, objectFit: 'contain', background: module.imageBackgroundColor || 'transparent', borderRadius: 8 }}
            />
            <span style={{ fontSize: 14, color: '#333' }}>{category.categoryName || '分类'}</span>
          </a>
        ))}
      </div>
    </Frame>
  );
}

/** pcCustomAd1 / pcCustomAd2 共用：可选链接行 + 三组图片顺次平铺（原版固定编辑版式降级）。 */
function ContractCustomAd({ module }: ModuleProps) {
  const groups: any[][] = module.groups || [];
  const links: Array<{ link: string; text: string }> = module.links || [];
  const hasPics = groups.some((group) => group.length);
  if (!hasPics && !links.length) return null;
  return (
    <Frame frame={module.frame}>
      {links.length ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, margin: '0 0 10px', fontSize: 13, color: '#666' }}>
          {links.map((item, index) => (
            <a key={index} href={item.link || '#'}>
              {item.text}
            </a>
          ))}
        </div>
      ) : null}
      {groups.map((group, index) =>
        group.length ? <ImageAd key={index} module={{ picList: group, frame: FLAT_FRAME }} /> : null
      )}
    </Frame>
  );
}

/** 契约渲染计划的目标组件表：键与 contract.ts 的 ContractRenderPlan.component 对应。 */
const CONTRACT_COMPONENTS: Record<string, (props: ModuleProps) => JSX.Element | null> = {
  // 复用的现有渲染器
  GroupBanner,
  Product,
  RecommendProduct,
  Coupon,
  Seckill,
  Groupon,
  ImageAd,
  // 契约专用组合渲染器
  ContractBanner,
  ContractCatProduct,
  ContractCategoryHot,
  ContractCustomAd,
};

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
  return (
    <div className="decorate-renderer">
      {modules
        .filter((item) => item.isShow !== false)
        .map((item, index) => {
          // 1) 先查原 kebab-case 注册表（保持原行为不变）
          let Component: ModuleComponent | undefined = PC_MODULE_REGISTRY[item.type];
          let moduleProps: { module: Record<string, any> } = {
            module: { ...item.module, label: item.label, frame: item.module?.frame },
          };
          // 2) 再查原版契约（camelCase type）注册表：经适配函数转换后再交给渲染器
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
          return (
            <div className="decorate-renderer__module" key={item.moduleIndex ?? `${item.type}-${index}`}>
              <Component module={moduleProps.module} />
            </div>
          );
        })}
    </div>
  );
}

export type { PageModule };


'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * GlobalSideTools：全站右下角悬浮工具栏。
 *
 * 对齐旧版 view/pc 的四处逻辑：
 * - 首页 ElevatorList（fixed bottom:100px right:0 贴边白卡列，width 60px）：
 *   购物车(flat) + sidebarNav 后台侧边导航项 + 客服(配置开关) + 回到顶部(滚动≥630)
 * - 商品详情页 ElevatorProduct.vue（fixed right:2vw bottom:100px，68×68 白卡列）：
 *   购物车(card) + 扫一扫(当前 URL 二维码弹层) + 顶部(滚动≥630，带「顶部」文字)
 * - 其他页 GlobalSideTools.vue（fixed right:2vw bottom:100px，68×68 白卡列）：
 *   购物车(card) + 回到顶部(滚动>400)
 * - 客服点击 Service.vue#handelToService：serviceType=0 不动作；
 *   4=站内 IM（未登录去登录，已登录 window.open /chat?shopId=0，1200×800）；
 *   其他=外部 url（openType=1 → 500×700 弹窗，否则新标签）
 *
 * 数据：
 * - sidebarNav：GET /api/common/pc/getNav（type=4 侧边导航，后台「导航装修」配置）
 * - 客服配置：GET /api/home/home/getCustomerServiceConfig
 * - 购物车数量：GET /api/cart/cart/list → data.total.totalCount（有 token 才请求）
 */

interface SideNavItem {
  id?: number;
  title?: string;
  icon?: string;
  isShow?: number;
  isBlank?: number;
  link?: { link?: string } | null;
}

interface CustomerServiceConfig {
  url?: string | null;
  openType?: number | string | null;
  serviceType?: number | string | null;
  show?: number | string | boolean | null;
}

/** 这些页面不显示购物车入口（对齐旧版 GlobalSideTools showCartEntry） */
const HIDDEN_CART_ROUTES = ['/cart', '/member/login', '/member/register'];
/** 这些页面整个悬浮栏不挂（对齐旧版 app.vue showSideTools） */
const EXCLUDED_ROUTES = ['/chat', '/pcmobile', '/install'];

function isUnder(path: string, prefix: string) {
  return path === prefix || path.startsWith(`${prefix}/`);
}

function isExternalUrl(raw: string) {
  return /^https?:\/\//i.test(raw) || raw.startsWith('//');
}

/** 旧版 urlFormat 的简化版：内部相对路径补前导斜杠 */
function navHref(item: SideNavItem): string {
  const raw = (item.link?.link || '').trim();
  if (!raw) return '';
  if (isExternalUrl(raw)) return raw;
  return raw.startsWith('/') ? raw : `/${raw}`;
}

export default function GlobalSideTools() {
  const { t } = useTranslation();
  const pathname = usePathname() || '/';
  const [sideNav, setSideNav] = useState<SideNavItem[]>([]);
  const [service, setService] = useState<CustomerServiceConfig | null>(null);
  const [cartCount, setCartCount] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  // 商品详情页「扫一扫」：点击展开二维码弹层（对齐旧版 ElevatorProduct）
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const isHome = pathname === '/';
  const isItem = isUnder(pathname, '/item');
  // 旧版搜索/列表/分类页挂整套 ElevatorList（含 sidebarNav），与首页同组（app.vue showSideTools 排除了这三类路由）
  const showSidebarNav =
    isHome || ['/search', '/list', '/category'].some((prefix) => isUnder(pathname, prefix));

  useEffect(() => {
    if (!qrOpen || qrDataUrl || typeof window === 'undefined') return;
    import('qrcode')
      .then((QR) => QR.toDataURL(window.location.href, { margin: 0 }))
      .then((dataUrl) => setQrDataUrl(dataUrl))
      .catch(() => undefined);
  }, [qrOpen, qrDataUrl]);

  // 路由切换时收起二维码弹层并清空缓存（新商品要重新生成）
  useEffect(() => {
    setQrOpen(false);
    setQrDataUrl('');
  }, [pathname]);

  useEffect(() => {
    fetch('/api/common/pc/getNav')
      .then((response) => response.json())
      .then((json) => {
        const nav = Array.isArray(json?.data?.sidebarNav) ? json.data.sidebarNav : [];
        setSideNav(nav.filter((item: SideNavItem) => Number(item.isShow ?? 1) === 1));
      })
      .catch(() => undefined);

    fetch('/api/home/home/getCustomerServiceConfig')
      .then((response) => response.json())
      .then((json) => setService(json?.data || null))
      .catch(() => undefined);

    const token = localStorage.getItem('accessToken');
    if (token) {
      fetch('/api/cart/cart/list', { headers: { Authorization: `Bearer ${token}` }, credentials: 'include' })
        .then((response) => response.json())
        .then((json) => setCartCount(Number(json?.data?.total?.totalCount || 0)))
        .catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    const onScroll = () => setScrollTop(window.scrollY || document.documentElement.scrollTop || 0);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (EXCLUDED_ROUTES.some((prefix) => isUnder(pathname, prefix))) return null;

  const showCart = !HIDDEN_CART_ROUTES.some((prefix) => isUnder(pathname, prefix));
  // 回到顶部阈值：首页 630（ElevatorList）、商品详情 630（ElevatorProduct）、其他页 400（GlobalSideTools）
  const backTopVisible = scrollTop >= (isHome || isItem ? 630 : 400);
  // sidebarNav 项：首页 + 搜索/列表/分类页展示（对齐旧版 ElevatorList 挂载范围）
  const navItems = showSidebarNav ? sideNav : [];

  // 客服项显隐：配置 show 为真且 serviceType ≠ 0（旧版 showBtn 语义）
  const serviceType = Number(service?.serviceType ?? 0);
  const serviceVisible = Boolean(service) && Number(service?.show ?? 0) === 1 && serviceType !== 0;

  const openService = () => {
    if (!serviceType) return;
    const width = 500;
    const height = 700;
    const top = window.screen.height / 2 - height / 2;
    if (serviceType === 4) {
      if (!localStorage.getItem('accessToken')) {
        window.location.href = '/login';
        return;
      }
      const url = `/chat?shopId=0`;
      window.open(url, '_blank', `width=1200,height=800,top=${window.screen.height / 2 - 400}`);
      return;
    }
    const url = (service?.url || '').trim();
    if (!url) return;
    if (Number(service?.openType ?? 0) === 1) {
      window.open(url, '_blank', `width=${width},height=${height},top=${top}`);
    } else {
      window.open(url, '_blank');
    }
  };

  const renderNavItem = (item: SideNavItem, index: number) => {
    const href = navHref(item);
    if (!href) return null;
    const content = (
      <>
        {item.icon ? (
          <>
            <i className={item.icon} />
            <br />
          </>
        ) : null}
        <span className="gst__label">{item.title}</span>
      </>
    );
    if (isExternalUrl(href)) {
      return (
        <a
          key={item.id ?? index}
          className="gst__card"
          href={href}
          target={Number(item.isBlank) === 1 ? '_blank' : '_self'}
          rel="noopener noreferrer"
        >
          {content}
        </a>
      );
    }
    return (
      <Link
        key={item.id ?? index}
        className="gst__card"
        href={href}
        target={Number(item.isBlank) === 1 ? '_blank' : '_self'}
      >
        {content}
      </Link>
    );
  };

  return (
    <div className={`gst${isHome ? ' gst--home' : ''}`}>
      {showCart ? (
        <Link className="gst__card" href="/cart">
          <span className="gst__icon-wrap">
            <i className="iconfont-pc icon-shiwu-gouwuche" />
            {cartCount > 0 ? <span className="gst__badge">{cartCount > 99 ? '99+' : cartCount}</span> : null}
          </span>
          <span className="gst__label">{t('购物车')}</span>
        </Link>
      ) : null}

      {navItems.map((item, index) => renderNavItem(item, index))}

      {/* 商品详情页「扫一扫」：弹层展示当前页 URL 二维码（对齐旧版 ElevatorProduct） */}
      {isItem ? (
        <div className="gst__qr-anchor">
          {qrOpen ? (
            <div className="gst__qr-panel">
              {qrDataUrl ? (
                <img className="gst__qr-img" src={qrDataUrl} alt="QR" />
              ) : (
                <div className="gst__qr-img gst__qr-img--loading" />
              )}
              <div className="gst__qr-text">{t('在手机端查看此商品')}</div>
            </div>
          ) : null}
          <button
            type="button"
            className={`gst__card${qrOpen ? ' gst__card--active' : ''}`}
            onClick={() => setQrOpen((open) => !open)}
          >
            <i className="iconfont-pc icon-saoyisao" />
            <span className="gst__label">{t('扫一扫')}</span>
          </button>
        </div>
      ) : null}

      {serviceVisible ? (
        <button type="button" className="gst__card" onClick={openService}>
          <i className="iconfont-pc icon-kefu" />
          <span className="gst__label">{t('客服')}</span>
        </button>
      ) : null}

      {backTopVisible ? (
        <button
          type="button"
          className="gst__card gst__card--notail"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={t('回到顶部')}
        >
          <i className="iconfont-pc icon-shangjiantou" />
          {/* 商品详情页回顶带「顶部」文字（对齐旧版 ElevatorProduct） */}
          {isItem ? <span className="gst__label">{t('顶部')}</span> : null}
        </button>
      ) : null}
    </div>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import ShoppingCart from '@icon-park/react/es/icons/ShoppingCart';
import Scan from '@icon-park/react/es/icons/Scan';
import HeadsetOne from '@icon-park/react/es/icons/HeadsetOne';
import ArrowUp from '@icon-park/react/es/icons/ArrowUp';
import AlarmClock from '@icon-park/react/es/icons/AlarmClock';
import Message from '@icon-park/react/es/icons/Message';

/**
 * GlobalSideTools：全站右下角悬浮工具栏（现代化毛玻璃 Dock 改版）。
 *
 * 对齐旧版 view/pc 的四处逻辑（条目与显隐规则不变，只换视觉）：
 * - 首页 ElevatorList：购物车(flat) + sidebarNav 后台侧边导航项 + 客服(配置开关) + 回到顶部(滚动≥630)
 * - 商品详情页 ElevatorProduct.vue：购物车(card) + 扫一扫(当前 URL 二维码弹层) + 顶部(滚动≥630)
 * - 其他页 GlobalSideTools.vue：购物车(card) + 回到顶部(滚动>400)
 * - 客服点击 Service.vue#handelToService：serviceType=0 不动作；
 *   4=站内 IM（未登录去登录，已登录 window.open /chat?shopId=0，1200×800）；
 *   其他=外部 url（openType=1 → 500×700 弹窗，否则新标签）
 *
 * 视觉（app/globals.scss .gst-*）：
 * 毛玻璃竖向 Dock（半透明白 + backdrop blur + 全圆角），条目为圆形图标位，
 * 悬停时圆位填充主题色、左侧滑出文字标签；购物车带红色数量角标；
 * 回到顶部滚动过阈值后渐入。
 * 图标统一走 @icon-park/react（描边风格与全站一致，随 currentColor 变色）；
 * 后台导航装修的 iconfont 类名不再使用——已知标题映射 NAV_ITEM_ICONS，
 * 未匹配的标题回退展示首字符。
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

/**
 * 后台侧边导航（type=4）的 icon-park 图标映射。
 * 后台「导航装修」的 icon 字段为 iconfont 类名且可能为空（如「限时秒杀」icon=""），
 * Dock 统一走 icon-park：已知标题按此映射取语义正确的图标，
 * 未匹配到的标题回退为标题首字符展示。
 */
const NAV_ITEM_ICONS: Record<string, React.ComponentType<{ size?: number | string }>> = {
  限时秒杀: AlarmClock,
  反馈: Message,
};

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

  // 客服项显隐：配置 show 为真且 serviceType ≠ 0（对齐旧版 showBtn 语义，后台开了才显示）
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
    // 图标：标题映射到 icon-park；未匹配的标题回退首字符（配置的 iconfont 类名不再使用）
    const NavIcon = NAV_ITEM_ICONS[item.title || ''];
    if (isExternalUrl(href)) {
      return (
        <a
          key={item.id ?? index}
          className="gst__item"
          href={href}
          target={Number(item.isBlank) === 1 ? '_blank' : '_self'}
          rel="noopener noreferrer"
        >
          {NavIcon ? <NavIcon size={22} /> : <span className="gst__item-char">{(item.title || '').slice(0, 1)}</span>}
          <span className="gst__tip">{item.title}</span>
        </a>
      );
    }
    return (
      <Link
        key={item.id ?? index}
        className="gst__item"
        href={href}
        target={Number(item.isBlank) === 1 ? '_blank' : '_self'}
      >
        {NavIcon ? <NavIcon size={22} /> : <span className="gst__item-char">{(item.title || '').slice(0, 1)}</span>}
        <span className="gst__tip">{item.title}</span>
      </Link>
    );
  };

  return (
    <div className={`gst${isHome ? ' gst--home' : ''}`}>
      {showCart ? (
        <Link className="gst__item" href="/cart" aria-label={t('购物车')}>
          <ShoppingCart size={22} />
          {cartCount > 0 ? <span className="gst__badge">{cartCount > 99 ? '99+' : cartCount}</span> : null}
          <span className="gst__tip">{t('购物车')}</span>
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
            className={`gst__item${qrOpen ? ' is-active' : ''}`}
            onClick={() => setQrOpen((open) => !open)}
          >
            <Scan size={22} />
            <span className="gst__tip">{t('扫一扫')}</span>
          </button>
        </div>
      ) : null}

      {serviceVisible ? (
        <button type="button" className="gst__item" onClick={openService}>
          <HeadsetOne size={22} />
          <span className="gst__tip">{t('客服')}</span>
        </button>
      ) : null}

      {backTopVisible ? (
        <button
          type="button"
          className="gst__item gst__item--top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label={t('回到顶部')}
        >
          <ArrowUp size={22} />
          <span className="gst__tip">{t('回到顶部')}</span>
        </button>
      ) : null}
    </div>
  );
}

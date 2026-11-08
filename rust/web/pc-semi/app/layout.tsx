import type { Metadata, Viewport } from 'next';
import './semi.css';
import './pc-global-utils.scss';
import './globals.scss';
import './search-variants.scss';
import './search-page.scss';
import './article-help.scss';
import './article-side.scss';
import './member-base.scss';
import './member-order.scss';
import './member-order-modern.scss';
import './member-invoice-modern.scss';
import './member-group-modern.scss';
import './member-comment-modern.scss';
import './member-history-modern.scss';
import './member-pages.scss';
import './member-home.scss';
import './core-pages.scss';
import './shop-page.scss';
import './join-page.scss';
import './exchange-page.scss';
import './chat-page.scss';
import './auth-page.scss';
import './auth-element-base.scss';
import './auth-modern.scss';
import './catalog-page.scss';
import GlobalSideTools from '@/components/GlobalSideTools';
import PrivacyConsent from '@/components/PrivacyConsent';
import MobileRedirect from '@/components/MobileRedirect';
import VisitLogger from '@/components/VisitLogger';
import I18nProvider from '@/i18n/I18nProvider';
import { getHeaderBootstrap } from '@/lib/api';
import { PC_HEADER_BOOTSTRAP_ID } from '@/lib/header-bootstrap';
import { loadTheme } from '@/lib/theme-server';
import { setServerCurrency } from '@/lib/currency';
import { setStorageUrl } from '@/lib/image';

const SITE_URL = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');
const SITE_NAME = '万物新生';
const SITE_TITLE = '万物新生 · 退役动力电池循环利用产业服务平台';
const SITE_DESCRIPTION = '万物新生，退役动力电池循环利用产业服务平台，安全合规、高效协同、绿色循环。';
/** 站点默认社交分享图（当前仅 500×500 应用图标可作为可靠兜底；见 docs/seo-responsive-audit.md 残留项）。 */
const SITE_OG_IMAGE = '/icon.png';
const SITE_OG_IMAGE_WIDTH = 500;
const SITE_OG_IMAGE_HEIGHT = 500;

/**
 * 站点级 SEO 元数据：接后台 base 配置（对齐旧版 app.vue useHead）。
 * - title = shopTitle（poweredByStatus != 1 时拼 "-powered by tigshop"，与旧版一致）
 * - description/keywords = shopDesc/shopKeywords；favicon = icoImg
 * 子页面 generateMetadata 仍可覆盖 title。
 */
export async function generateMetadata(): Promise<Metadata> {
  const base = await getHeaderBootstrap();
  const config = base?.base || null;
  const shopTitle = String(config?.shopTitle || SITE_NAME);
  const poweredByStatus = Number(config?.poweredByStatus ?? 0);
  const title = poweredByStatus !== 1 ? `${shopTitle}-powered by tigshop` : shopTitle;
  const description = String(config?.shopDesc || SITE_DESCRIPTION);
  const keywordsRaw = String(config?.shopKeywords || '');
  const icoImg = String(config?.icoImg || '');
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    keywords: keywordsRaw ? keywordsRaw.split(',').map((item) => item.trim()).filter(Boolean) : undefined,
    ...(icoImg ? { icons: { icon: icoImg } } : {}),
    applicationName: SITE_NAME,
    manifest: '/manifest.webmanifest',
    // iOS Safari 会把疑似电话/邮箱/地址的文本自动转成链接，PC 商城不需要该行为
    formatDetection: { telephone: false, email: false, address: false },
    appleWebApp: { capable: true, title: shopTitle || SITE_NAME, statusBarStyle: 'default' },
    openGraph: {
      type: 'website',
      locale: 'zh_CN',
      siteName: shopTitle || SITE_NAME,
      title,
      description,
      url: SITE_URL,
      images: [
        {
          url: SITE_OG_IMAGE,
          width: SITE_OG_IMAGE_WIDTH,
          height: SITE_OG_IMAGE_HEIGHT,
          alt: shopTitle || SITE_NAME,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [SITE_OG_IMAGE],
    },
    // 说明：此处不再声明 robots.index/follow。Next 会为 404 自动注入
    // `<meta name="robots" content="noindex"/>`，若根布局再输出 index,follow 会形成冲突指令。
    // 普通页面不输出 robots meta 即等价 index,follow；Googlebot 的增强抓取指令用 other 单独声明。
    other: {
      googlebot: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    },
  };
}

/**
 * 显式 viewport：保证移动端按设备宽度渲染，并补充主题色 / 刘海屏安全区。
 * - 不设置 maximumScale / userScalable:false，避免禁用缩放（可访问性要求）；
 * - themeColor 取后台「装修 → 主题风格」的 --general，与 manifest.theme_color、
 *   页面主色同一来源；后台改色后移动端浏览器 UI（地址栏 / 状态栏）同步变化。
 */
export async function generateViewport(): Promise<Viewport> {
  const { primary } = await loadTheme();
  return {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
    colorScheme: 'light',
    themeColor: primary,
  };
}

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}${SITE_OG_IMAGE}`,
  description: SITE_DESCRIPTION,
  areaServed: 'CN',
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
  inLanguage: 'zh-CN',
  description: SITE_DESCRIPTION,
  potentialAction: {
    '@type': 'SearchAction',
    target: `${SITE_URL}/search?keyword={search_term_string}`,
    'query-input': 'required name=search_term_string',
  },
};

/** 转义 `<` 与行分隔符，避免 JSON 提前结束内联 script */
function serializeHeaderBootstrap(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // 头部公共数据（Logo / 语言 / 货币）在服务端并发预取，随首屏 HTML 一起下发，
  // 避免客户端各子模块逐个请求导致 «我的/购物车已出现、语言与 Logo 后出现» 的观感。
  // 主题风格同批预取：后台可自定义主题色，服务端直接渲染成 :root 变量，首屏即生效无闪烁。
  const [headerBootstrap, theme] = await Promise.all([getHeaderBootstrap(), loadTheme()]);
  const themeCss = theme.css;

  // 后台 base 配置注入：storageUrl（图片相对路径拼接）+ 默认货币符号。
  // 换币 cookie（currentCurrencyData）在服务端读取快照注入，保证 SSR 与客户端 hydration 价格一致。
  const base = headerBootstrap?.base;
  setStorageUrl(base?.storageUrl);
  let serverRate: string | number | null = null;
  let serverLang = 'zh-CN';
  try {
    const { cookies } = await import('next/headers');
    // html lang SSR 输出（对齐旧版 app.vue htmlAttrs.lang = XLocaleCode）
    const localeCookie = cookies().get('locale')?.value || '';
    serverLang = localeCookie.toLowerCase().startsWith('en') ? 'en-US' : 'zh-CN';
    const raw = cookies().get('currentCurrencyData')?.value;
    if (raw) {
      const parsed = JSON.parse(decodeURIComponent(raw));
      serverRate = parsed?.rate ?? null;
    }
  } catch {
    /* cookie 缺失时按默认汇率 1 处理 */
  }
  setServerCurrency(base?.dollarSign, serverRate);

  return (
    <html lang={serverLang}>
      <body>
        {/* 后台主题风格 → :root CSS 变量。必须排在所有样式表之前，才能被
            globals.scss / cart-modern.scss 里的 var(--general, …) 兜底链正确消费。 */}
        {themeCss ? <style id="pc-theme-vars" dangerouslySetInnerHTML={{ __html: themeCss }} /> : null}
        {/* 平台图标字体：对齐旧版 view/pc/assets/css/global.css 顶部 @import。
            营销通栏左侧类目 / 全部分类下拉的 floorIcoFont（iconfont-tig、iconfont-pc）
            依赖这两份字体样式，缺失时 `<i class="iconfont-tig icon-xxx" />` 只留空白占位。
            App Router 的 head 由框架管理，这里放在 body 顶部同样会被浏览器加载。 */}
        <link rel="stylesheet" href="https://at.alicdn.com/t/c/font_4441878_79ndpblv9x9.css" />
        <link rel="stylesheet" href="https://at.alicdn.com/t/c/font_4389188_4gtbloa6zjm.css" />
        <script
          id={PC_HEADER_BOOTSTRAP_ID}
          type="application/json"
          dangerouslySetInnerHTML={{ __html: serializeHeaderBootstrap(headerBootstrap) }}
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([organizationJsonLd, websiteJsonLd]) }} />
        <I18nProvider>
          {children}
          {/* 移动端浏览器自动跳 H5（autoRedirect=1 时，对齐旧版 app.vue handlerToMobile） */}
          <MobileRedirect />
          {/* 访问统计埋点（对齐旧版 StatisticLog：/api/common/log，isNew/click 跨天判断） */}
          <VisitLogger />
          {/* 全站右下角悬浮工具栏：购物车 + 后台侧边导航 + 客服 + 回到顶部。
              对齐旧版 view/pc 首页 ElevatorList（贴边形态）与 GlobalSideTools（浮动形态）。
              原 CustomerServiceWidget 的内嵌 IM 面板被客服项的 /chat 窗口分流替代。 */}
          <GlobalSideTools />
          {/* Cookie 隐私偏好（对齐旧版 PrivacyConsent：仅跨境演示站 NEXT_PUBLIC_PC_DEMO=1 渲染） */}
          {process.env.NEXT_PUBLIC_PC_DEMO === '1' ? <PrivacyConsent /> : null}
        </I18nProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import './semi.css';
import './globals.scss';
import CustomerServiceWidget from '@/components/CustomerServiceWidget';
import I18nTranslator from '@/components/I18nTranslator';
import I18nProvider from '@/i18n/I18nProvider';
import { getHeaderBootstrap } from '@/lib/api';
import { PC_HEADER_BOOTSTRAP_ID } from '@/lib/header-bootstrap';
import { loadTheme } from '@/lib/theme-server';

const SITE_URL = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');
const SITE_NAME = '万物新生';
const SITE_TITLE = '万物新生 · 退役动力电池循环利用产业服务平台';
const SITE_DESCRIPTION = '万物新生，退役动力电池循环利用产业服务平台，安全合规、高效协同、绿色循环。';
/** 站点默认社交分享图（当前仅 500×500 应用图标可作为可靠兜底；见 docs/seo-responsive-audit.md 残留项）。 */
const SITE_OG_IMAGE = '/icon.png';
const SITE_OG_IMAGE_WIDTH = 500;
const SITE_OG_IMAGE_HEIGHT = 500;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  keywords: ['动力电池回收', '电池拆解', '循环利用', '万物新生'],
  applicationName: SITE_NAME,
  manifest: '/manifest.webmanifest',
  // iOS Safari 会把疑似电话/邮箱/地址的文本自动转成链接，PC 商城不需要该行为
  formatDetection: { telephone: false, email: false, address: false },
  appleWebApp: { capable: true, title: SITE_NAME, statusBarStyle: 'default' },
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    images: [
      {
        url: SITE_OG_IMAGE,
        width: SITE_OG_IMAGE_WIDTH,
        height: SITE_OG_IMAGE_HEIGHT,
        alt: SITE_NAME,
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
  // 说明：此处不再声明 robots.index/follow。Next 会为 404 自动注入
  // `<meta name="robots" content="noindex"/>`，若根布局再输出 index,follow 会形成冲突指令。
  // 普通页面不输出 robots meta 即等价 index,follow；Googlebot 的增强抓取指令用 other 单独声明。
  other: {
    googlebot: 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
  },
};

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

  return (
    <html lang="zh-CN">
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
          <CustomerServiceWidget />
          <I18nTranslator />
        </I18nProvider>
      </body>
    </html>
  );
}

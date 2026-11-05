import type { Metadata, Viewport } from 'next';
import './semi.css';
import './globals.scss';
import CustomerServiceWidget from '@/components/CustomerServiceWidget';
import I18nTranslator from '@/components/I18nTranslator';
import I18nProvider from '@/i18n/I18nProvider';

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
 * - themeColor 与 manifest.theme_color、PWA 一致（#165dff）。
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light',
  themeColor: '#165dff',
};

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
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

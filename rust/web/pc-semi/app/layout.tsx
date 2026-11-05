import type { Metadata } from 'next';
import './semi.css';
import './globals.scss';
import CustomerServiceWidget from '@/components/CustomerServiceWidget';
import I18nTranslator from '@/components/I18nTranslator';
import I18nProvider from '@/i18n/I18nProvider';

const SITE_URL = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');
const SITE_NAME = '万物新生';
const SITE_DESCRIPTION = '万物新生，退役动力电池循环利用产业服务平台，安全合规、高效协同、绿色循环。';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: '万物新生 · 退役动力电池循环利用产业服务平台',
  description: SITE_DESCRIPTION,
  keywords: ['动力电池回收', '电池拆解', '循环利用', '万物新生'],
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: 'zh_CN',
    siteName: SITE_NAME,
    title: '万物新生 · 退役动力电池循环利用产业服务平台',
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: '万物新生 · 退役动力电池循环利用产业服务平台',
    description: SITE_DESCRIPTION,
  },
  robots: { index: true, follow: true },
};

const organizationJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: SITE_NAME,
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  areaServed: 'CN',
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: SITE_NAME,
  url: SITE_URL,
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

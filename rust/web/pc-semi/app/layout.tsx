import type { Metadata } from 'next';
import './semi.css';
import './globals.scss';
import CustomerServiceWidget from '@/components/CustomerServiceWidget';
import I18nTranslator from '@/components/I18nTranslator';
import I18nProvider from '@/i18n/I18nProvider';

export const metadata: Metadata = {
  title: '万物新生 · 退役动力电池循环利用产业服务平台',
  description: '万物新生，退役动力电池循环利用产业服务平台，安全合规、高效协同、绿色循环。',
  keywords: ['动力电池回收', '电池拆解', '循环利用', '万物新生'],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <I18nProvider>
          {children}
          <CustomerServiceWidget />
          <I18nTranslator />
        </I18nProvider>
      </body>
    </html>
  );
}

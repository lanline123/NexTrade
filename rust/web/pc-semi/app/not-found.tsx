import Link from 'next/link';
import PcFooter from '@/components/PcFooter';

import { getServerT } from '@/i18n/server';
/**
 * 404 兜底页
 * 源码对照：pages/[...slug].vue —— 404 - 页面未找到 / 商品已下架 两种文案
 */
export default function NotFound() {
    const t = getServerT();
  return (
    <>
      <main className="pc-error-page">
        <div className="pc-error-card">
          <div className="pc-error-code">404</div>
          <h1>{t('404 - 页面未找到')}</h1>
          <p>{t('抱歉，您所请求的页面不存在。')}</p>
          <div className="pc-error-actions">
            <Link href="/" className="is-primary">{t('返回首页')}</Link>
          </div>
        </div>
      </main>
      <PcFooter />
    </>
  );
}

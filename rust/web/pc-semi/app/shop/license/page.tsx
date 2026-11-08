import type { Metadata } from 'next';
import { getShopDetail } from '@/lib/api';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';

/*
 * 营业执照公示页（独立白页，无站点头尾）。
 * 源码对照：view/pc/pages/shop/license.vue
 * 样式：app/shop-page.scss → .pg-shop-license
 *
 * 旧版结构：
 *   .license-doc > .watermark > span × 48（斜铺水印）
 *                > .doc-inner > h1.doc-title
 *                             > p.doc-notice > .notice-icon + 文案
 *                             > h2.doc-section「证照」
 *                             > .doc-cert > img / el-empty「暂无营业执照」
 *                             > .doc-notes > p × 2
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
    title: t('网店经营者营业执照信息 · 万物新生'),
  };
}

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function ShopLicensePage({ searchParams }: PageProps) {
  const t = getServerT();
  const shopId = Number(readParam(searchParams?.shopId)) || 0;
  const shop = shopId ? await getShopDetail(shopId).catch(() => null) : null;
  const licenseUrl = String((shop as any)?.businessLicensePic || '').trim();
  const watermark = t('{shop}营业执照信息公示专用', { shop: shop?.shopTitle || '' });

  return (
    <div className="pg-shop-license">
      <div className="license-doc">
        <div className="watermark" aria-hidden="true">
          {Array.from({ length: 48 }).map((_, index) => (
            <span key={index}>{watermark}</span>
          ))}
        </div>
        <div className="doc-inner">
          <h1 className="doc-title">{t('网店经营者营业执照信息')}</h1>
          <p className="doc-notice">
            <i className="notice-icon" aria-hidden="true">
              i
            </i>
            {t('根据相关法律法规要求，网店经营相关资质信息公示如下：')}
          </p>
          <h2 className="doc-section">{t('证照')}</h2>
          {licenseUrl ? (
            <div className="doc-cert">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={licenseUrl} alt={t('营业执照')} />
            </div>
          ) : (
            <div className="el-empty">{t('暂无营业执照')}</div>
          )}
          <div className="doc-notes">
            <p>{t('注：以上营业执照信息来源于卖家自行申报或市监部门系统数据，具体以市监部门登记为准。')}</p>
            <p>{t('经营者需确保信息真实有效，平台也将定期核查，如与实际不符，为避免违规，请联系当地市监部门或平台客服更新。')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

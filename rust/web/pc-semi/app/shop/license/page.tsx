import type { Metadata } from 'next';
import { getShopDetail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '网店经营者营业执照信息 · 万物新生',
};

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

function readParam(value: string | string[] | undefined): string {
  return Array.isArray(value) ? value[0] || '' : value || '';
}

export default async function ShopLicensePage({ searchParams }: PageProps) {
  const shopId = Number(readParam(searchParams?.shopId)) || 0;
  const shop = shopId ? await getShopDetail(shopId).catch(() => null) : null;
  const licenseUrl = String((shop as any)?.businessLicensePic || '').trim();
  const watermark = `${shop?.shopTitle || ''}营业执照信息公示专用`;

  return (
    <div className="license-doc">
      <div className="license-watermark" aria-hidden="true">
        {Array.from({ length: 48 }).map((_, index) => <span key={index}>{watermark}</span>)}
      </div>
      <div className="license-inner">
        <h1 className="license-title">网店经营者营业执照信息</h1>
        <p className="license-notice">根据相关法律法规要求，网店经营相关资质信息公示如下：</p>
        <h2 className="license-section">证照</h2>
        {licenseUrl ? (
          <div className="license-cert"><img src={licenseUrl} alt="营业执照" /></div>
        ) : (
          <div className="license-empty">暂无营业执照</div>
        )}
        <div className="license-notes">
          <p>注：以上营业执照信息来源于卖家自行申报或市监部门系统数据，具体以市监部门登记为准。</p>
          <p>经营者需确保信息真实有效，平台也将定期核查，如与实际不符，为避免违规，请联系当地市监部门或平台客服更新。</p>
        </div>
      </div>
    </div>
  );
}

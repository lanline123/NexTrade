import type { Metadata } from 'next';
import Link from 'next/link';
import PcHeader from '@/components/PcHeaderWithData';
import PcFooter from '@/components/PcFooter';
import { DecorateRenderer } from '@/decorate/components/modules';
import type { DecorateModule } from '@/decorate/types';
import { getActivityDecorate, getFooterData } from '@/lib/api';
import { TYPE_MAP } from '../type-map';

import { getServerT } from '@/i18n/server';
/**
 * 活动装修模块独立页。
 * 源码对照：java.../view/pc/pages/activity/<pcXxx>/index.vue —— 13 个可独立访问的路由。
 * 旧实现一律 redirect('/activity') 导致这些页面消失，这里按 slug 渲染对应模块，
 * 并保留原版 activity/index.vue 的 f-bottom 版权/备案/客服信息。
 */
export const dynamic = 'force-dynamic';
export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return { title: t('活动专题 · 万物新生') };
}

const SLUG_TO_TYPE: Record<string, string> = {
  pccoupon: 'pcCoupon', pcgroupon: 'pcGroupon', pcimagead: 'pcImageAd',
  pcimagehotarea: 'pcImageHotarea', pcimagenav: 'pcImageNav',
  pcimagesquaread: 'pcImageSquareAd', pcnotice: 'pcNotice',
  pcproduct: 'pcProduct', pcproductgrouping: 'pcProductGrouping',
  pcseckill: 'pcSeckill', pctitlead: 'pcTitleAd',
  pcwhiteblank: 'pcWhiteBlank', pcwhiteline: 'pcWhiteLine',
};

const TITLES: Record<string, string> = {
  pcCoupon: '优惠券', pcGroupon: '拼团', pcSeckill: '限时秒杀',
  pcProduct: '商品推荐', pcProductGrouping: '商品分组', pcImageAd: '图片广告',
  pcImageHotarea: '热区广告', pcImageNav: '图片导航', pcImageSquareAd: '方格广告',
  pcNotice: '公告', pcTitleAd: '标题广告', pcWhiteBlank: '空白占位', pcWhiteLine: '分割线',
};

function readNumber(value: string | string[] | undefined): number | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

interface PageProps {
  params: { slug: string[] };
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function ActivityModulePage({ params, searchParams }: PageProps) {
    const t = getServerT();
  const segments = Array.isArray(params?.slug) ? params.slug : String(params?.slug || '').split('/');
  const last = String(segments[segments.length - 1] || '').toLowerCase();
  const legacyType = SLUG_TO_TYPE[last] || last;
  const mappedType = TYPE_MAP[legacyType] || TYPE_MAP[last] || legacyType;
  const id = readNumber(searchParams?.id);
  const previewId = readNumber(searchParams?.previewId);
  const [data, footer] = await Promise.all([
    getActivityDecorate({ id, previewId }).catch(() => null),
    getFooterData().catch(() => null),
  ]);
  const all: DecorateModule[] = (data?.moduleList || [])
    .filter((item) => item.isShow !== false)
    .map((item) => ({ ...item, type: TYPE_MAP[String(item.type)] || item.type }) as DecorateModule);
  const matched = all.filter((item) => item.type === mappedType);
  const modules: DecorateModule[] = matched.length ? matched : ([{ type: mappedType, module: {} }] as unknown as DecorateModule[]);
  const legal = footer as Record<string, any> | null;

  return (
    <>
      <PcHeader config={(data?.pageModule as any)?.pcHeader} />
      <main className="pc-activity-page">
        <div className="pc-activity-container" style={{ width: 1200, maxWidth: '100%', margin: '0 auto' }}>
          <div className="pc-list-head">
            <h1>{TITLES[legacyType] || t('活动专题')}</h1>
            <Link href="/activity">{t('返回活动页')}</Link>
          </div>
          <div className="module-container">
            <DecorateRenderer modules={modules} />
          </div>
          {/* 源码 activity/index.vue f-bottom：公司信息 / ICP / EDI / 公安备案 / 客服 */}
          <div className="pc-activity-legal" style={{ marginTop: 24, padding: '16px 0', color: '#98a2b3', fontSize: 12, textAlign: 'center' }}>
            {legal?.shopCompanyTxt ? <p>{String(legal.shopCompanyTxt)}</p> : null}
            {legal?.shopIcpNo ? <p>ICP 备案号：{String(legal.shopIcpNo)}</p> : null}
            {legal?.ediLicenseNo ? <p>EDI 许可证：{String(legal.ediLicenseNo)}</p> : null}
            {legal?.policeRecordNo ? <p>公安备案：{String(legal.policeRecordNo)}</p> : null}
            {legal?.kefuPhone ? <p>客服电话：{String(legal.kefuPhone)}{legal?.kefuTime ? ` · ${String(legal.kefuTime)}` : ''}</p> : null}
            {legal?.kefuAddress ? <p>{String(legal.kefuAddress)}</p> : null}
          </div>
        </div>
      </main>
      <PcFooter />
    </>
  );
}

import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import { DecorateRenderer } from '@/decorate/components/modules';
import type { DecorateModule } from '@/decorate/types';
import { getActivityDecorate } from '@/lib/api';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '活动专题 · 万物新生',
  description: '活动专题装修页面。',
};

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

const TYPE_MAP: Record<string, string> = {
  pcImageAd: 'pc-image-ad',
  pcImageSquareAd: 'pc-image-square-ad',
  pcImageHotarea: 'pc-image-hotarea',
  pcProduct: 'pc-product',
  pcWhiteLine: 'pc-divider',
  pcWhiteBlank: 'pc-spacer',
  pcImageNav: 'pc-image-nav',
  pcTitleAd: 'pc-title-ad',
  pcNotice: 'pc-notice',
  pcCoupon: 'pc-home-coupon',
  pcSeckill: 'pc-home-seckill',
  pcGroupon: 'pc-home-groupon',
};

function readNumber(value: string | string[] | undefined): number | undefined {
  const text = Array.isArray(value) ? value[0] : value;
  const number = Number(text);
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

export default async function ActivityPage({ searchParams }: PageProps) {
  const id = readNumber(searchParams?.id);
  const previewId = readNumber(searchParams?.previewId);
  let data: Awaited<ReturnType<typeof getActivityDecorate>> | null = null;
  let error = '';
  try {
    data = await getActivityDecorate({ id, previewId });
  } catch (reason) {
    error = reason instanceof Error ? reason.message : '活动数据加载失败';
  }
  const modules: DecorateModule[] = (data?.moduleList || [])
    .filter((item) => item.isShow !== false)
    .map((item) => {
      const mapped = TYPE_MAP[item.type] || item.type;
      return { ...item, type: mapped } as DecorateModule;
    });

  return (
    <>
      <PcHeader config={(data?.pageModule as any)?.pcHeader} />
      <main className="pc-activity-page">
        <div className="pc-activity-container">
          {error ? (
            <div className="pc-setup-error"><h1>活动页加载失败</h1><p>{error}</p></div>
          ) : modules.length ? (
            <DecorateRenderer modules={modules} />
          ) : (
            <div className="pc-setup-error"><h1>活动页暂无装修内容</h1></div>
          )}
        </div>
      </main>
      <PcFooter />
    </>
  );
}

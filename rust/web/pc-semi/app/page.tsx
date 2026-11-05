import { getHomeDecorate } from '@/lib/api';
import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import { DecorateRenderer } from '@/decorate/components/modules';
import type { HomeDecorateResponse } from '@/decorate/types';
import PcFooter from '@/components/PcFooter';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { alternates: { canonical: '/' } };

function pageBackground(pageModule: HomeDecorateResponse['pageModule']): React.CSSProperties {
  const style: React.CSSProperties = { background: '#f2f3f5' };
  if (!pageModule) return style;
  if (pageModule.backgroundColor) style.background = pageModule.backgroundColor;
  const image = pageModule.backgroundImage?.picUrl;
  if (image) {
    style.backgroundImage = `url(${image})`;
    style.backgroundPosition = 'top center';
    style.backgroundRepeat = pageModule.backgroundRepeat === 2 ? 'repeat' : 'no-repeat';
    style.backgroundSize = pageModule.backgroundSize === 2 ? 'auto 100%' : '100% auto';
  }
  return style;
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const raw = searchParams?.previewId;
  const previewId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;

  let data: HomeDecorateResponse | null = null;
  let error = '';
  try {
    data = await getHomeDecorate({ previewId });
  } catch (reason) {
    error = reason instanceof Error ? reason.message : '装修数据加载失败';
  }

  return (
    <>
      <PcHeader config={data?.pageModule?.pcHeader} />
      <main className="pc-home" style={pageBackground(data?.pageModule)}>
        <div className="pc-container">
          {error ? (
            <div className="pc-setup-error">
              <h1>PC 装修数据加载失败</h1>
              <p>{error}</p>
              <p>请确认后端 `/api/home/home/pcIndex` 可访问，或设置 `PC_API_BASE`。</p>
            </div>
          ) : data?.moduleList?.length ? (
            <DecorateRenderer modules={data.moduleList} />
          ) : (
            <div className="pc-setup-error">
              <h1>还没有可渲染的新版装修</h1>
              <p>请在 Admin 的 PC 首页装修中发布新版模块。</p>
            </div>
          )}
        </div>
      </main>
      <PcFooter showFriendly />
    </>
  );
}

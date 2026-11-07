import { getHomeDecorate, getProducts } from '@/lib/api';
import Link from 'next/link';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PcHeader from '@/components/PcHeaderWithData';
import { DecorateRenderer } from '@/decorate/components/modules';
import type { HomeDecorateResponse } from '@/decorate/types';
import PcFooter from '@/components/PcFooter';

import { getServerT } from '@/i18n/server';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { alternates: { canonical: '/' } };

/** 后台装修页面背景映射（对齐旧版 pages/index.vue pageBgStyle 全量 repeat/size 表） */
const BACKGROUND_REPEAT: Record<number, string> = { 1: 'no-repeat', 2: 'repeat', 3: 'repeat-y', 4: 'repeat-x', 5: 'no-repeat' };
const BACKGROUND_SIZE: Record<number, string> = { 1: '100% auto', 2: 'auto 100%', 3: '100% 100%', 4: '100% auto' };

function pageBackground(pageModule: HomeDecorateResponse['pageModule']): React.CSSProperties {
  const style: React.CSSProperties = { background: '#f2f3f5' };
  if (!pageModule) return style;
  if (pageModule.backgroundColor) style.background = pageModule.backgroundColor;
  const image = pageModule.backgroundImage?.picUrl;
  if (image) {
    style.backgroundImage = `url(${image})`;
    style.backgroundPosition = 'top center';
    style.backgroundRepeat = BACKGROUND_REPEAT[Number(pageModule.backgroundRepeat)] || 'no-repeat';
    style.backgroundSize = BACKGROUND_SIZE[Number(pageModule.backgroundSize)] || '100% auto';
  }
  return style;
}

/**
 * 原版 pages/index.vue 的 homeStyleVersion=old 分支：硬编码模块链
 * HomeBanner / HomeBannerNew / HomeCatWide / HomeCategoryNew / HomeCoupon /
 * HomeCatProductNormal / HomeCatProductWide / HomeCatProductSimple /
 * HomeCustomAd1 / HomeCustomAd2 / HomeImageAd / HomeRecommendProduct。
 * 新版 DecorateRenderer 只覆盖 new，这里提供结构等价的旧版首页作为回退，
 * 装修数据为空或接口失败时不再显示「还没有可渲染的新版装修」错误页。
 */
async function LegacyHome() {
    const t = getServerT();
  const result = await getProducts({ page: 1, size: 8 }).catch(() => null);
  const products = (result?.records || []) as Array<Record<string, any>>;
  const card = (row: Record<string, any>, index: number) => (
    <Link className="legacy-home__card" key={`${row.productId || row.productSn || index}`} href={`/product/${row.productId || row.productSn || ''}`}>
      <img src={String(row.picThumb || row.picUrl || '')} alt={String(row.productName || '')} loading="lazy" />
      <strong>{String(row.productName || '')}</strong>
      <b>¥ {Number(row.productPrice || 0).toFixed(2)}</b>
    </Link>
  );
  return (
    <div className="legacy-home">
      <section className="legacy-home__banner">
        <div>
          <h1>{t('退役动力电池循环利用产业服务平台')}</h1>
          <p>{t('破碎分选整线 · 精细化拆解 · 黑粉回收装备')}</p>
        </div>
      </section>
      <nav className="legacy-home__nav">
        <Link href="/search">{t('全部商品')}</Link>
        <Link href="/shop">{t('店铺街')}</Link>
        <Link href="/coupon/list">{t('领券中心')}</Link>
        <Link href="/seckill/list">{t('限时秒杀')}</Link>
        <Link href="/article/news/list">{t('资讯中心')}</Link>
        <Link href="/join">{t('招商入驻')}</Link>
      </nav>
      <section className="legacy-home__floor">
        <h2 className="com-pc-title">{t('推荐商品')}</h2>
        <div className="legacy-home__grid">{products.slice(0, 4).map(card)}</div>
      </section>
      <section className="legacy-home__floor">
        <h2 className="com-pc-title">{t('猜你喜欢')}</h2>
        <div className="legacy-home__grid">{products.length > 4 ? products.slice(4, 8).map(card) : products.map(card)}</div>
      </section>
      {!products.length ? <div className="pc-list-empty">{t('商品数据加载失败，请稍后刷新')}</div> : null}
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
    const t = getServerT();
  const raw = searchParams?.previewId;
  const previewId = Number(Array.isArray(raw) ? raw[0] : raw) || 0;

  let data: HomeDecorateResponse | null = null;
  let error = '';
  try {
    data = await getHomeDecorate({ previewId });
  } catch (reason) {
    error = reason instanceof Error ? reason.message : '装修数据加载失败';
  }

  // 「模板不存在」跳 404；其余错误吞掉保持页面可用（对齐旧版 handleDecorateLoadError）
  if (error === '模板不存在') {
    notFound();
  }

  // 原版 decorate/isNewHome.ts：homeStyleVersion=new 或模块 type 含 kebab → 新版注册表；
  // =old、全是旧模块 type、或装修数据为空/接口失败 → 回退旧版硬编码首页。
  const declaredStyle = data?.pageModule?.homeStyleVersion;
  const hasKebabModule = (data?.moduleList || []).some((item) => String(item?.type || '').includes('-'));
  const useLegacy = Boolean(error) || declaredStyle === 'old' || (!declaredStyle && !hasKebabModule) || !data?.moduleList?.length;

  return (
    <>
      {previewId > 0 ? (
        <div className="home-preview-banner">
          <div className="pc-container">预览：&emsp;<span>{t('PC端')}</span></div>
        </div>
      ) : null}
      <PcHeader config={data?.pageModule?.pcHeader} />
      <main className="pc-home" style={pageBackground(data?.pageModule)}>
        <div className="pc-container">
          {error ? <div className="legacy-home__notice">装修数据暂不可用：{error}，已切换为默认首页。</div> : null}
          {useLegacy ? <LegacyHome /> : <DecorateRenderer modules={data?.moduleList || []} />}
        </div>
      </main>
      <PcFooter showFriendly />
    </>
  );
}

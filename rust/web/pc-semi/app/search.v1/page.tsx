/**
 * /search.v1 经典版搜索页。
 * 源码对照：java.../view/pc/pages/search.v1/index.vue + src/search.vue
 *   - uiVersion=old → SearchLayoutClassic（已选条件回显 + 分类导航）
 *   - uiVersion=new → SearchLayoutModern（横向分类条 + 顶部翻页 + 排序条）
 * 原版入口硬编码 old，这里保留 ?ui=new 预览 Modern，两版都复用新版取数，
 * 但各自走独立的布局组件，不再退化成 /search 的同一份 DOM。
 */
import type { Metadata } from 'next';

import { getServerT } from '@/i18n/server';
import SearchPage, { dynamic as searchDynamic } from '../search/page';

export const dynamic = searchDynamic;

export async function generateMetadata(): Promise<Metadata> {
  const t = getServerT();
  return {
  title: t('商品搜索（经典版） · 万物新生'),
  robots: { index: false, follow: true },
};
}

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function SearchV1Page(props: PageProps) {
  const raw = props.searchParams?.ui;
  const ui = Array.isArray(raw) ? raw[0] : raw;
  return SearchPage({
    ...props,
    pageType: '/search.v1',
    variant: ui === 'new' ? 'modern' : 'classic',
  } as Parameters<typeof SearchPage>[0]);
}

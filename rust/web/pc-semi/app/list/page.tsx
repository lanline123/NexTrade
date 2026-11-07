/**
 * /list 兼容路由。
 * 源码对照：java.../view/pc/pages/list/index.vue —— `<search pageType="/list" />`。
 * 新版与 /search 共用同一套取数与筛选逻辑，但通过 pageType 让所有筛选/排序/分页
 * 链接写回 /list，不再像旧实现那样统一跳回 /search。
 */
import SearchPage, { dynamic as searchDynamic, generateMetadata as searchMetadata } from '../search/page';

export const dynamic = searchDynamic;
export const generateMetadata = searchMetadata;

interface PageProps {
  searchParams?: { [key: string]: string | string[] | undefined };
}

export default async function ListPage(props: PageProps) {
  return SearchPage({ ...props, pageType: '/list' } as Parameters<typeof SearchPage>[0]);
}

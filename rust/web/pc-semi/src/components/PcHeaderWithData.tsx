import PcHeader from '@/components/PcHeader';
import { getHeaderBootstrap } from '@/lib/api';
import type { PcHeaderConfig } from '@/decorate/types';

/**
 * PC 头部服务端包装：
 * 在服务端并发预取 Logo / 语言 / 货币等公共数据，作为 props 注入客户端头部组件，
 * 让 Logo、语言、我的、购物车在首屏 HTML 中同时就绪，而不是等 hydration 后各自请求。
 */
export default async function PcHeaderWithData(props: {
  config?: PcHeaderConfig | null;
  isWhite?: boolean;
  page?: string;
  shopSearch?: boolean;
}) {
  const bootstrap = await getHeaderBootstrap();
  return <PcHeader {...props} bootstrap={bootstrap} />;
}
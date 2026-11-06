import Link from 'next/link';
import PcFooter from '@/components/PcFooter';

/**
 * 兜底路由
 * 源码对照：pages/[...slug].vue —— 未匹配路由渲染 404；
 * 商品下架（?reason=offline）复用同一视图但改用下架文案。
 */
export default function LegacyCatchAll({ searchParams }: { searchParams?: { [key: string]: string | string[] | undefined } }) {
  const raw = searchParams?.reason;
  const reason = Array.isArray(raw) ? raw[0] : raw;
  const offline = reason === 'offline';

  return (
    <>
      <main className="pc-error-page">
        <div className="pc-error-card">
          <div className="pc-error-code">{offline ? '下架' : '404'}</div>
          <h1>{offline ? '商品已下架' : '404 - 页面未找到'}</h1>
          <p>{offline ? '抱歉商品已下架，去查看其他商品' : '抱歉，您所请求的页面不存在。'}</p>
          <div className="pc-error-actions">
            <Link href="/" className="is-primary">返回首页</Link>
            {offline ? <Link href="/search">去查看其他商品</Link> : null}
          </div>
        </div>
      </main>
      <PcFooter />
    </>
  );
}

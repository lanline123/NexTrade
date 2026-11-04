import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="pc-error-page">
      <div className="pc-error-card">
        <div className="pc-error-code">404</div>
        <h1>页面不存在</h1>
        <p>你访问的页面可能已删除、改名或暂时不可用。</p>
        <div className="pc-error-actions">
          <Link href="/" className="is-primary">返回首页</Link>
          <Link href="/search">去逛逛</Link>
        </div>
      </div>
    </main>
  );
}

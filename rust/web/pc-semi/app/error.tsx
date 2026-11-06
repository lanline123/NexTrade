'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="pc-error-page">
      <div className="pc-error-card" role="alert" aria-live="assertive">
        <div className="pc-error-code" aria-hidden="true">500</div>
        <h1>页面加载失败</h1>
        <p>服务暂时不可用，请稍后重试。</p>
        <div className="pc-error-actions">
          <button type="button" className="is-primary" onClick={() => reset()}>重新加载</button>
          <Link href="/">返回首页</Link>
        </div>
        {error.digest ? (
          <p style={{ marginTop: 12, color: '#8f959e', fontSize: 12 }}>错误编号：{error.digest}</p>
        ) : null}
      </div>
    </main>
  );
}

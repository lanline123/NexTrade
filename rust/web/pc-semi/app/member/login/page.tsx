import type { Metadata } from 'next';
import PcFooter from '@/components/PcFooter';
import LoginClient from '@/components/LoginClient';
import { getHeaderBootstrap, getPcLoginDecorate } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '登录 · 万物新生' };

/** /login 的历史别名：与 app/login/page.tsx 同一套毛玻璃卡片构图 */
export default async function MemberLoginPage() {
  const [decorate, bootstrap] = await Promise.all([
    getPcLoginDecorate().catch(() => null),
    getHeaderBootstrap().catch(() => null),
  ]);
  const base = bootstrap?.base || null;
  return (
    <>
      <LoginClient
        shopName={String(base?.shopName || base?.shopTitle || '万物新生')}
        shopLogo={String(base?.shopLogo || '')}
        shopRegClosed={Number(base?.shopRegClosed ?? 0)}
        decorate={decorate}
      />
      <PcFooter />
    </>
  );
}

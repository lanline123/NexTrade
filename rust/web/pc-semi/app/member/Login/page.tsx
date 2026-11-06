import type { Metadata } from 'next';
import PcHeader from '@/components/PcHeader';
import PcFooter from '@/components/PcFooter';
import LoginClient from '@/components/LoginClient';
import { getPcHeader, getPcLoginDecorate } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '登录 · 万物新生' };

/** 源码 pages/member/Login.vue：按主页装修 pcLogin 渲染经典/现代登录 */
export default async function MemberLoginPage() {
  const [header, decorate] = await Promise.all([
    getPcHeader().catch(() => null),
    getPcLoginDecorate().catch(() => null),
  ]);
  return (
    <>
      <PcHeader config={header as any} />
      <LoginClient decorate={decorate} />
      <PcFooter />
    </>
  );
}

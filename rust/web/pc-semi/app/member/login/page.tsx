import type { Metadata } from 'next';
import PcLoginHeader from '@/components/PcLoginHeader';
import PcFooter from '@/components/PcFooter';
import LoginClient from '@/components/LoginClient';
import { getPcLoginDecorate } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '登录 · 万物新生' };

/** 源码 pages/member/Login.vue：按主页装修 pcLogin 渲染经典/现代登录 */
export default async function MemberLoginPage() {
  const decorate = await getPcLoginDecorate().catch(() => null);
  return (
    <>
      <PcLoginHeader decorate={decorate} type="login" />
      <LoginClient decorate={decorate} />
      <PcFooter />
    </>
  );
}

import type { Metadata } from 'next';
import PcLoginHeader from '@/components/PcLoginHeader';
import PcFooter from '@/components/PcFooter';
import LoginClient from '@/components/LoginClient';
import { getPcLoginDecorate } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '登录 · 万物新生' };

/**
 * 登录页
 * 源码对照：pages/member/Login.vue + composables/usePcLoginDecorate.ts
 * 装修配置 home/home/pcLogin 决定 loginMode（1 经典 / 2 现代）与背景图/背景色
 */
export default async function LoginPage() {
  const decorate = await getPcLoginDecorate().catch(() => null);
  return (
    <>
      <PcLoginHeader decorate={decorate} type="login" />
      <LoginClient decorate={decorate} />
      <PcFooter />
    </>
  );
}

import type { Metadata } from 'next';
import PcLoginHeader from '@/components/PcLoginHeader';
import PcFooter from '@/components/PcFooter';
import RegisterClient from '@/components/RegisterClient';
import { getPcLoginDecorate } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '注册 · 万物新生' };

/**
 * PC 注册页
 * 源码对照：view/pc/pages/member/Register.vue —— 顶部使用 LoginHeader（logo + 欢迎语 + 去登录互切）
 */
export default async function RegisterPage() {
  const decorate = await getPcLoginDecorate().catch(() => null);
  return (
    <>
      <PcLoginHeader decorate={decorate} type="register" />
      <RegisterClient />
      <PcFooter />
    </>
  );
}

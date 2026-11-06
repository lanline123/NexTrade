'use client';

/**
 * PC 登录（兼容旧路由导出）
 * 源码对照：pages/member/Login.vue
 */
import LoginClient from '@/components/LoginClient';
import type { PcLoginDecorate } from '@/lib/api';

export default function MemberLoginClient({ decorate }: { decorate: PcLoginDecorate | null }) {
  return <LoginClient decorate={decorate} />;
}

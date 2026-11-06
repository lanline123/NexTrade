'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * 会员中心登录兜底守卫，对应旧版 Nuxt middleware: auth。
 *
 * 服务端拦截已由 middleware.ts（cookie 校验）完成，本组件不再渲染任何加载层：
 * - 挂载时若 localStorage 无 token 而 cookie 有（登录 7 天内换浏览器场景反向兜底），把 cookie 同步回 localStorage；
 * - 两者都无（middleware 漏网）才跳登录页。
 * 页面内容始终直出，不再出现「正在校验登录状态...」闪烁。
 */
export default function MemberAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let cookieToken: string | undefined;
    document.cookie.split(';').some((part) => {
      const [name, ...rest] = part.trim().split('=');
      if (name === 'accessToken') {
        cookieToken = decodeURIComponent(rest.join('='));
        return true;
      }
      return false;
    });
    const localToken = localStorage.getItem('accessToken');
    if (!localToken && cookieToken) {
      localStorage.setItem('accessToken', cookieToken);
      return;
    }
    if (!localToken && !cookieToken) {
      const redirect = `${pathname || '/member'}${window.location.search || ''}`;
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
  }, [pathname, router]);

  return <>{children}</>;
}

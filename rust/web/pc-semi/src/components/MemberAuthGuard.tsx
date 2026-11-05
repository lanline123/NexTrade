'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * 会员中心登录守卫，对应旧版 Nuxt middleware: auth。
 * 旧版通过服务端中间件拦截，新版 token 存在 localStorage，只能在客户端校验。
 */
export default function MemberAuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      const redirect = `${pathname || '/member'}${window.location.search || ''}`;
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
      setChecked(true);
      return;
    }
    setAuthenticated(true);
    setChecked(true);
  }, [pathname, router]);

  if (!checked || !authenticated) {
    return <div className="pc-member-page"><div className="pc-container"><div className="member-auth-loading">正在校验登录状态...</div></div></div>;
  }

  return <>{children}</>;
}

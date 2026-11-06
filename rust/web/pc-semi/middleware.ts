import { NextRequest, NextResponse } from 'next/server';

/**
 * 会员中心服务端登录守卫（对应旧版 Nuxt middleware: auth）。
 *
 * 背景：token 登录后同时写入 localStorage 与 accessToken cookie（LoginClient / oauth callback）。
 * 以前 /member/* 只在客户端守卫（MemberAuthGuard），每次刷新先渲染「正在校验登录状态...」再出内容。
 * 现在改在服务端读 cookie：无 token 或 JWT 已过期 → 307 到 /login?redirect=<原路径+query>；
 * 有效 → 直接 SSR 页面内容，无闪烁。
 *
 * 注意：cookie 缺失但 localStorage 仍有 token 的窗口（例如登录超过 7 天）会被要求重新登录，
 * 由客户端 MemberAuthGuard 负责把 cookie 同步回 localStorage，尽量减少该窗口。
 */

function isExpiredToken(token: string): boolean {
  try {
    const payloadPart = token.split('.')[1] ?? '';
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
    const payload = JSON.parse(atob(normalized)) as { exp?: number };
    if (typeof payload.exp === 'number') return payload.exp * 1000 < Date.now();
    return false;
  } catch {
    // 非标准 JWT（如后端下发的非三段式 token）：不在此判断，放行由接口层兜底
    return false;
  }
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // 登录/注册页本身放行（/member/login、/member/register 是 /login、/register 的历史别名）
  if (/\/member\/(login|register)\/?$/.test(pathname)) {
    return NextResponse.next();
  }
  const token = request.cookies.get('accessToken')?.value;
  if (!token || isExpiredToken(token)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    url.searchParams.set('redirect', `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/member/:path*'],
};

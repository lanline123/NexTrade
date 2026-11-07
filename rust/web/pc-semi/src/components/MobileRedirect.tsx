'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

/**
 * 移动端浏览器自动跳转 H5（对齐旧版 view/pc app.vue handlerToMobile + isMobileBrowser）。
 *
 * - 条件：移动 UA（或微信浏览器 + 触屏）&& 后台 base 配置 autoRedirect === 1
 * - 目标：base 配置 h5Domain（缺省回落 /mobile）
 * - 商品页映射：/item/:sn → H5 pages/product/index?sn=（seo slug 取最后一段数字，对齐旧版）
 * - 防循环：目标与当前同源同路径时跳过；PC 根页不跳回自身
 * - /activity 自定义页不跳（对齐旧版 route.path !== '/activity' 分支）
 */

const MOBILE_UA_PATTERN =
  /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|phone|harmonyos|openharmony|hm os|arkweb/i;

function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = navigator.userAgent.toLowerCase();
  const isWechatBrowser = /micromessenger/.test(ua);
  const hasTouchCapability = 'ontouchstart' in window || navigator.maxTouchPoints > 1;
  return MOBILE_UA_PATTERN.test(ua) || (isWechatBrowser && hasTouchCapability);
}

function normalizePath(path: string): string {
  return path.replace(/\/+$/, '') || '/';
}

export default function MobileRedirect() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isMobileBrowser()) return;
    if (pathname === '/activity' || pathname.startsWith('/activity/')) return;
    // 装修预览不跳（对齐旧版 previewId 语义：预览在 PC 端看效果）
    if (new URLSearchParams(window.location.search).get('previewId')) return;

    const redirect = (h5Domain: string) => {
      const baseUrl = (h5Domain || `${window.location.origin}/mobile`).trim();
      let mobileUrl: URL;
      try {
        mobileUrl = new URL(baseUrl, window.location.origin);
      } catch {
        mobileUrl = new URL(`${window.location.origin}/mobile`);
      }

      const currentUrl = new URL(window.location.href);
      const currentPath = normalizePath(currentUrl.pathname);
      if (mobileUrl.origin === currentUrl.origin) {
        // 配置错误时不要把 PC 根页重定向回自身；PC 和 H5 共用域名时也避免自重定向循环
        if (normalizePath(mobileUrl.pathname) === '/') {
          mobileUrl.pathname = '/mobile';
        }
        const mobilePath = normalizePath(mobileUrl.pathname);
        if (currentPath === mobilePath || currentPath.startsWith(`${mobilePath}/`)) {
          return;
        }
      }

      // 商品详情映射：/item/<slug 或 sn> → H5 商品页 ?sn=
      const itemMatch = currentUrl.pathname.match(/\/item\/(.+)$/);
      const productSn = itemMatch?.[1];
      if (productSn) {
        const mobileBasePath = mobileUrl.pathname.replace(/\/+$/, '');
        mobileUrl.pathname = `${mobileBasePath}/pages/product/index`;
        mobileUrl.search = `?sn=${encodeURIComponent(productSn)}`;
      }

      window.location.replace(mobileUrl.toString());
    };

    fetch('/api/common/config/base')
      .then((response) => response.json())
      .then((json) => {
        const config = json?.data || {};
        if (Number(config.autoRedirect) !== 1) return;
        redirect(String(config.h5Domain || ''));
      })
      .catch(() => undefined);
  }, [pathname]);

  return null;
}

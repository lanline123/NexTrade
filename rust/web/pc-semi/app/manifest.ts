import type { MetadataRoute } from 'next';
import { loadTheme } from '@/lib/theme-server';

const SITE_NAME = '万物新生';
const SITE_DESCRIPTION = '退役动力电池循环利用产业服务平台，安全合规、高效协同、绿色循环。';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // 与 app/layout.tsx 的 generateViewport 同一来源：后台「装修 → 主题风格」的 --general
  const { primary } = await loadTheme();
  return {
    id: '/',
    name: `${SITE_NAME} · 退役动力电池循环利用产业服务平台`,
    short_name: SITE_NAME,
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#ffffff',
    // 跟随后台主题色，与 app/layout.tsx 的 generateViewport 保持一致
    theme_color: primary,
    lang: 'zh-CN',
    dir: 'ltr',
    categories: ['shopping', 'business'],
    icons: [
      {
        src: '/icon.png',
        sizes: '500x500',
        type: 'image/png',
        purpose: 'any',
      },
    ],
    // 快捷入口：提升已安装 PWA 的可用性（不改变未安装用户的浏览体验）
    shortcuts: [
      { name: '站内搜索', url: '/search' },
      { name: '领券中心', url: '/coupon/list' },
      { name: '会员中心', url: '/member' },
    ],
  };
}

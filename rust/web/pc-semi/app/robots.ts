import type { MetadataRoute } from 'next';

const BASE = (process.env.PC_SITE_URL || 'https://battery.recy.cc').replace(/\/$/, '');

/** `Host:`（Yandex 等使用）只接受 host[:port]，不接受协议前缀。 */
const HOST = (() => {
  try {
    return new URL(BASE).host;
  } catch {
    return 'battery.recy.cc';
  }
})();

/**
 * 不参与索引的路径：
 * - `/api`、`/adminapi`：Next rewrite 到后端的代理路径，绝不能被抓取；
 * - `/member`、`/order`、`/cart`、`/chat`、`/login`、`/register`：私有/交易/账户操作页；
 * - `/install`、`/preview`、`/oauth`、`/pcmobile`：安装向导、装修内部预览、OAuth 回调、移动端回归页；
 * - `/join/intro`、`/joining/groupbyinvited`：邀请/内部流程页（旧版即已屏蔽，保留）；
 * - `/search?*`：站内搜索结果页（低价值、易重复）；`/search` 落地页本身仍允许抓取。
 */
const DISALLOW_PATHS = [
  '/api/',
  '/adminapi/',
  '/member',
  '/order',
  '/cart',
  '/chat',
  '/login',
  '/register',
  '/install',
  '/preview',
  '/oauth',
  '/pcmobile',
  '/join/intro',
  '/joining/groupbyinvited',
  '/search?',
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: DISALLOW_PATHS,
      },
    ],
    sitemap: `${BASE}/sitemap.xml`,
    host: HOST,
  };
}

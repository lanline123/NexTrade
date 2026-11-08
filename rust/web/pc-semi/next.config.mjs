/** @type {import('next').NextConfig} */
const apiBase = (process.env.PC_API_BASE || 'https://battery.recy.cc').replace(/\/$/, '');

// 并行会话同时构建会互相清理同一个 .next；允许用环境变量隔离输出目录，
// 默认仍为 .next，不改变既有部署行为。
const distDir = process.env.PC_NEXT_DIST_DIR || '.next';

const nextConfig = {
  distDir,
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },

  /**
   * 旧版（Nuxt3）URL → 新版路由 的永久重定向。
   *
   * 背景：2026-11-07 起 PC 路由目录统一为全小写（Next.js App Router 文件路由大小写敏感）。
   * 旧站（vue-router 默认大小写不敏感）对外暴露的驼峰 URL 需要 301 到新小写路径，
   * 否则搜索引擎已收录的旧链接会 404。旧驼峰 URL 一律 permanent: true（308）。
   */
  /**
   * 旧版（Nuxt3）URL → 新版路由 的永久重定向里「目标不只是小写变化」的那几条。
   *
   * 重要：Next 的 redirects 规则匹配是**大小写不敏感**的。把 `/member/coupon/List → /member/coupon/list`
   * 这种“只改大小写”的规则写在这里，会连已经正确的小写地址一起命中，把页面 308 到它自己，
   * 浏览器报 ERR_TOO_MANY_REDIRECTS（2026-11 实测：/member/coupon/list、/article/news/list 打不开）。
   * 所以大小写归一化统一交给了 middleware.ts（用 JS 比较，只有真含大写才跳）。
   * 这里只保留目标路径确实不同的规则。
   */
  async redirects() {
    return [
      // 旧驼峰路径 → 语义不同的新地址
      { source: '/member/order/Info', destination: '/member/order/detail', permanent: true },
      { source: '/member/orderInfo', destination: '/member/order/list', permanent: true },
      { source: '/search.v1', destination: '/search', permanent: true },
      { source: '/item/:id', destination: '/product/:id', permanent: true },
      // 旧 order 独立支付页 → 统一支付外壳
      { source: '/order/alipay', destination: '/order/pay', permanent: true },
      { source: '/order/wechat', destination: '/order/pay', permanent: true },
      { source: '/order/paypal', destination: '/order/pay', permanent: true },
      { source: '/order/stripe', destination: '/order/pay', permanent: true },
      { source: '/order/huifu', destination: '/order/pay', permanent: true },
      { source: '/order/lakala', destination: '/order/pay', permanent: true },
      { source: '/order/yeepay', destination: '/order/pay', permanent: true },
      { source: '/order/yunpay', destination: '/order/pay', permanent: true },
      { source: '/order/yabanpay', destination: '/order/pay', permanent: true },
    ];
  },

  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiBase}/api/:path*` },
      { source: '/adminapi/:path*', destination: `${apiBase}/adminapi/:path*` },
      { source: '/static/:path*', destination: `${apiBase}/static/:path*` },
      // 店内搜索：旧路径 /shop/search/{id} → /search 并限定 shopId（原请求 query 自动透传）
      { source: '/shop/search/:id', destination: '/search?shopId=:id&tab=goods' },
      { source: '/category/:slug', destination: '/category' },
      // 旧 return/List 是「可申请售后订单列表」（新版 /member/return/list 已恢复该语义），
      // 旧 return/Log 是售后进度记录；两者不再合并到 /member/aftersales。
    ];
  },
};

export default nextConfig;

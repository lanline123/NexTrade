/** @type {import('next').NextConfig} */
const apiBase = (process.env.PC_API_BASE || 'https://battery.recy.cc').replace(/\/$/, '');

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  output: 'standalone',
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: '**' },
    ],
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${apiBase}/api/:path*` },
      { source: '/adminapi/:path*', destination: `${apiBase}/adminapi/:path*` },
      { source: '/static/:path*', destination: `${apiBase}/static/:path*` },
      // 旧 Nuxt 文件路由兼容：大小写与旧页面文件名映射到新版路由
      { source: '/seckill/List', destination: '/seckill' },
      { source: '/shop/List', destination: '/shop' },
      { source: '/search.v1', destination: '/search' },
      { source: '/item/:id', destination: '/product/:id' },
      { source: '/member/point/List', destination: '/member/points' },
      { source: '/member/browsingHistory/List', destination: '/member/browsingHistory' },
      { source: '/member/order/List', destination: '/member/order/list' },
      { source: '/member/order/Info', destination: '/member/order/detail' },
      { source: '/member/orderInfo', destination: '/member/order/list' },
    ];
  },
};

export default nextConfig;

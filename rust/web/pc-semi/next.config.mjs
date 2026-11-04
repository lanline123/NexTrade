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
      { source: '/exchange/List', destination: '/exchange' },
      { source: '/article/news/List', destination: '/article/news/list' },
      { source: '/article/news/Info', destination: '/article/news/list' },
      { source: '/order/alipay', destination: '/order/pay' },
      { source: '/order/wechat', destination: '/order/pay' },
      { source: '/order/paypal', destination: '/order/pay' },
      { source: '/order/stripe', destination: '/order/pay' },
      { source: '/order/huifu', destination: '/order/pay' },
      { source: '/order/lakala', destination: '/order/pay' },
      { source: '/order/yeepay', destination: '/order/pay' },
      { source: '/order/yunpay', destination: '/order/pay' },
      { source: '/order/yabanpay', destination: '/order/pay' },
      { source: '/shop/List', destination: '/shop' },
      { source: '/search.v1', destination: '/search' },
      { source: '/item/:id', destination: '/product/:id' },
      { source: '/member/point/List', destination: '/member/points' },
      { source: '/member/browsingHistory/List', destination: '/member/browsingHistory' },
      { source: '/member/order/List', destination: '/member/order/list' },
      { source: '/member/order/Info', destination: '/member/order/detail' },
      { source: '/member/orderInfo', destination: '/member/order/list' },
      { source: '/member/return/List', destination: '/member/aftersales' },
      { source: '/member/return/Info', destination: '/member/aftersales/detail' },
      { source: '/member/return/Log', destination: '/member/aftersales' },
      { source: '/member/return/LogInfo', destination: '/member/aftersales/detail' },
      { source: '/member/account/Deposit', destination: '/member/balance' },
      { source: '/member/account/Detail', destination: '/member/account/detail' },
      { source: '/member/account/Log', destination: '/member/account/log' },
    ];
  },
};

export default nextConfig;



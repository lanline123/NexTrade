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
      { source: '/member/order/claimInfo', destination: '/member/order/claimInfo' },
      { source: '/member/Login', destination: '/login' },
      { source: '/member/Register', destination: '/register' },
      { source: '/member/BindMobilePhone', destination: '/member/security' },
      { source: '/article/issue/Index', destination: '/article/issue' },
      { source: '/shop/search/:id', destination: '/search' },
      { source: '/category/:slug', destination: '/category' },
      { source: '/member/orderInfo', destination: '/member/order/list' },
      { source: '/member/comment/Info', destination: '/member/comment/info' },
      { source: '/member/return/List', destination: '/member/aftersales' },
      { source: '/member/return/Log', destination: '/member/aftersales' },
      { source: '/member/account/Deposit', destination: '/member/account/deposit' },
      { source: '/member/account/Detail', destination: '/member/account/detail' },
      { source: '/member/account/Log', destination: '/member/account/log' },
      { source: '/member/account/CardManagement', destination: '/member/account/cardManagement' },
      { source: '/member/account/Raplytocard', destination: '/member/account/raplytocard' },
      { source: '/member/userInvoice/Info', destination: '/member/userInvoice/info' },
    ];
  },
};

export default nextConfig;



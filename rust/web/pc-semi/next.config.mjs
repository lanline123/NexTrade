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
  async redirects() {
    return [
      // ---- 旧驼峰会员路径 → 新小写路径 ----
      { source: '/member/browsingHistory', destination: '/member/browsinghistory', permanent: true },
      { source: '/member/browsingHistory/List', destination: '/member/browsinghistory/list', permanent: true },
      { source: '/member/collectProduct', destination: '/member/collectproduct', permanent: true },
      { source: '/member/collectProduct/List', destination: '/member/collectproduct/list', permanent: true },
      { source: '/member/collectShop', destination: '/member/collectshop', permanent: true },
      { source: '/member/collectShop/List', destination: '/member/collectshop/list', permanent: true },
      { source: '/member/giftCard', destination: '/member/giftcard', permanent: true },
      { source: '/member/giftCard/exchange', destination: '/member/giftcard/exchange', permanent: true },
      { source: '/member/orderInvoice', destination: '/member/orderinvoice', permanent: true },
      { source: '/member/orderInvoice/List', destination: '/member/orderinvoice/list', permanent: true },
      { source: '/member/orderInvoice/Info', destination: '/member/orderinvoice/info', permanent: true },
      { source: '/member/orderInvoice/detail', destination: '/member/orderinvoice/detail', permanent: true },
      { source: '/member/userInvoice', destination: '/member/userinvoice', permanent: true },
      { source: '/member/userInvoice/Info', destination: '/member/userinvoice/info', permanent: true },
      { source: '/member/userInvoice/confirmInfo', destination: '/member/userinvoice/confirminfo', permanent: true },
      { source: '/member/userMessage', destination: '/member/usermessage', permanent: true },
      { source: '/member/userMessage/List', destination: '/member/usermessage/list', permanent: true },
      { source: '/member/userCertification', destination: '/member/usercertification', permanent: true },
      { source: '/member/userCertification/Info', destination: '/member/usercertification/info', permanent: true },
      { source: '/member/termPay', destination: '/member/termpay', permanent: true },
      { source: '/member/termPay/list', destination: '/member/termpay/list', permanent: true },
      { source: '/member/order/claimInfo', destination: '/member/order/claiminfo', permanent: true },
      { source: '/member/return/logInfo', destination: '/member/return/loginfo', permanent: true },
      { source: '/member/security/dialogInfo', destination: '/member/security/dialoginfo', permanent: true },
      { source: '/member/account/cardManagement', destination: '/member/account/cardmanagement', permanent: true },
      { source: '/member/address/editRegion', destination: '/member/address/editregion', permanent: true },
      { source: '/member/bindMobilePhone', destination: '/member/bindmobilephone', permanent: true },
      { source: '/member/feedback/askList', destination: '/member/feedback/asklist', permanent: true },
      { source: '/giftCard/transfer/:id', destination: '/giftcard/transfer/:id', permanent: true },
      { source: '/join/joinHeader', destination: '/join/joinheader', permanent: true },
      { source: '/joining/groupByInvited', destination: '/joining/groupbyinvited', permanent: true },
      { source: '/shopCategory/:id', destination: '/shopcategory/:id', permanent: true },
      { source: '/pcMobile', destination: '/pcmobile', permanent: true },

      // ---- 旧 Nuxt 文件路由（文件名大写）→ 新路由 ----
      { source: '/seckill/List', destination: '/seckill', permanent: true },
      { source: '/exchange/List', destination: '/exchange', permanent: true },
      { source: '/article/news/List', destination: '/article/news/list', permanent: true },
      { source: '/article/news/Info', destination: '/article/news/list', permanent: true },
      { source: '/article/issue/Index', destination: '/article/issue', permanent: true },
      { source: '/member/order/List', destination: '/member/order/list', permanent: true },
      { source: '/member/order/Info', destination: '/member/order/detail', permanent: true },
      { source: '/member/point/List', destination: '/member/points', permanent: true },
      { source: '/member/pin/List', destination: '/member/group', permanent: true },
      { source: '/member/pin/Group', destination: '/member/group/info', permanent: true },
      { source: '/member/comment/Info', destination: '/member/comment/info', permanent: true },
      { source: '/member/comment/List', destination: '/member/comment/list', permanent: true },
      { source: '/member/group/List', destination: '/member/group/list', permanent: true },
      { source: '/member/group/Info', destination: '/member/group/info', permanent: true },
      { source: '/member/inquiry/List', destination: '/member/inquiry/list', permanent: true },
      { source: '/member/inquiry/Info', destination: '/member/inquiry/info', permanent: true },
      { source: '/member/feedback/Info', destination: '/member/feedback/info', permanent: true },
      { source: '/member/feedback/List', destination: '/member/feedback/list', permanent: true },
      { source: '/member/profile/Info', destination: '/member/profile/info', permanent: true },
      { source: '/member/security/Info', destination: '/member/security/info', permanent: true },
      { source: '/member/coupon/List', destination: '/member/coupon/list', permanent: true },
      { source: '/member/point/List', destination: '/member/points', permanent: true },
      { source: '/member/joining/List', destination: '/member/joining/list', permanent: true },
      { source: '/member/account/Deposit', destination: '/member/account/deposit', permanent: true },
      { source: '/member/account/Detail', destination: '/member/account/detail', permanent: true },
      { source: '/member/account/Log', destination: '/member/account/log', permanent: true },
      { source: '/member/account/Raplytocard', destination: '/member/account/raplytocard', permanent: true },
      { source: '/member/Login', destination: '/login', permanent: true },
      { source: '/member/Register', destination: '/register', permanent: true },
      { source: '/member/orderInfo', destination: '/member/order/list', permanent: true },
      { source: '/shop/List', destination: '/shop', permanent: true },
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

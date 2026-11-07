/**
 * /exchange/list 兼容路由。
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/exchange/List.vue（积分换购列表）。
 * 新版列表实现在 /exchange（app/exchange/page.tsx）。此静态路由优先于 /exchange/[id]，
 * 避免 "list" 被当成兑换 ID 后 notFound() 返回 404。
 */
export { default, generateMetadata, dynamic } from '../page';

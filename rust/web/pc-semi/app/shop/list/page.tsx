/**
 * /shop/list 兼容路由。
 * 源码对照：java-b2b2c-overseas-v5.8.61/view/pc/pages/shop/List.vue（店铺街）。
 * 新版店铺街实现在 /shop（app/shop/page.tsx），原版站内搜索
 * components/common/components/DefSearchNew.vue 与 sitemap 都指向 /shop/list，
 * 这里用静态路由覆盖 /shop/[id] 的动态匹配，避免 "list" 被当成 shopId=0。
 */
export { default, generateMetadata, dynamic } from '../page';

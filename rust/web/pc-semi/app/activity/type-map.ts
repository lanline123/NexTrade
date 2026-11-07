/**
 * 活动/首页装修模块 type → DecorateRenderer 注册表 key。
 * 放在非页面模块：Next App Router 的 page.tsx 只允许导出 fixed 字段，
 * 额外 export 会让 .next/types 的 checkFields 校验失败。
 */
export const TYPE_MAP: Record<string, string> = {
  pcImageAd: 'pc-image-ad',
  pcImageSquareAd: 'pc-image-square-ad',
  pcImageHotarea: 'pc-image-hotarea',
  pcProduct: 'pc-product',
  pcWhiteLine: 'pc-divider',
  pcWhiteBlank: 'pc-spacer',
  pcImageNav: 'pc-image-nav',
  pcTitleAd: 'pc-title-ad',
  pcNotice: 'pc-notice',
  pcCoupon: 'pc-home-coupon',
  pcSeckill: 'pc-home-seckill',
  pcGroupon: 'pc-home-groupon',
  // 原版 activity/pcProductGrouping 与首页装修老 type 的映射（registry 已注册）
  pcProductGrouping: 'pc-product-group',
  pcProductGroup: 'pc-product-group',
  pcGroupBanner: 'pc-group-banner',
  pcHomeQuickNav: 'pc-home-quick-nav',
  pcCategoryNav: 'pc-category-nav',
  pcCategoryNav3: 'pc-category-nav3',
  pcHomeHero: 'pc-home-hero',
  pcRecommendProduct: 'pc-recommend-product',
  pcBanner2: 'pc-banner2',
};

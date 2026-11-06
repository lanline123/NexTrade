/**
 * 商品详情页 Composables 统一导出
 *
 * @description 用于商品详情页的组合式函数集合（自 uniapp pages/product/composables 移植）
 */

// 商品详情数据获取和管理
export { useProductDetail, type UseProductDetailOptions } from "./useProductDetail";

// 商品类型判断逻辑
export { useProductType, type UseProductTypeOptions, type UseProductTypeReturn } from "./useProductType";

// 商品操作逻辑
export { useProductAction, type UseProductActionOptions, type UseProductActionReturn, type SpecificationPopupInstance } from "./useProductAction";

// 商品收藏逻辑
export { useProductCollect, type UseProductCollectReturn } from "./useProductCollect";

// 商品详情风格决策（A1 / A2 / A3 三风格切换入口）
export { useProductStyle, type ProductStyle, type UseProductStyleOptions, type UseProductStyleReturn } from "./useProductStyle";

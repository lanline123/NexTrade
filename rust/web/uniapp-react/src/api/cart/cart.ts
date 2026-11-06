import { applyCartSaleState } from "@/utils/productSale";
import request from "@/utils/request";
import type { updateCartItemDataParams, updateCartCheckParams, removeCartItemDataParams, CartResponse } from "@/types/cart/cart";

/**
 * @description 获取购物车列表
 * @param params 可选，包含门店ID等筛选参数（O2O场景按门店分购物车）
 * @returns 购物车商品列表，按店铺分组
 * - noSkipLogin: 未登录时不跳转登录页，返回空购物车
 */
export const getCart = (params?: object) => {
    return request<CartResponse>({
        url: "cart/cart/list",
        method: "get",
        params,
        noSkipLogin: true
    }).then(applyCartSaleState);
};

/**
 * @description 更新购物车商品数量/规格
 * @param data 包含购物车项ID、新数量、SKU等
 * @returns 更新后的购物车状态
 */
export const updateCartItemData = (data: updateCartItemDataParams) => {
    return request({
        url: "cart/cart/updateItem",
        method: "post",
        data
    });
};

/**
 * @description 更新购物车商品选中状态
 * @param data 包含购物车项ID数组及选中状态
 * @returns 更新后的购物车状态
 */
export const updateCartCheck = (data: updateCartCheckParams) => {
    return request({
        url: "cart/cart/updateCheck",
        method: "post",
        data
    });
};

/**
 * @description 清空购物车
 * @param shopId 可选，门店ID；传入时仅清空该门店购物车
 * @returns 操作结果
 */
export const clearCart = (shopId?: number) => {
    let url = "cart/cart/clear";

    if (shopId) {
        url += `?shopId=${shopId}`;
    }

    return request({
        url,
        method: "post"
    });
};

/**
 * @description 删除购物车商品
 * @param data 包含待删除的购物车项ID数组
 * @returns 删除后的购物车状态
 */
export const removeCartItemData = (data: removeCartItemDataParams) => {
    return request({
        url: "cart/cart/removeItem",
        method: "post",
        data
    });
};

/**
 * @description 获取购物车商品数量（用于角标显示）
 * @returns 购物车商品总数
 * - noSkipLogin: 未登录时返回0，不跳转登录页
 */
export const asyncGetCartCount = () => {
    return request<any>({
        url: "cart/cart/getCount",
        method: "get",
        noSkipLogin: true
    });
};

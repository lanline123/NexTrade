import request from "@/utils/request";
import type { ShopDetailResponse, ShopCategoryResponse, shopListResponse, ShopGroupDetailResponse } from "@/types/shop/shop";

/**
 * @description 获取店铺详情
 * @param id 店铺ID
 * @returns 店铺详细信息
 */
export const getShopDetail = (id: number) => {
    return request<ShopDetailResponse>({
        url: `shop/shop/detail?shopId=${id}`,
        method: "get"
    });
};

/**
 * @description 收藏/取消收藏店铺
 * @param data 包含店铺ID
 * @returns 操作结果
 */
export const shopCollection = (data: object) => {
    return request({
        url: `shop/shop/collect`,
        method: "post",
        data
    });
};

/**
 * @description 获取店铺首页装修数据
 * @param id 店铺ID
 * @param previewId 装修预览 ID（后台预览态透传）
 * @returns 店铺首页装修配置
 */
export const getShopDecorate = (id: number, previewId?: number | undefined) => {
    return request<any>({
        url: `shop/shop/decorate?shopId=${id}`,
        method: "get",
        params: {
            previewId
        }
    });
};

/**
 * @description 获取店铺商品分类树
 * @param id 店铺ID
 * @returns 分类树结构
 */
export const getShopCategory = (id: number) => {
    return request<ShopCategoryResponse>({
        url: `shop/category/tree?shopId=${id}`,
        method: "get"
    });
};

/**
 * @description 获取店铺列表
 * @param params 筛选条件
 * @returns 店铺列表
 */
export const getShopList = (params: object) => {
    return request<shopListResponse>({
        url: "shop/shop/list",
        method: "get",
        params
    });
};

/**
 * @description 获取分组公开信息
 * @param groupId 分组 ID
 * @param shopType 1 店铺，2 门店
 * @returns 分组 id、类型与名称
 */
export const getShopGroupDetail = (groupId: number, shopType: number) => {
    return request<ShopGroupDetailResponse>({
        url: "shop/shop/groupDetail",
        method: "get",
        params: { groupId, shopType }
    });
};

import request from "@/utils/request";
import type { CollectProductResponse, CollectProductFilterParams } from "@/types/user/collectProduct";

/**
 * @description 获取收藏商品列表
 * @param params 筛选条件
 * @returns 收藏商品列表
 */
export const getCollectProductList = (params?: CollectProductFilterParams) => {
    return request<CollectProductResponse>({
        url: "user/collectProduct/list",
        method: "get",
        params
    });
};

/**
 * @description 取消收藏商品
 * @param data 包含商品ID
 * @returns 操作结果
 */
export const delCollectProduct = (data: object) => {
    return request({
        url: "user/collectProduct/cancel",
        method: "post",
        data
    });
};

import request from "@/utils/request";
import type { collectionShopResponse } from "@/types/user/collectionShop";

/**
 * @description 获取用户收藏店铺列表
 * @param params 筛选条件
 * @returns 收藏店铺列表
 */
export const getCollectionShop = (params: object) => {
    return request<collectionShopResponse>({
        url: "user/user/collectionShop",
        method: "get",
        params
    });
};

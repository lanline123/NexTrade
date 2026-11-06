import request from "@/utils/request";
import type { HistoryProductResponse } from "@/types/user/historyProduct";

/**
 * @description 获取用户浏览历史商品列表
 * @returns 浏览历史列表
 */
export const historyProductList = () => {
    return request<HistoryProductResponse>({
        url: "user/user/historyProduct",
        method: "get"
    });
};

/**
 * @description 删除浏览历史记录
 * @param ids 要删除的商品ID数组
 * @returns 操作结果
 */
export const delHistoryProduct = (ids: number[]) => {
    return request({
        url: "user/user/delHistoryProduct",
        method: "post",
        data: {
            ids
        }
    });
};

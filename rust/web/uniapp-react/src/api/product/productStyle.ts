import request from "@/utils/request";
import type { ProductActiveStyleResponse, BatchActiveStyleResponse } from "@/types/product/productStyle";

/**
 * @description 获取商品生效样式（边框 + 活动背景）
 * @param productId 商品ID
 */
export const getActiveStyle = (productId: number) => {
    return request<ProductActiveStyleResponse>({
        url: "product/productStyle/activeStyle",
        method: "get",
        params: { productId }
    });
};

/**
 * @description 批量获取商品生效样式
 * @param productIds 商品ID列表（逗号分隔）
 */
export const batchActiveStyle = (productIds: string) => {
    return request<BatchActiveStyleResponse>({
        url: "product/productStyle/batchActiveStyle",
        method: "get",
        params: { productIds }
    });
};

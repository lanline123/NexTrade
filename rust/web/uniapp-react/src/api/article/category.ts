import request from "@/utils/request";
import type { CategoryFilterState } from "@/types/article/category";
import type { ApiEnvelope } from "@/types/api";

/**
 * @description 获取帮助中心文章分类列表
 * @param params 筛选条件
 * @returns 分类列表
 */
export const getBzzxCategoryList = (params: { categorySize: number; articleSize: number }) => {
    return request<ApiEnvelope<CategoryFilterState[]>>({
        url: "article/category/indexBzzxList",
        method: "get",
        params
    });
};

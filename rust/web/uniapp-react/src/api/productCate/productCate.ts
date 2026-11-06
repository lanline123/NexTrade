import request from "@/utils/request";
import type { SearchFilterResult } from "@/types/productCate/productCate";

/**
 * @description 获取全部商品分类
 * @returns 完整分类列表
 */
export const getCategoryAll = () => {
    return request<SearchFilterResult>({
        url: "category/category/all",
        method: "get"
    });
};

/**
 * @description 获取热门分类
 * @returns 热门分类列表
 */
export const getCategoryHot = () => {
    return request<SearchFilterResult>({
        url: "category/category/hot",
        method: "get"
    });
};

/**
 * @description 获取分类树结构
 * @returns 树形分类数据
 */
export const getCategoryTree = () => {
    return request<SearchFilterResult>({
        url: "category/category/parentTree",
        method: "get"
    });
};

/**
 * @description 获取指定分类的子分类列表
 * @param params 包含父分类ID
 * @returns 子分类列表
 */
export const getCategoryList = (params: object) => {
    return request<SearchFilterResult>({
        url: "category/category/list",
        method: "get",
        params,
        cancelPrevious: true,
        requestKey: "categoryList"
    });
};

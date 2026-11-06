import request from "@/utils/request";
import type { SearchFilterResult, ProductFilterResult, ProductFilterParams, ProductListResponse } from "@/types/search/search";
import type { StoreSearchParams, StoreSearchResponse } from "@/types/search/storeSearch";

/**
 * @description 获取分类面包屑树
 * @param id 分类ID
 * @returns 从根到当前分类的路径
 */
export const getCategoryTree = (id?: number) => {
    return request<SearchFilterResult>({
        url: "category/category/parentTree",
        method: "get",
        params: { id }
    });
};

/**
 * @description 获取商品筛选项
 * @param data 搜索条件
 * @returns 品牌、属性等筛选项
 */
export const getCategoryProductFilter = (data: ProductFilterParams) => {
    return request<ProductFilterResult>({
        url: "search/search/getFilter",
        method: "post",
        data
    });
};

/**
 * @description 搜索商品列表
 * @param data 搜索条件
 * @returns 商品列表
 */
export const getCategoryProduct = (data: ProductFilterParams) => {
    return request<ProductListResponse>({
        url: "search/search/getProduct",
        method: "post",
        data
    });
};

/**
 * @description 获取店铺分类面包屑树
 * @param id 店铺分类ID
 * @returns 分类路径
 */
export const getShopCategoryTree = (id?: number) => {
    return request<any>({
        url: `shop/category/parentTree?id=${id}`,
        method: "get"
    });
};

/**
 * @description 获取ES搜索属性建议
 * @param params 搜索关键词等
 * @returns 属性筛选建议
 */
export const getSearchEsFilter = (params: object) => {
    return request<any>({
        url: "search/search/getAttributeSuggestions",
        method: "get",
        params
    });
};

/**
 * @description 门店聚合搜索
 * @param params 关键词、经纬度、门店筛选、分页
 * @returns 以门店为单位聚合的商品列表，每店最多 10 个商品
 */
export const getStoreProduct = (params: StoreSearchParams) => {
    return request<StoreSearchResponse>({
        url: "o2o/storeSearch/getStoreProduct",
        method: "get",
        params
    });
};

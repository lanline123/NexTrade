import request from "@/utils/request";
import type {
    SalesmanProductListResponse,
    SalesmanProductDetailResponse,
    OrderListResponse,
    SalesmanContentListResponse,
    MaterialCategoryResponse,
    MaterialListResponse
} from "@/types/salesman/salesman";

/**
 * @description 获取分销商品列表
 * @param params 筛选条件
 * @returns 分销商品列表
 */
export const salesmanProductList = (params: any) => {
    return request<SalesmanProductListResponse>({
        url: "salesman/product/list",
        method: "get",
        params
    });
};

/**
 * @description 获取分销商品详情
 * @param id 商品ID
 * @returns 商品详情及佣金信息
 */
export const salesmanProductDetail = (id: number) => {
    return request<SalesmanProductDetailResponse>({
        url: `salesman/product/detail?productId=${id}`,
        method: "get"
    });
};

/**
 * @description 获取分销订单列表
 * @param params 筛选条件
 * @returns 分销订单列表
 */
export const salesmanOrderList = (params: any) => {
    return request<OrderListResponse>({
        url: "salesman/order/list",
        method: "get",
        params
    });
};

/**
 * @description 获取赚钱攻略列表
 * @param params 筛选条件
 * @returns 攻略文章列表
 */
export const salesmanContentList = (params: any) => {
    return request<SalesmanContentListResponse>({
        url: "salesman/content/list",
        method: "get",
        params
    });
};

/**
 * @description 获取赚钱攻略详情
 * @param id 攻略ID
 * @returns 攻略详情
 */
export const salesmanContentDetail = (id: number) => {
    return request<any>({
        url: `salesman/content/detail?id=${id}`,
        method: "get"
    });
};

/**
 * @description 获取分销员用户信息
 * @param id 分销员ID
 * @returns 分销员信息
 */
export const salesmanUserinfo = (id: number) => {
    return request<any>({
        url: `salesman/salesman/userInfo?salesmanId=${id}`,
        method: "get"
    });
};

/**
 * @description 微商模式：接受名片邀请，一键成为该分销员的下级分销员
 * @param salesmanId 邀请人分销员ID
 */
export const acceptCardInvite = (salesmanId: number) => {
    return request<any>({
        url: `salesman/salesman/acceptCardInvite?salesmanId=${salesmanId}`,
        method: "post"
    });
};

/**
 * @description 获取推广素材分类列表
 * @returns 素材分类
 */
export const materialCategoryList = () => {
    return request<MaterialCategoryResponse>({
        url: "salesman/material/category",
        method: "get"
    });
};

/**
 * @description 获取推广素材列表
 * @param params 筛选条件
 * @returns 素材列表
 */
export const materialList = (params: any) => {
    return request<MaterialListResponse>({
        url: "salesman/material/list",
        method: "get",
        params
    });
};

/**
 * @description 获取推广素材详情
 * @param id 素材ID
 * @returns 素材详情
 */
export const materialDetail = (id: number) => {
    return request<any>({
        url: `salesman/material/detail?id=${id}`,
        method: "get"
    });
};

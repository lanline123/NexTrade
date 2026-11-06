import type { ProductDetailParams, ProductAvailabilityParams } from "@/types/product/product";
import request from "@/utils/request";
import { isO2o } from "@/utils";
import { normalizeProductQuery } from "@/utils/productQuery";
import type {
    ProductFilterResult,
    SkuResponse,
    ProductCouponList,
    CommentFilterResult,
    CommentDetailResult,
    ProductConsultationFormState,
    ProductConsultationListParams,
    ProductConsultationList,
    PromotionResponse,
    AddCartResponse,
    ProductAmountResponse,
    SkuAvailabilitysResponse
} from "@/types/product/product.d";

/**
 * @description 获取商品详情
 * @param id 商品ID或包含ID的对象
 * @returns 商品完整信息
 */
export const getProductDetail = (id: number | ProductDetailParams) => {
    let params: ProductDetailParams = {};

    if (typeof id === "object") {
        params = id;
    } else {
        params.id = id;
    }

    return request<ProductFilterResult>({
        url: "product/product/detail",
        method: "get",
        params: normalizeProductQuery(params, isO2o())
    });
};

/**
 * @description 获取商品评价统计
 * @param id 商品ID
 * @returns 评价统计信息
 */
export const getComment = (id: number) => {
    return request<CommentDetailResult>({
        url: "product/product/getComment",
        method: "get",
        params: { id }
    });
};

/**
 * @description 获取商品评价列表
 * @param id 商品ID
 * @param params 筛选条件
 * @returns 评价列表
 */
export const getCommentList = (id: number, params: object) => {
    return request<CommentFilterResult>({
        url: "product/product/getCommentList",
        method: "get",
        params: normalizeProductQuery({ id, ...params }, isO2o())
    });
};

/**
 * @description 获取商品SKU库存及价格
 * @param params 包含商品ID及已选规格
 * @returns SKU信息
 */
export const getProductSkuDetail = (params: ProductAvailabilityParams) => {
    return request<SkuResponse>({
        url: "product/product/getProductAvailability",
        method: "get",
        params: normalizeProductQuery(params, isO2o())
    });
};

/**
 * @description 添加商品到购物车
 * @param params 包含商品ID、SKU ID、数量等
 * @returns 添加结果
 */
export const addToCart = (params: AnyObject) => {
    return request<AddCartResponse>({
        url: "cart/cart/addToCart",
        method: "post",
        data: params
    });
};

/**
 * @description 获取商品咨询列表
 * @param params 包含商品ID、分页参数
 * @returns 咨询列表
 */
export const getProductConsultationList = (params: ProductConsultationListParams) => {
    return request<ProductConsultationList>({
        url: "user/feedback/list",
        method: "get",
        params: normalizeProductQuery(params, isO2o()),
        noSkipLogin: true
    });
};

/**
 * @description 提交商品咨询
 * @param data 咨询内容
 * @returns 提交结果
 */
export const addConsultation = (data: ProductConsultationFormState) => {
    return request({
        url: "user/feedback/submit",
        method: "post",
        data
    });
};

/**
 * @description 获取售后服务说明
 * @param id 商品ID
 * @returns 售后政策
 */
export const getAfterSaleService = (id: number) => {
    return request<any>({
        url: "common/config/afterSalesService",
        method: "get"
    });
};

/**
 * @description 检查商品是否已收藏
 * @param params 包含商品ID
 * @returns 收藏状态
 */
export const getCollectProduct = (params: object) => {
    return request<any>({
        url: "product/product/isCollect",
        method: "get",
        params: normalizeProductQuery(params, isO2o()),
        noSkipLogin: true
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

/**
 * @description 收藏商品
 * @param data 包含商品ID
 * @returns 操作结果
 */
export const updateCollectProduct = (data: object) => {
    return request({
        url: "user/collectProduct/save",
        method: "post",
        data
    });
};

/**
 * @description 获取商品可领取优惠券列表
 * @param params 包含商品ID
 * @returns 优惠券列表
 */
export const getProductCouponList = (params: object) => {
    return request<ProductCouponList>({
        url: "product/product/getCoupon",
        method: "get",
        params: normalizeProductQuery(params, isO2o())
    });
};

/**
 * @description 获取商品参与的活动信息
 * @param data 包含商品ID、SKU等
 * @returns 活动列表
 */
export const getPromotion = (data: object) => {
    return request<PromotionResponse>({
        url: "product/product/promotion",
        method: "post",
        data
    });
};

/**
 * @description 计算商品实际价格
 * @param data 包含商品ID、数量、SKU等
 * @returns 价格明细
 */
export const getProductAmount = (data: object) => {
    return request<ProductAmountResponse>({
        url: "product/product/getProductAmount",
        method: "post",
        data
    });
};

/**
 * @description 批量获取商品SKU库存
 * @param params 包含多个商品ID
 * @returns 各商品库存信息
 */
export const getBatchProductAvailability = (params: object) => {
    return request<SkuAvailabilitysResponse>({
        url: "product/product/getBatchProductAvailability",
        method: "get",
        params: normalizeProductQuery(params, isO2o())
    });
};

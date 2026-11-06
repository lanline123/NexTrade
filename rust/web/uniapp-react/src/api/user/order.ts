import type { ApiEnvelope } from "@/types/api";
import request from "@/utils/request";
import type { OrderNumResponse, OrderListResponse, OrderInfoResponse, ShippingInfoResponse } from "@/types/user/order";
import type { OfflinePaymentClaimSubmitParams, OfflinePaymentClaimResponse, OfflinePaymentClaimListResponse, OfflinePaymentClaimSubmitResponse } from "@/types/order/offlinePaymentClaim";

/**
 * @description 获取用户订单列表
 * @param params 筛选条件（状态、分页等）
 * @returns 订单列表
 */
export const getOrderList = (params: any) => {
    return request<OrderListResponse>({
        url: "user/order/list",
        method: "get",
        params
    });
};

/**
 * @description 获取各状态订单数量
 * @returns 各状态订单统计
 */
export const getOrderNum = () => {
    return request<OrderNumResponse>({
        url: "user/order/orderNum",
        method: "get"
    });
};

/**
 * @description 删除订单
 * @param data 包含订单ID
 * @returns 操作结果
 */
export const delOrder = (data: object) => {
    return request({
        url: "user/order/delOrder",
        method: "post",
        data
    });
};

/**
 * @description 取消订单
 * @param data 包含订单ID、取消原因
 * @returns 操作结果
 */
export const cancelOrder = (data: object) => {
    return request({
        url: "user/order/cancelOrder",
        method: "post",
        data
    });
};

export interface OrderReasonConfig {
    /** 原因开关，取消订单与售后共用 */
    afterSalesReasonEnabled: number;
    /** 取消未支付订单原因 */
    cancelOrderReasonList: string[];
    /** 已废弃，仅后端兼容旧前端保留，不要再读 */
    afterSalesReasonList?: string[];
}

export const getOrderReasonConfig = () => {
    return request<ApiEnvelope<OrderReasonConfig>>({ url: "user/order/reasonConfig", method: "get" });
};

/**
 * @description 获取订单详情
 * @param params 包含订单ID
 * @returns 订单完整信息
 */
export const getOrder = (params: object) => {
    return request<OrderInfoResponse>({
        url: "user/order/detail",
        method: "get",
        params
    });
};

/**
 * @description 再次购买（将订单商品加入购物车）
 * @param data 包含订单ID
 * @returns 操作结果
 */
export const orderBuyAgain = (data: object) => {
    return request({
        url: "user/order/buyAgain",
        method: "post",
        data
    });
};

/**
 * @description 确认收货
 * @param data 包含订单ID
 * @returns 操作结果
 */
export const confirmReceipt = (data: object) => {
    return request({
        url: "user/order/confirmReceipt",
        method: "post",
        data
    });
};

/**
 * @description 获取订单物流信息
 * @param params 包含订单ID
 * @returns 物流轨迹
 */
export const getShippingInfo = (params: object) => {
    return request<ShippingInfoResponse>({
        url: "user/order/shippingInfo",
        method: "get",
        params
    });
};

export const submitOfflinePaymentClaim = (data: OfflinePaymentClaimSubmitParams) => {
    return request<OfflinePaymentClaimSubmitResponse>({ url: "user/order/offlinePaymentClaim/submit", method: "post", data });
};

export const getOfflinePaymentClaimDetail = (orderId: number) => {
    return request<OfflinePaymentClaimResponse>({ url: "user/order/offlinePaymentClaim/detail", method: "get", params: { orderId } });
};

export const getOfflinePaymentClaimHistory = (orderId: number) => {
    return request<OfflinePaymentClaimListResponse>({ url: "user/order/offlinePaymentClaim/history", method: "get", params: { orderId } });
};

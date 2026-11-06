import request from "@/utils/request";
import type {
    CheckResponse,
    OrderSubmitPayload,
    OrderSubmitResponse,
    PaymentTypeResponse,
    ShippingTypeResponse,
    StockCalendarParams,
    StockCalendarResponse
} from "@/types/order/check";

/**
 * @description 获取订单结算页数据
 * @param data 包含购物车ID/商品ID、flowType、地址ID等
 * @returns 结算页完整数据
 */
export const getOrderCheckData = (data: AnyObject) => {
    return request<CheckResponse>({
        url: "order/check/index",
        method: "post",
        data
    });
};

/**
 * @description 更新订单结算数据
 * @param data 变更的结算项
 * @returns 重新计算后的价格明细
 */
export const updateOrderCheckData = (data: AnyObject) => {
    return request<CheckResponse>({
        url: "order/check/update",
        method: "post",
        data
    });
};

/**
 * @description 更新订单使用的优惠券
 * @param data 包含优惠券ID
 * @returns 重新计算后的价格明细
 */
export const updateCouponData = (data: any) => {
    return request<CheckResponse>({
        url: "order/check/updateCoupon",
        method: "post",
        data: data
    });
};

/**
 * @description 提交订单
 * @param data 完整订单数据
 * @returns 订单ID
 */
export const orderSubmit = (data: OrderSubmitPayload) => {
    return request<OrderSubmitResponse>({
        url: "order/check/submit",
        method: "post",
        data: data
    });
};

/**
 * @description 获取可用支付方式列表
 * @param flowType 订单类型（普通购买/秒杀/拼团等），不同类型支持的支付方式可能不同
 * @returns 支付方式列表（微信/支付宝/余额/货到付款等）
 */
export const getPaymentType = (flowType?: number) => {
    let url = "order/check/getAvailablePaymentType";
    if (flowType) url += "?flowType=" + flowType;
    return request<PaymentTypeResponse>({
        url,
        method: "GET"
    });
};

/**
 * @description 获取门店配送方式
 * @param params 包含门店ID、地址ID等
 * @returns 可用配送方式及运费
 */
export const getShippingType = (params: object) => {
    return request<ShippingTypeResponse>({
        url: "order/check/getStoreShippingType",
        method: "GET",
        params
    });
};

/**
 * @description 获取预约库存日历（O2O预约功能）
 * @param params 包含商品ID、门店ID、skuId等
 * @returns 各日期可预约库存数量
 */
export const getStockCalendar = (params: StockCalendarParams) => {
    return request<StockCalendarResponse>({
        url: "o2o/OrderReservation/getStockCalendar",
        method: "GET",
        params
    });
};

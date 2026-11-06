import request from "@/utils/request";
import type { payResponse, creatPayParams } from "@/types/order/pay";
import type { PayLogResponse, PayStatusResponse } from "@/types/order/payStatus";
import type { PresalePaymentConfigResponse } from "@/types/presale/presale";

/**
 * @description 获取订单支付信息
 * @param id 订单ID
 * @returns 订单金额、可用支付方式等
 */
export const orderPayInfo = (id: number) => {
    return request<payResponse>({
        url: "order/pay/index?id=" + id,
        method: "get"
    });
};

export const orderPayInfoTerm = () => {
    return request<payResponse>({
        url: "order/pay/index",
        method: "get"
    });
};

/**
 * @description 下单前获取当前可用支付渠道列表（结算页直选用）
 * 无需订单 id，返回 paymentList（渠道 code 数组，按后台配置排序），order 恒为 null
 */
export const orderPaymentList = () => {
    return request<payResponse>({
        url: "order/pay/paymentList",
        method: "get"
    });
};

/**
 * @description 创建支付单
 * @param params 包含订单ID、支付方式等
 * @returns 支付调起参数
 */
export const creatPay = (params: creatPayParams) => {
    return request({
        url: "order/pay/create",
        method: "get",
        params
    });
};

/**
 * @description 检查支付状态
 * @param params 包含支付单号或订单ID
 * @returns 支付状态
 */
export const checkPayStatus = (params: object) => {
    return request<PayStatusResponse>({
        url: "order/pay/checkStatus",
        method: "get",
        params
    });
};

/**
 * @description 获取支付日志
 * @param params 包含订单ID
 * @returns 支付记录列表
 */
export const getPayLog = (params: object) => {
    return request<PayLogResponse>({
        url: "order/pay/getPayLog",
        method: "get",
        params
    });
};

/**
 * @description 检查充值订单支付状态
 * @param params 包含充值订单号
 * @returns 充值支付状态
 */
export const checkRechargePayStatus = (params: object) => {
    return request({
        url: "user/rechargeOrder/checkStatus",
        method: "get",
        params
    });
};

/**
 * @description 充值订单支付
 * @param data 包含充值订单ID、支付方式等
 * @returns 支付调起参数
 */
export const rechargeOrderPay = (data: object) => {
    return request({
        url: "user/rechargeOrder/pay",
        method: "post",
        data
    });
};

/**
 * @description 创建充值订单
 * @param data 包含充值金额、支付方式等
 * @returns 充值订单ID及支付参数
 */
export const rechargeOrderCreate = (data: creatPayParams) => {
    return request({
        url: "user/rechargeOrder/create",
        method: "post",
        data
    });
};

/**
 * @description 创建预售定金支付单
 * @param params 包含订单ID、支付方式等
 * @returns 定金支付参数
 */
export const createDepositPayment = (params: creatPayParams) => {
    return request<PresalePaymentConfigResponse>({
        url: "order/pay/createDepositPayment",
        method: "get",
        params
    });
};

/**
 * @description Apple Pay 商户验证（H5 原生 ApplePaySession.onvalidatemerchant 阶段调用）
 * @param data 包含订单 id 与 Apple 下发的 validationURL
 * @returns 商户会话对象，用于 completeMerchantValidation
 */
export const applePayValidateMerchant = (data: { id: number; validationURL: string }) => {
    return request({
        url: "order/pay/applepay/validateMerchant",
        method: "post",
        data
    });
};

/**
 * @description Apple Pay 支付确认（H5 原生 ApplePaySession.onpaymentauthorized 阶段调用）
 * @param data 包含订单 id 与 Apple 返回的支付 token（序列化后的 payment.token）
 * @returns 后端处理结果
 */
export const applePayConfirm = (data: { id: number; token: string }) => {
    return request({
        url: "order/pay/applepay/confirm",
        method: "post",
        data
    });
};

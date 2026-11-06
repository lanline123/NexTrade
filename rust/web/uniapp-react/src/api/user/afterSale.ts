import request from "@/utils/request";
import type { afterSaleEditResponse, afterSaleEditParams, afterSaleInfoResponse, NegotiateResponse, AfterSaleListResponse } from "@/types/user/afterSale";

/**
 * @description 获取售后申请表单数据
 * @param params 包含订单ID、商品ID等
 * @returns 可申请的售后类型、商品信息等
 */
export const getAftersalesEdit = (params: afterSaleEditParams) => {
    return request<afterSaleEditResponse>({
        url: "user/aftersales/applyData",
        method: "get",
        params
    });
};

/**
 * @description 获取售后配置选项
 * @param params 筛选条件
 * @returns 售后原因、类型等配置
 */
export const getAftersalesConfig = (params: object) => {
    return request<any>({
        url: "user/aftersales/config",
        method: "get",
        params
    });
};

/**
 * @description 提交售后申请
 * @param data 售后申请信息
 * @returns 售后单ID
 */
export const updateAfterSales = (data: object) => {
    return request({
        url: "user/aftersales/create",
        method: "post",
        data
    });
};

/**
 * @description 更新售后申请信息
 * @param data 修改后的申请信息
 * @returns 操作结果
 */
export const aftersalesUpdate = (data: object) => {
    return request({
        url: "user/aftersales/update",
        method: "post",
        data
    });
};

/**
 * @description 获取售后申请详情
 * @param id 售后单ID
 * @returns 售后单完整信息
 */
export const aftersalesViewRecord = (id: number) => {
    return request<afterSaleInfoResponse>({
        url: "user/aftersales/detail?id=" + id,
        method: "get"
    });
};

/**
 * @description 撤销售后申请
 * @param data 包含售后单ID
 * @returns 操作结果
 */
export const aftersalesCancel = (data: object) => {
    return request({
        url: "user/aftersales/cancel",
        method: "post",
        data
    });
};

/**
 * @description 获取售后协商日志
 * @param id 售后单ID
 * @returns 协商记录列表
 */
export const viewRecordLog = (id: number) => {
    return request<NegotiateResponse>({
        url: "user/aftersales/detailLog?id=" + id,
        method: "get"
    });
};

/**
 * @description 提交售后反馈（用户补充信息）
 * @param data 反馈内容
 * @returns 操作结果
 */
export const aftersalesFeedback = (data: object) => {
    return request({
        url: "user/aftersales/feedback",
        method: "post",
        data
    });
};

/**
 * @description 获取售后申请记录列表
 * @param params 筛选条件
 * @returns 售后记录列表
 */
export const aftersalesRecord = (params: object) => {
    return request<AfterSaleListResponse>({
        url: "user/aftersales/getRecord",
        method: "get",
        params
    });
};

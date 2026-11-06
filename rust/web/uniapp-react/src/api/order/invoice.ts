import request from "@/utils/request";
import type { InvoiceResponse } from "@/types/order/invoice";

/**
 * @description 获取增票资质审核状态
 * @returns 资质状态及详情
 */
export const getInvoiceStatus = () => {
    return request<InvoiceResponse>({
        url: "user/invoice/getStatus",
        method: "get"
    });
};

/**
 * @description 获取结算页发票信息
 * @param params 结算相关参数
 * @returns 可用发票类型及信息
 */
export const getCheckInvoice = (params: object) => {
    return request<any>({
        url: "order/check/getInvoice",
        method: "get",
        params
    });
};

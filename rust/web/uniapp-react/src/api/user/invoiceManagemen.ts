import request from "@/utils/request";

/**
 * @description 申请订单电子发票
 * @param data 发票信息
 * @returns 操作结果
 */
export const orderInvoiceInsert = (data: object) => {
    return request({
        url: "user/orderInvoice/create",
        method: "post",
        data
    });
};

/**
 * @description 更新订单发票信息
 * @param data 发票信息
 * @returns 操作结果
 */
export const orderInvoiceUpdate = (data: object) => {
    return request({
        url: "user/orderInvoice/update",
        method: "post",
        data
    });
};

/**
 * @description 获取订单发票申请详情
 * @param orderId 订单ID（接口入参名为 id）
 * @returns 订单发票申请详情
 */
export const getOrderInvoiceDetail = (orderId: number | string) => {
    return request<any>({
        url: "user/orderInvoice/detail",
        method: "get",
        params: { id: orderId }
    });
};

/**
 * @description 获取用户增值税发票资质信息
 * @returns 增票资质详情
 */
export const getUserInvoice = () => {
    return request<any>({
        url: "user/invoice/detail",
        method: "get"
    });
};

/**
 * @description 创建增值税发票资质
 * @param data 资质信息
 * @returns 操作结果
 */
export const createUserInvoice = (data: object) => {
    return request({
        url: "user/invoice/create",
        method: "post",
        data
    });
};

/**
 * @description 更新增值税发票资质
 * @param data 资质信息
 * @returns 操作结果
 */
export const updateUserInvoice = (data: object) => {
    return request<any>({
        url: "user/invoice/update",
        method: "post",
        data
    });
};

/**
 * @description 获取增票资质审核状态
 * @returns 审核状态
 */
export const getInvoiceStatus = () => {
    return request<any>({
        url: "user/invoice/getStatus",
        method: "get"
    });
};

import request from "@/utils/request";
import type { ApplyDetailResponse, MyMerchantResponse } from "@/types/user/merchantEnter";

/**
 * @description 提交商家入驻申请
 * @param data 入驻资料
 * @returns 申请结果
 */
export const applyMerchant = (data: object) => {
    return request({
        url: "merchant/merchant/apply",
        method: "post",
        data
    });
};

/**
 * @description 获取入驻申请详情
 * @param id 申请ID
 * @returns 申请详情
 */
export const getMerchantInfo = (id: any) => {
    return request<ApplyDetailResponse>({
        url: "merchant/merchant/applyDetail",
        method: "get",
        params: { id }
    });
};

/**
 * @description 获取我的入驻申请记录
 * @returns 申请记录
 */
export const getMyMerchant = () => {
    return request<MyMerchantResponse>({
        url: "merchant/merchant/myApply",
        method: "get"
    });
};

/**
 * @description 获取商家入驻协议
 * @returns 协议内容
 */
export const getApplyShopAgreement = () => {
    return request({
        url: "merchant/merchant/applyShopAgreement",
        method: "get"
    });
};

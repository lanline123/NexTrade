import request from "@/utils/request";

/**
 * @description 提交企业认证申请
 * @param data 认证资料
 * @returns 申请结果
 */
export const applyApply = (data: object) => {
    return request({
        url: "user/company/apply",
        method: "post",
        data
    });
};

/**
 * @description 获取企业认证申请详情
 * @param id 申请ID
 * @returns 申请详情
 */
export const getApplyInfo = (id: any) => {
    return request<any>({
        url: "user/company/detail",
        method: "get",
        params: { id }
    });
};

/**
 * @description 获取我的企业认证申请记录
 * @returns 申请记录
 */
export const getMyApply = () => {
    return request<any>({
        url: "user/company/myApply",
        method: "get"
    });
};

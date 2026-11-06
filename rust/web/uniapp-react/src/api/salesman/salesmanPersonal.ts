import request from "@/utils/request";
import type { SalesmanPersoanlDataResponse } from "@/types/salesman/salesmanPersonal";

/**
 * @description 获取分销员个人资料
 * @returns 个人资料详情
 */
export const getSalesmanPersonal = () => {
    return request<SalesmanPersoanlDataResponse>({
        url: "user/user/detail",
        method: "get"
    });
};

/**
 * @description 更新分销员个人资料
 * @param data 更新的资料字段
 * @returns 操作结果
 */
export const updateSalesmanPersonal = (data: object) => {
    return request({
        url: "user/user/updateInformation",
        method: "post",
        data
    });
};

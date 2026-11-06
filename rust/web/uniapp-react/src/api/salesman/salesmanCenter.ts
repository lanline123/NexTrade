import type { ApiEnvelope } from "@/types/api";
import request from "@/utils/request";
import type { UserDataResponse, SalesmanDataResponse } from "@/types/salesman/salesmanCenter";
import type { CustomerDetail, CustomerListParams, CustomerListResponse } from "@/types/salesman/customer";

/**
 * @description 获取用户详情
 * @returns 用户信息
 */
export const getUser = () => {
    return request<UserDataResponse>({
        url: "user/user/detail",
        method: "get"
    });
};

/**
 * @description 获取分销员详情
 * @returns 分销员信息及业绩
 */
export const getSalesman = () => {
    return request<SalesmanDataResponse>({
        url: "salesman/salesman/detail",
        method: "get"
    });
};

export const getCustomerList = (params: CustomerListParams) => request<ApiEnvelope<CustomerListResponse>>({ url: "salesman/salesman/customerList", method: "get", params });
export const getCustomerDetail = (userId: number) => request<ApiEnvelope<CustomerDetail>>({ url: "salesman/salesman/customerDetail", method: "get", params: { userId } });

export const updateCustomerRemark = (data: { userId: number; remark: string }) => request({ url: "salesman/salesman/customerRemark", method: "post", data });

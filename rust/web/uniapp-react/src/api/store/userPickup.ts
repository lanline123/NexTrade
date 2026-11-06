import request from "@/utils/request";
import type { UserPickupListResponse, UserPickuDetailResponse } from "@/types/store/userPicekup";

/**
 * @description 获取用户自提人列表
 * @param params 分页参数
 * @returns 自提人列表（姓名、手机号、是否默认等）
 */
export const getUserPickupList = (params: object) => {
    return request<UserPickupListResponse>({
        url: "o2o/userPickup/getUserPickups",
        method: "get",
        params
    });
};

/**
 * @description 获取自提人详情
 * @param params 包含自提人ID
 * @returns 自提人详细信息
 */
export const getUserPickupDetail = (params: object) => {
    return request<UserPickuDetailResponse>({
        url: "o2o/userPickup/detail",
        method: "get",
        params
    });
};

/**
 * @description 新增自提人
 * @param data 自提人信息（姓名、手机号、是否默认）
 * @returns 新增结果
 */
export const createUserPickup = (data: object) => {
    return request<any>({
        url: "o2o/userPickup/create",
        method: "post",
        data
    });
};

/**
 * @description 更新自提人信息
 * @param data 自提人信息（含ID）
 * @returns 更新结果
 */
export const upadteUserPickup = (data: object) => {
    return request<any>({
        url: "o2o/userPickup/update",
        method: "post",
        data
    });
};

/**
 * @description 删除自提人
 * @param data 包含自提人ID
 * @returns 删除结果
 */
export const deleteUserPickup = (data: object) => {
    return request<any>({
        url: "o2o/userPickup/del",
        method: "post",
        data
    });
};

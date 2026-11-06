import request from "@/utils/request";
import type { UserDataResponse } from "@/types/user/user";

/**
 * @description 获取会员等级列表
 * @returns 所有会员等级及权益
 */
export const getUserLevelList = () => {
    return request<any>({
        url: "user/user/levelList",
        method: "get"
    });
};

/**
 * @description 获取指定等级详情
 * @param params 包含等级ID
 * @returns 等级详细信息
 */
export const getUserLevelInfo = (params: object) => {
    return request<any>({
        url: "user/user/levelInfo",
        method: "get",
        params
    });
};

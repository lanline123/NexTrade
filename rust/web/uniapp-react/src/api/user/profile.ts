import request from "@/utils/request";
import type { ProfileFormResult } from "@/types/user/profile.d";

/**
 * @description 获取用户个人资料
 * @returns 用户资料详情
 */
export const getProfile = () => {
    return request<ProfileFormResult>({
        url: "user/user/detail",
        method: "get"
    });
};

/**
 * @description 更新用户个人资料
 * @param data 更新的资料字段
 * @returns 操作结果
 */
export const updateProfile = (data: object) => {
    return request({
        url: "user/user/updateInformation",
        method: "post",
        data
    });
};

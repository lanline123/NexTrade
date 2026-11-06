import type { ApiEnvelope } from "@/types/api";
import request from "@/utils/request";
import type { SignInfoResponse } from "@/types/user/sign.d";

/**
 * @description 获取签到信息
 * @param url 签到信息URL
 * @returns 签到状态及奖励信息
 */
export const getSignList = (url: string) => {
    return request<ApiEnvelope<SignInfoResponse>>({
        url: url,
        method: "get"
    });
};

/**
 * @description 执行签到
 * @returns 签到结果及奖励
 */
export const signIn = () => {
    return request<ApiEnvelope<SignInfoResponse>>({
        url: "user/sign/sign",
        method: "get"
    });
};

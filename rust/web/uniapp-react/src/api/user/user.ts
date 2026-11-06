import request from "@/utils/request";
import type { MemberCenterResponse, UnreadCountResponse, UserDataResponse } from "@/types/user/user";
import type { UserCreditDetailResponse } from "@/types/user/termPay";

/**
 * @description 获取当前登录用户信息
 * @returns 用户详细信息
 */
export const getUser = () => {
    return request<UserDataResponse>({
        url: "user/user/detail",
        method: "get"
    });
};

/**
 * @description 获取会员中心信息（用于优惠券数量等）
 * @returns 会员中心数据
 */
export const getMemberCenter = () => {
    return request<MemberCenterResponse>({
        url: "user/user/memberCenter",
        method: "get"
    });
};

/**
 * @description 注销用户账号
 * @returns 操作结果
 */
export const userClose = () => {
    return request<UserDataResponse>({
        url: "user/user/close",
        method: "post"
    });
};

/**
 * @description 获取未读消息数量
 * @returns 各类型未读消息数
 */
export const getUnreadCount = () => {
    return request<UnreadCountResponse>({
        url: "user/message/unreadCount",
        method: "get"
    });
};

/**
 * @description 获取当前登录用户的账期支付信息详情（额度信息 + 未结算/已结算订单列表）
 * @returns 信用额度/已用/可用、账期天数、剩余天数、未结算/已结算订单列表
 */
export const getUserCreditDetail = () => {
    return request<UserCreditDetailResponse>({
        url: "user/user/creditDetail",
        method: "get"
    });
};

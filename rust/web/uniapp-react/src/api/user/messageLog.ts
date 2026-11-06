import request from "@/utils/request";
import type { UserMsgFilterResult } from "@/types/user/messageLog";

/**
 * @description 获取站内信列表
 * @param params 筛选条件
 * @returns 消息列表
 */
export const getMessageList = (params: object) => {
    return request<UserMsgFilterResult>({
        url: "user/message/list",
        method: "get",
        params
    });
};

/**
 * @description 标记单条消息为已读
 * @param id 消息ID
 * @returns 操作结果
 */
export const addMessageRead = (id: number) => {
    return request({
        url: "user/message/updateMessageRead",
        method: "post",
        data: { id }
    });
};

/**
 * @description 标记全部消息为已读
 * @returns 操作结果
 */
export const addMessageAllRead = () => {
    return request({
        url: "user/message/updateAllRead",
        method: "post"
    });
};

/**
 * @description 删除站内信
 * @param data 包含消息ID
 * @returns 操作结果
 */
export const delMessage = (data: object) => {
    return request({
        url: "user/message/del",
        method: "post",
        data
    });
};

/**
 * @description 设置所有消息为已读
 * @returns 操作结果
 */
export const setAllMessageRead = () => {
    return request({
        url: "user/message/updateAllRead",
        method: "post"
    });
};

/**
 * @description 设置订单相关消息为已读
 * @returns 操作结果
 */
export const updateOrderMessageRead = () => {
    return request({
        url: "user/message/updateOrderMessageRead",
        method: "post"
    });
};

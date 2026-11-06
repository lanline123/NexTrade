import request from "@/utils/request";

/**
 * @description 获取IM会话列表
 * @param params 筛选条件
 * @returns 会话列表
 */
export const getConversation = (params: {}) => {
    return request<any>({
        prefix: "/im/",
        url: "conversation/conversation/list",
        method: "get",
        params
    });
};

/**
 * @description 获取会话消息记录
 * @param params 包含会话ID、分页
 * @returns 消息列表
 */
export const getConversationMessage = (params: {}) => {
    return request<any>({
        prefix: "/im/",
        url: "conversation/message/list",
        method: "get",
        params
    });
};

/**
 * @description 获取会员信息
 * @param params 会员筛选条件
 * @returns 会员信息
 */
export const getUserInfo = (params: {}) => {
    return request({
        prefix: "/im/",
        url: "conversation/message/list",
        method: "get",
        params
    });
};

/**
 * @description 发送消息
 * @param data 消息内容
 * @returns 发送结果
 */
export const sendMessage = (data: {}) => {
    return request<any>({
        prefix: "/im/",
        url: "conversation/message/send",
        method: "post",
        data
    });
};

/**
 * @description 设置消息为已读
 * @param data 包含消息ID
 * @returns 操作结果
 */
export const setRead = (data: {}) => {
    return request({
        prefix: "/im/",
        url: "conversation/message/setRead",
        method: "post",
        data
    });
};

import request from "@/utils/request";
// 获取直播记录列表
export const getConversation = (id: string) => {
    return request<any>({
        url: "content/wechatVideoAccount/finderLiveRecord",
        method: "get",
        params: { id }
    });
};

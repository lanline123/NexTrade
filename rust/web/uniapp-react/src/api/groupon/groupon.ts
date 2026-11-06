import request from "@/utils/request";
import type {
    GrouponRecordListResponse,
    GrouponRecordDetailResponse,
    GrouponPromotionDetailResponse,
    GrouponItemListResponse,
    JoiningActivityResponse
} from "@/types/groupon/groupon";

/**
 * 获取拼团列表
 * @param params 获取拼团列表参数
 * @returns 拼团列表
 */
export const getGrouponRecordList = (params: AnyObject) => {
    return request<GrouponRecordListResponse>({
        url: "promotion/groupon/record/list",
        method: "get",
        params
    });
};

/**
 * 获取拼团记录详情
 * @param grouponPromotionRecordId 拼团记录Id
 * @returns 拼团记录详情
 */
export const getGrouponRecordDetail = (grouponPromotionRecordId: number) => {
    return request<GrouponRecordDetailResponse>({
        url: "promotion/groupon/record/details",
        method: "get",
        params: { grouponPromotionRecordId }
    });
};

/**
 * 获取拼团活动详情
 * @param grouponPromotionId 活动Id
 * @returns 拼团活动详情
 */
export const getGrouponPromotionDetail = (grouponPromotionId: number) => {
    return request<GrouponPromotionDetailResponse>({
        url: "promotion/groupon/detail",
        method: "get",
        params: { grouponPromotionId }
    });
};

/**
 * @description 获取拼团商品列表
 * @param params 筛选条件
 * @returns 拼团商品列表
 */
export const getGrouponItemList = (params: AnyObject) => {
    return request<GrouponItemListResponse>({
        url: "promotion/groupon/itemList",
        method: "get",
        params
    });
};

/**
 * @description 获取正在进行的拼团活动详情
 * @param params 包含商品ID等
 * @returns 拼团活动详情
 */
export const getJoiningActivityDetail = (params: object) => {
    return request<JoiningActivityResponse>({
        url: "promotion/groupon/getGrouponInfo",
        method: "get",
        params
    });
};

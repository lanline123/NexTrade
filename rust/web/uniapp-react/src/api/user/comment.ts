import request from "@/utils/request";
import type { CommentFilterParams } from "@/types/user/comment.d";

/**
 * @description 获取各评价状态数量统计
 * @returns 待评价、已评价等数量
 */
export const getCommentSubNum = () => {
    return request<any>({
        url: "user/comment/subNum",
        method: "get"
    });
};

/**
 * @description 获取待晒单商品列表
 * @param params 筛选条件
 * @returns 待晒单商品列表
 */
export const getShowedList = (params: CommentFilterParams) => {
    return request({
        url: "user/comment/showedList?isShowed=0",
        method: "get",
        params
    });
};

/**
 * @description 获取已评价列表
 * @param params 筛选条件
 * @returns 已评价列表
 */
export const getCommentList = (params: CommentFilterParams) => {
    return request({
        url: "user/comment/list",
        method: "get",
        params
    });
};

/**
 * @description 提交商品评价
 * @param data 评价内容、评分、图片等
 * @returns 操作结果
 */
export const updateCommentData = (data: object) => {
    return request({
        url: "user/comment/evaluate",
        method: "post",
        data
    });
};

/**
 * @description 获取评价详情
 * @param params 包含评价ID
 * @returns 评价详情
 */
export const getCommentData = (params: object) => {
    return request<any>({
        url: "user/comment/detail",
        method: "get",
        params
    });
};

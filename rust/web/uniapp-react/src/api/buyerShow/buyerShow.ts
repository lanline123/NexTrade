import request from "@/utils/request";
import type { BuyerShowCommentListFilter, BuyerShowListFilter } from "@/types/buyerShow/buyerShow";

/**
 * @description 点赞买家秀
 * @param data 包含买家秀ID
 * @returns 操作结果
 */
export const buyerShowLike = (data: object) => {
    return request({
        url: "buyerShow/buyerShow/like",
        method: "post",
        data
    });
};

/**
 * @description 评论买家秀
 * @param data 评论内容
 * @returns 操作结果
 */
export const buyerShowComment = (data: object) => {
    return request({
        url: "buyerShow/buyerShow/comment",
        method: "post",
        data
    });
};

/**
 * @description 点赞买家秀评论
 * @param data 包含评论ID
 * @returns 操作结果
 */
export const buyerShowCommentLike = (data: object) => {
    return request({
        url: "buyerShow/buyerShow/comment/like",
        method: "post",
        data
    });
};

/**
 * @description 发布买家秀
 * @param data 买家秀内容
 * @returns 操作结果
 */
export const buyerShowAdd = (data: object) => {
    return request({
        url: "buyerShow/buyerShow/add",
        method: "post",
        data
    });
};

/**
 * @description 获取买家秀列表
 * @param params 筛选条件
 * @returns 买家秀列表
 */
export const buyerShowList = (params: object) => {
    return request<BuyerShowListFilter>({
        url: "buyerShow/buyerShow/list",
        method: "get",
        params
    });
};

/**
 * @description 获取买家秀详情
 * @param params 包含买家秀ID
 * @returns 买家秀详情
 */
export const buyerShowDetail = (params: object) => {
    return request({
        url: "buyerShow/buyerShow/detail",
        method: "get",
        params
    });
};

/**
 * @description 获取买家秀评论列表
 * @param params 包含买家秀ID、分页
 * @returns 评论列表
 */
export const buyerShowCommentList = (params: object) => {
    return request<BuyerShowCommentListFilter>({
        url: "buyerShow/buyerShow/comment/pageList",
        method: "get",
        params
    });
};

/**
 * @description 获取可发布买家秀的已购商品列表
 * @param params 筛选条件
 * @returns 已购商品列表
 */
export const getHistoryProduct = (params: object) => {
    return request({
        url: "product/product/getHistoryProduct",
        method: "get",
        params
    });
};

/**
 * @description 获取买家秀分组列表
 * @param params 筛选条件
 * @returns 分组列表
 */
export const getBuyerShowGroupList = (params?: object) => {
    return request({
        url: "buyerShow/buyerShow/groupList",
        method: "get",
        params
    });
};

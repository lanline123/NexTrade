import request from "@/utils/request";
import type {
    FavoriteBuyerShowInput,
    FollowAuthorInput,
    VideoFeedApiResponse,
    VideoFeedCommentApiResponse,
    VideoFeedCommentQuery,
    VideoFeedCommentResponse,
    VideoFeedQuery,
    VideoFeedResponse
} from "@/types/buyerShow/videoFeed";
import {
    mapVideoFeedCommentResponse,
    mapVideoFeedResponse,
    toFollowAuthorPayload,
    toVideoFeedCommentQueryPayload,
    toVideoFeedQueryPayload
} from "./videoFeed.adapter";
import { mockFavoriteBuyerShow, mockFollowAuthor, mockGetVideoComments, mockGetVideoFeed } from "./videoFeed.mock";

/**
 * 是否使用前端 mock 数据。
 * 该开关同时影响下方四个接口，发布前必须置回 false。
 */
const USE_MOCK = false;

/**
 * @description 获取买家秀视频流（游标翻页）
 * @param params 分页与定位参数
 * @returns 视频流分页数据
 */
export const buyerShowVideoFeed = async (params: VideoFeedQuery): Promise<VideoFeedResponse> => {
    if (USE_MOCK) return mockGetVideoFeed(params);
    const payload = await request<VideoFeedApiResponse>({
        url: "buyerShow/buyerShow/videoFeed",
        method: "get",
        params: toVideoFeedQueryPayload(params),
        // 只读浏览游客可访问，未登录不跳登录
        noSkipLogin: true
    });
    return mapVideoFeedResponse(payload);
};

/**
 * @description 关注 / 取消关注买家秀作者
 * @param data 作者ID与关注状态
 * @returns 操作结果
 */
export const buyerShowFollowAuthor = (data: FollowAuthorInput) => {
    if (USE_MOCK) return mockFollowAuthor(data);
    return request({
        url: "buyerShow/buyerShow/followAuthor",
        method: "post",
        data: toFollowAuthorPayload(data)
    });
};

/**
 * @description 收藏 / 取消收藏买家秀
 * @param data 买家秀ID与收藏状态
 * @returns 操作结果
 */
export const buyerShowFavorite = (data: FavoriteBuyerShowInput) => {
    if (USE_MOCK) return mockFavoriteBuyerShow(data);
    return request({
        url: "buyerShow/buyerShow/favorite",
        method: "post",
        data
    });
};

/**
 * @description 获取视频流评论分页（含配图字段）
 * @param params 买家秀ID与分页
 * @returns 评论分页数据
 */
export const buyerShowVideoComments = async (params: VideoFeedCommentQuery): Promise<VideoFeedCommentResponse> => {
    if (USE_MOCK) return mockGetVideoComments(params);
    const payload = await request<VideoFeedCommentApiResponse>({
        url: "buyerShow/buyerShow/comment/pageList",
        method: "get",
        params: toVideoFeedCommentQueryPayload(params),
        // 评论列表只读，游客可看
        noSkipLogin: true
    });
    return mapVideoFeedCommentResponse(payload);
};

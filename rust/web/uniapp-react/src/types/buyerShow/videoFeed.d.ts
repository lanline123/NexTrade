/** 视频流通用 ID；雪花 id 为字符串，比对时一律转字符串，不可 Number() */
export type VideoFeedId = string | number;

/** 视频流 - 视频信息 */
export interface VideoFeedVideo {
    videoUrl: string;
    videoCover: string;
    width?: number | null;
    height?: number | null;
    /** 时长（秒） */
    duration?: number | null;
}

/** 视频流 - 附图 */
export interface VideoFeedImage {
    picUrl: string;
    width?: number | null;
    height?: number | null;
}

/** 视频流 - 作者信息 */
export interface VideoFeedAuthor {
    userId: VideoFeedId;
    buyerName: string;
    buyerPhoto: string;
    /** 是否已关注 0/1 */
    isFollow: number;
}

/** 视频流 - 关联商品 */
export interface VideoFeedProduct {
    productId: VideoFeedId;
    skuId?: VideoFeedId;
    productName: string;
    productPrice: string | number;
    picUrl: string;
    stock: number;
}

/** 视频流单屏项 */
export interface VideoFeedItem {
    buyerShowId: VideoFeedId;
    video: VideoFeedVideo;
    /** 该条附图，顺序即展示顺序 */
    images?: VideoFeedImage[];
    author: VideoFeedAuthor;
    productList: VideoFeedProduct[];
    content: string;
    likeCount: number;
    /** 0/1 */
    isLike: number;
    favoriteCount: number;
    /** 0/1 */
    isFavorite: number;
    commentCount: number;
    addTime?: string | number;
}

/** 视频流分页查询（游标翻页，适配无限上划） */
export interface VideoFeedQuery {
    cursor?: string | null;
    size: number;
    buyerShowGroupId?: VideoFeedId;
    keyword?: string;
    /** 从列表点入时的起始买家秀 id，保证首屏是用户点击的那条 */
    startId?: VideoFeedId;
}

/** 视频流分页响应 */
export interface VideoFeedResponse {
    records: VideoFeedItem[];
    nextCursor: string | null;
    hasMore: boolean;
}

/** 关注作者入参 */
export interface FollowAuthorInput {
    userId: VideoFeedId;
    /** 0 取消关注 / 1 关注 */
    isFollow: number;
}

/** 收藏买家秀入参 */
export interface FavoriteBuyerShowInput {
    buyerShowId: VideoFeedId;
    /** 0 取消收藏 / 1 收藏 */
    isFavorite: number;
}

/** 视频流评论查询 */
export interface VideoFeedCommentQuery {
    buyerShowId: VideoFeedId;
    page: number;
    size: number;
    parentId?: VideoFeedId;
}

/** 视频流评论行（在买家秀评论基础上增加配图） */
export interface VideoFeedCommentRow {
    buyerShowCommentId: VideoFeedId;
    userId?: VideoFeedId;
    buyerName?: string;
    buyerPhoto?: string;
    content?: string;
    /** 评论配图 */
    images?: string[];
    /** 配图原始字段（JSON 数组字符串），优先用 images */
    commentPic?: string;
    addTime?: string | number;
    likeCount?: number;
    isLike?: boolean | number;
    /** 是否作者 0/1 */
    isAuthor?: number;
    /** 是否本人 0/1 */
    isMe?: number;
    replyCount?: number;
    /** 审核状态 */
    status?: number;
    /** 二级回复，展开后填充 */
    replies?: VideoFeedCommentRow[];
    /** 是否展开回复列表 */
    showAllReplies?: boolean;
    /** 展开/收起文案 */
    toggleText?: string;
    /** 二级回复分页页码，从 1 开始 */
    page?: number;
}

/** 视频流评论分页响应 */
export interface VideoFeedCommentResponse {
    records: VideoFeedCommentRow[];
    total: number;
    page?: number;
    size?: number;
}

/** 接口下发的视频信息 */
export interface VideoFeedVideoPayload {
    url?: string;
    cover?: string;
    width?: number | null;
    height?: number | null;
    duration?: number | null;
}

/** 接口下发的附图 */
export interface VideoFeedImagePayload {
    url?: string;
    width?: number | null;
    height?: number | null;
}

/** 接口下发的作者信息 */
export interface VideoFeedAuthorPayload {
    /** 系统发布的买家秀为 0 */
    id?: VideoFeedId;
    name?: string;
    avatar?: string;
    isFollow?: number;
}

/** 接口下发的关联商品 */
export interface VideoFeedProductPayload {
    productId?: VideoFeedId;
    skuId?: VideoFeedId | null;
    name?: string;
    price?: string | number;
    picUrl?: string;
    stock?: number;
}

/** 接口下发的视频流项 */
export interface VideoFeedItemPayload {
    id?: VideoFeedId;
    video?: VideoFeedVideoPayload | null;
    images?: VideoFeedImagePayload[] | null;
    author?: VideoFeedAuthorPayload | null;
    products?: VideoFeedProductPayload[] | null;
    content?: string;
    likeCount?: number;
    isLike?: number;
    favoriteCount?: number;
    isFavorite?: number;
    commentCount?: number;
    createTime?: string;
}

/** 接口下发的视频流分页 */
export interface VideoFeedPayload {
    list?: VideoFeedItemPayload[] | null;
    nextCursor?: string | null;
    hasMore?: boolean;
}

/** 接口接收的视频流分页查询 */
export interface VideoFeedQueryPayload {
    size: number;
    cursor?: string | null;
    startId?: VideoFeedId;
    groupId?: VideoFeedId;
    keyword?: string;
}

/** 接口接收的关注作者入参 */
export interface FollowAuthorPayload {
    authorId: VideoFeedId;
    /** 0 取消关注 / 1 关注 */
    isFollow: number;
}

/** 接口下发的评论行 */
export interface VideoFeedCommentRowPayload {
    buyerShowCommentId: VideoFeedId;
    userName?: string;
    userPhoto?: string;
    content?: string;
    /** 由 commentPic 解析而来，无配图时为空数组 */
    images?: string[] | null;
    commentPic?: string;
    addTime?: string | number;
    likeCount?: number;
    isLike?: boolean | number;
    /** 是否作者 0/1 */
    isAuthor?: number;
    /** 是否本人 0/1 */
    isMe?: number;
    replyCount?: number;
    status?: number;
}

/** 接口下发的评论分页 */
export interface VideoFeedCommentPayload {
    records?: VideoFeedCommentRowPayload[] | null;
    total?: number;
    /** 当前页码 */
    current?: number;
    size?: number;
    pages?: number;
}

/** 视频流分页接口响应 */
export interface VideoFeedApiResponse {
    data: VideoFeedPayload;
    code: number;
    message: string;
}

/** 视频流评论接口响应 */
export interface VideoFeedCommentApiResponse {
    data: VideoFeedCommentPayload;
    code: number;
    message: string;
}

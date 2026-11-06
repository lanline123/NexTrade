/**
 * 买家秀视频流 - 接口字段适配
 *
 * 接口下发与接收的字段名和页面使用的类型不同名，转换集中在这里，
 * 页面、composable 与 mock 只面对 @/types/buyerShow/videoFeed 一套命名。
 */
import type {
    FollowAuthorInput,
    FollowAuthorPayload,
    VideoFeedAuthor,
    VideoFeedAuthorPayload,
    VideoFeedCommentPayload,
    VideoFeedCommentQuery,
    VideoFeedCommentResponse,
    VideoFeedCommentRow,
    VideoFeedCommentRowPayload,
    VideoFeedId,
    VideoFeedImage,
    VideoFeedImagePayload,
    VideoFeedItem,
    VideoFeedItemPayload,
    VideoFeedPayload,
    VideoFeedProduct,
    VideoFeedProductPayload,
    VideoFeedQuery,
    VideoFeedQueryPayload,
    VideoFeedResponse,
    VideoFeedVideo,
    VideoFeedVideoPayload
} from "@/types/buyerShow/videoFeed";

const toCount = (value: unknown): number => Number(value) || 0;

/** 缺省 id 落成空串；0 必须原样保留，作者 id 为 0 表示系统发布 */
const toId = (value: VideoFeedId | null | undefined): VideoFeedId => value ?? "";

const mapVideo = (video: VideoFeedVideoPayload | null | undefined): VideoFeedVideo => ({
    videoUrl: video?.url || "",
    videoCover: video?.cover || "",
    width: video?.width ?? null,
    height: video?.height ?? null,
    duration: video?.duration ?? null
});

const mapImage = (image: VideoFeedImagePayload | null | undefined): VideoFeedImage => ({
    picUrl: image?.url || "",
    width: image?.width ?? null,
    height: image?.height ?? null
});

const mapAuthor = (author: VideoFeedAuthorPayload | null | undefined): VideoFeedAuthor => ({
    userId: toId(author?.id),
    buyerName: author?.name || "",
    buyerPhoto: author?.avatar || "",
    isFollow: toCount(author?.isFollow)
});

const mapProduct = (product: VideoFeedProductPayload | null | undefined): VideoFeedProduct => ({
    productId: toId(product?.productId),
    skuId: product?.skuId ?? undefined,
    productName: product?.name || "",
    productPrice: product?.price ?? "",
    picUrl: product?.picUrl || "",
    stock: toCount(product?.stock)
});

/** 接口视频流项 → 页面使用的视频流项 */
export const mapVideoFeedItem = (item: VideoFeedItemPayload): VideoFeedItem => ({
    buyerShowId: toId(item?.id),
    video: mapVideo(item?.video),
    images: (item?.images || []).map(mapImage),
    author: mapAuthor(item?.author),
    productList: (item?.products || []).map(mapProduct),
    content: item?.content || "",
    likeCount: toCount(item?.likeCount),
    isLike: toCount(item?.isLike),
    favoriteCount: toCount(item?.favoriteCount),
    isFavorite: toCount(item?.isFavorite),
    commentCount: toCount(item?.commentCount),
    addTime: item?.createTime
});

/** 接口视频流分页 → 页面使用的分页结构 */
export const mapVideoFeedResponse = (payload: VideoFeedPayload | null | undefined): VideoFeedResponse => ({
    records: (payload?.list || []).map(mapVideoFeedItem),
    nextCursor: payload?.nextCursor ?? null,
    hasMore: Boolean(payload?.hasMore)
});

/** 视频流分页查询 → 接口入参 */
export const toVideoFeedQueryPayload = (params: VideoFeedQuery): VideoFeedQueryPayload => ({
    size: params.size,
    cursor: params.cursor,
    startId: params.startId,
    groupId: params.buyerShowGroupId,
    keyword: params.keyword
});

/** 关注作者入参 → 接口入参 */
export const toFollowAuthorPayload = (data: FollowAuthorInput): FollowAuthorPayload => ({
    authorId: data.userId,
    isFollow: data.isFollow
});

/** 评论查询 → 接口入参；parentId 为必填，顶层列表取 0 */
export const toVideoFeedCommentQueryPayload = (params: VideoFeedCommentQuery): VideoFeedCommentQuery => ({
    ...params,
    parentId: params.parentId ?? 0
});

const mapCommentRow = (row: VideoFeedCommentRowPayload): VideoFeedCommentRow => ({
    buyerShowCommentId: row.buyerShowCommentId,
    buyerName: row.userName || "",
    buyerPhoto: row.userPhoto || "",
    content: row.content || "",
    images: row.images || [],
    commentPic: row.commentPic,
    addTime: row.addTime,
    likeCount: toCount(row.likeCount),
    isLike: row.isLike ?? 0,
    isAuthor: toCount(row.isAuthor),
    isMe: toCount(row.isMe),
    replyCount: toCount(row.replyCount),
    status: row.status
});

/** 接口评论分页 → 页面使用的评论分页 */
export const mapVideoFeedCommentResponse = (payload: VideoFeedCommentPayload | null | undefined): VideoFeedCommentResponse => ({
    records: (payload?.records || []).map(mapCommentRow),
    total: toCount(payload?.total),
    page: payload?.current,
    size: payload?.size
});

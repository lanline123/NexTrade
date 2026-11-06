// 买家秀详情
export interface BuyerShowDetailState {
    buyerName?: string;
    buyerPhoto?: string;
    buyerShowId?: number;
    content?: string;
    likeCount?: number | undefined;
    commentCount?: number;
    productList?: any[];
    videoList?: any[];
    imgList?: any[];
    addTime?: string;
    isLike?: boolean;
}

// 获取买家秀列表
export interface BuyerShowListParams {
    page: number;
    size: number;
    sortField?: string;
    keyword?: string;
    sortOrder?: string;
    goodsId?: number;
    productId?: number;
}

export interface BuyerShowData {
    records: BuyerShowFilterState[];
    total: number;
}

// 列表卡片中的视频素材
export interface BuyerShowCardVideo {
    videoUrl?: string;
    videoCover?: string;
}

// 列表卡片中的图片素材
export interface BuyerShowCardImage {
    picUrl?: string;
}

export interface BuyerShowFilterState {
    buyerName?: string;
    buyerPhoto?: string;
    buyerShowId?: number | string;
    content?: string;
    likeCount?: number | undefined;
    isLike?: boolean | undefined;
    // 是否视频类（第一条素材是视频，0/1），据此决定点击进视频流还是图文详情
    isVideo?: number;
    videoList?: BuyerShowCardVideo[];
    imgList?: BuyerShowCardImage[];
}

export interface BuyerShowListFilter {
    data: BuyerShowData[];
    code: number;
    message: string;
}

export interface BuyerShowCommentData {
    records: BuyerShowCommentFilterState[];
    total: number;
}
export interface BuyerShowCommentFilterState {
    buyerName?: string;
    buyerPhoto?: string;
    buyerShowId?: number;
    content?: string;
    likeCount?: number;
    isLike?: boolean;
    toggleText?: string;
}

export interface BuyerShowCommentListFilter {
    data: BuyerShowCommentData[];
    code: number;
    message: string;
}

// 获取买家秀点赞
export interface BuyerShowLikeListParams {
    buyerShowId: number;
}

// 评论分页列表
export interface BuyerShowCommentListParams {
    page: number;
    size: number;
    sortField?: string;
    sortOrder?: string;
    keyword?: string;
    parentId?: number;
    buyerShowId?: number | string;
}

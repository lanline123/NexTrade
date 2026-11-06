/**
 * 获取拼团活动记录接口参数
 */
export interface GrouponRecordListParams {
    page: number;
    size: number;
    /**
     * 1-开团，2-参团
     */
    joinType?: number;
    /**
     * 是否我的团
     * true 是，false 否
     * 默认为true
     */
    isMine?: boolean;
    /**
     * 拼团状态;拼团状态；1-待成团，2-拼团成功，3-拼团失败
     */
    joinStatus?: number;
    /**
     * 商品ID
     */
    productId?: number;
    /**
     * 是否排除已结束拼团
     */
    excludeEnded?: boolean;
    /**
     * 关键词
     */
    keyword?: string;
    dateType: number;
}

/**
 * 获取拼团活动记录接口返回数据
 */
export interface GrouponRecordListResponse {
    data: GrouponRecordListData;
    code: number;
    message: string;
}

/**
 * 拼团活动记录列表
 */
export interface GrouponRecordListData {
    records: GrouponRecordItem[];
    total: number;
}

/**
 * 拼团活动记录列表Item详情
 */
export interface GrouponRecordItem {
    grouponPromotionRecordId: number;
    grouponPromotionItemId: number;
    productName: string;
    joinStatus: number;
    minGroupNum: number;
    minGrouponPrice: number;
    productPrice: number;
    joinNumCount: number;
    picThumb: string;
    groupNum: number;
    endTime: string;
    joinUser: GrouponJoinUser;
    grouponPrice: number; // 成团价
}

export interface GrouponJoinUser {
    userId: number; // 用户 ID
    username: string; // 用户名
    avatar?: string; // 头像
    leader?: boolean; // 是否是团长
}

/**
 * 拼团活动详情
 */
export interface GrouponRecordDetail {
    grouponPromotionRecordId: number; //拼团记录 ID
    productId: number; // 商品Id
    productName: string; // 商品名称
    joinType: number; // 参与类型；1-开团，2-参团
    joinStatus: number; // 拼团状态；1-待成团，2-拼团成功，3-拼团失败
    minGroupNum: number; // 成团最低人数
    groupNum: number; // 成团人数
    shopId: number; // 所属店铺
    shopTitle: string; // 店铺名称
    grouponImage: string; // 活动图片
    minGrouponPrice: number; // 最低拼团价格
    grouponPrice: number; // 成团价
    productPrice: number; // 商品价格
    picThumb: string; // 缩略图URL
    joinNumCount: number; // 参团人数
    joinUsers: GrouponJoinUser[]; // 参团用户
    skuId: number; // 商品skuId
    startTime: string; // 开团时间
    endTime: string; // 拼团结束时间
    grouponPromotionId: number; // 拼团活动id
}

/**
 * 获取拼团活动详情接口返回数据
 */
export interface GrouponRecordDetailResponse {
    data: GrouponRecordDetail;
    code: number;
    message: string;
}

// 拼团阶梯价格
export interface GrouponLaderItem {
    grouponNumKey: number; // key
    price: number | string; // 阶梯价格
    grouponNum: number; // 成团人数
}
// 商品sku的拼团价格
export interface GrouponSkuItem {
    skuId: number; // skuId
    limitNum: number; // 可售数量
    grouponDetailId: number; // 拼团详情id
    laders: GrouponLaderItem[]; // 阶梯信息
    isJoin?: number; // 是否可参团；1-可参团，0-不可参团
}

// 商品下单时，传递的拼团信息
export interface GrouponBuyData {
    grouponPromotionId: number;
    grouponPromotionItemId: number;
    groupNumKey: number; // 成团人数key
    grouponDetailId: number;
    price: number; // 拼团价
    grouponPromotionRecordId: number; // 开团记录id
}

/**
 * 获取拼团活动详情接口参数
 */
export interface GrouponPromotionDetail {
    grouponPromotionId?: number; // 拼团活动ID
    endTime: string; // 活动结束时间
    grouponExplain: string; // 活动说明
    grouponImage: string; // 活动图片
    startTime: string; // 活动开始时间
    shopId: number; // 店铺ID
    shopTitle: string; // 店铺名称
}

/**
 * 获取拼团活动详情接口返回数据
 */
export interface GrouponPromotionDetailResponse {
    data: GrouponPromotionDetail;
    code: number;
    message: string;
}

// 拼团
export interface GrouponItemListResponse {
    data: GrouponItemListtData;
    code: number;
    message: string;
}

export interface GrouponItemListtData {
    records: GrouponItem[];
    total: number;
}

export interface GrouponItem {
    grouponPromotionItemId: number;
    productId: number;
    minGrouponPrice: number;
    productName: string;
    productPrice: number;
    picThumb: string;
    picUrl: string;
    joinNumCount: number;
    startTime: string;
    endTime: string;
    minGroupNum: number;
}

/**
 * 拼团活动商品列表接口
 */
export interface GrouponItemListParams {
    page: number;
    size: Number;
    sortField: string;
    keyword: string;
    sortOrder: string;
    grouponPromotionId?: number;
}

export interface JoiningGrouponPromotionDetail {
    addTime: number;
    groupPrice: string;
    grouponDetailId: number;
    grouponPromotionId: number;
    grouponPromotionItemId: number;
    isJoin: number;
    limitNum: number;
    productId: number;
    skuId: number;
}

export interface JoiningActivityDetail {
    endTime: string;
    expirationTime: number;
    groupNums: any[];
    groupSuccessCount: number;
    groupType: number;
    grouponExplain: string;
    grouponImage: string;
    grouponPromotionDetails: JoiningGrouponPromotionDetail[];
    grouponPromotionId: number;
    grouponPromotionItemId: number;
    isAutoGroup: number;
    joinNumCount: number;
    minGroupNum: number;
    minGrouponPrice: number;
    name: string;
    orderLimitNum: number;
    productId: number;
    productSn: string;
    shareImage: string;
    shopId: number;
    startTime: string;
}

/**
 * 获取可参加的拼团活动详情接口返回数据
 */
export interface JoiningActivityResponse {
    data: JoiningActivityDetail;
    code: number;
    message: string;
}

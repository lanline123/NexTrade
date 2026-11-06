/**
 * 抽奖活动类型定义
 */

/** 装修配置 */
export interface DecorateConfig {
    /** 背景图片URL */
    bgImage: string;
    /** 背景颜色 */
    bgColor: string;
    /** 奖品入口图（左上角奖品按钮图），装修可配，缺省回退默认图 */
    prizeEntryImage?: string;
    /** 是否显示中奖名单: 0-否, 1-是 */
    showWinnerList: number;
    /** 玩法规则(富文本) */
    activityRules: string;
}

/** 九宫格位置配置 */
export interface GridPosition {
    /** 位置(1-8) */
    position: number;
    /** 奖品ID(为空表示未中奖位置) */
    prizeId: number | null;
    /** 中奖概率(0-100) */
    probability: number;
    /** 奖品名称 */
    prizeName: string;
    /** 奖品图片 */
    prizeImage: string;
    /** 奖品类型: 0-未中奖, 1-积分, 2-商品, 3-优惠券 */
    prizeType: number;
    /** 奖品值 */
    prizeValue: string;
}

/** 活动信息 */
export interface LotteryInfo {
    /** 活动ID */
    activityId: number;
    /** 活动名称 */
    activityName: string;
    /** 活动开始时间 */
    startTime: string;
    /** 活动结束时间 */
    endTime: string;
    /** 每次消耗积分 */
    costPoints: number;
    /** 装修配置 */
    decorateConfig: DecorateConfig;
    /** 未中奖名称 */
    noWinName: string;
    /** 未中奖图片URL */
    noWinImage: string;
    /** 未中奖提示语 */
    noWinTips: string;
    /** 九宫格配置(8个位置) */
    gridConfig: GridPosition[];
    /** 用户当前积分 */
    userPoints: number;
    /** 今日剩余次数 */
    todayRemaining: number;
    /** 总剩余次数 */
    totalRemaining: number;
    /** 可中奖剩余次数 */
    winRemaining: number;
}

/** 获取抽奖活动信息响应 */
export interface LotteryInfoResponse {
    data: LotteryInfo;
    code: number;
    message: string;
}

/** 抽奖结果 */
export interface DrawResult {
    /** 是否中奖 */
    isWin: boolean;
    /** 奖品ID(未中奖为0) */
    prizeId: number;
    /** 奖品名称 */
    prizeName: string;
    /** 奖品类型: 0-未中奖, 1-积分, 2-商品, 3-优惠券 */
    prizeType: number;
    /** 奖品值(积分数量/商品ID/优惠券ID) */
    prizeValue: string;
    /** 奖品图片URL */
    prizeImage: string;
    /** 中奖位置(1-8，用于前端动画定位) */
    position: number;
    /** 今日剩余次数 */
    todayRemaining: number;
    /** 总剩余次数 */
    totalRemaining: number;
    /** 抽奖记录ID */
    recordId: number;
}

/** 执行抽奖响应 */
export interface DrawResultResponse {
    data: DrawResult;
    code: number;
    message: string;
}

/** 中奖记录 */
export interface PrizeRecord {
    /** 记录ID */
    recordId: number;
    /** 活动名称 */
    activityName: string;
    /** 奖品名称 */
    prizeName: string;
    /** 奖品类型: 0-未中奖, 1-积分, 2-商品, 3-优惠券 */
    prizeType: number;
    /** 奖品图片 */
    prizeImage: string;
    /** 状态: 0-未领取, 1-已领取, 2-已过期 */
    status: number;
    /** 状态文本 */
    statusText: string;
    /** 中奖时间(秒级时间戳) */
    createTime: number;
    /** 领取时间(秒级时间戳) */
    receiveTime: number | null;
    /** 奖品值 */
    prizeValue: string;
}

/** 中奖记录分页数据 */
export interface PrizeRecordPage {
    records: PrizeRecord[];
    total: number;
    current: number;
    size: number;
    pages: number;
}

/** 获取中奖记录响应 */
export interface PrizeRecordPageResponse {
    data: PrizeRecordPage;
    code: number;
    message: string;
}

/** 获取中奖记录参数 */
export interface GetRecordsParams {
    /** 页码，默认1 */
    page?: number;
    /** 每页条数，默认10 */
    size?: number;
    /** 奖品状态: 0-未领取, 1-已领取, 2-已过期 */
    status?: number;
}

/** 确认领取商品奖品参数 */
export interface ConfirmReceiveParams {
    /** 中奖记录ID */
    recordId: number;
    /** 订单ID */
    orderId: number;
}

/** 九宫格单元格（前端渲染用） */
export interface GridCell {
    /** 索引 */
    index: number;
    /** 位置(1-8, -1表示中间抽奖按钮) */
    position: number;
    /** 是否是中间抽奖按钮 */
    isCenter: boolean;
    /** 奖品ID */
    prizeId: number | null;
    /** 奖品名称 */
    prizeName?: string;
    /** 奖品图片 */
    prizeImage?: string;
    /** 奖品类型 */
    prizeType?: number;
}

/** 中奖名单项 */
export interface LotteryWinner {
    /** 用户昵称（脱敏后，如：张**、138****8888） */
    nickname: string;
    /** 用户头像URL */
    avatar: string;
    /** 奖品名称 */
    prizeName: string;
    /** 奖品图片URL */
    prizeImage: string;
    /** 奖品类型: 1-积分, 2-商品, 3-优惠券 */
    prizeType: number;
    /** 中奖时间(秒级时间戳) */
    winTime: number;
}

/** 获取中奖名单响应 */
export interface LotteryWinnersResponse {
    data: LotteryWinner[];
    code: number;
    message: string;
}

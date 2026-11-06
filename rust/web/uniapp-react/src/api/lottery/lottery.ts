import request from "@/utils/request";
import type {
    LotteryInfoResponse,
    DrawResultResponse,
    PrizeRecordPageResponse,
    GetRecordsParams,
    ConfirmReceiveParams,
    LotteryWinnersResponse
} from "@/types/lottery/lottery";

/**
 * 获取抽奖活动信息
 * @returns 抽奖活动信息
 */
export const getLotteryInfo = () => {
    return request<LotteryInfoResponse>({
        url: "promotion/lottery/info",
        method: "get"
    });
};

/**
 * 执行抽奖
 * @returns 抽奖结果
 */
export const drawLottery = () => {
    return request<DrawResultResponse>({
        url: "promotion/lottery/draw",
        method: "post"
    });
};

/**
 * 获取中奖记录
 * @param params 分页参数
 * @returns 中奖记录列表
 */
export const getMyRecords = (params: GetRecordsParams) => {
    return request<PrizeRecordPageResponse>({
        url: "promotion/lottery/myRecords",
        method: "get",
        params
    });
};

/**
 * 确认领取商品奖品
 * @param data 领取参数
 * @returns 领取结果
 */
export const confirmReceive = (data: ConfirmReceiveParams) => {
    return request({
        url: "promotion/lottery/confirmReceive",
        method: "post",
        data
    });
};

/**
 * 获取中奖名单
 * @param activityId 活动ID（可选，不传则查询当前进行中的活动）
 * @returns 中奖名单列表
 */
export const getWinners = (activityId?: number) => {
    return request<LotteryWinnersResponse>({
        url: "promotion/lottery/winners",
        method: "get",
        params: activityId ? { activityId } : {}
    });
};

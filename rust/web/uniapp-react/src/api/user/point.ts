import request from "@/utils/request";
import type { PointFilterParams, PointFilterResult } from "@/types/user/point";

/**
 * @description 获取积分变动记录列表
 * @param params 筛选条件
 * @returns 积分记录列表
 */
export const getPointList = (params: object) => {
    return request<PointFilterResult>({
        url: "user/pointsLog/list",
        method: "get",
        params
    });
};

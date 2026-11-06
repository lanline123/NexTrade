import request from "@/utils/request";
import type { SeckillFilterResult } from "@/types/seckill/seckill";

/**
 * @description 获取秒杀活动列表
 * @param params 筛选条件
 * @returns 秒杀活动及商品
 */
export const getSeckill = (params: any) => {
    return request<SeckillFilterResult>({
        url: "home/home/getSeckill",
        method: "get",
        params
    });
};

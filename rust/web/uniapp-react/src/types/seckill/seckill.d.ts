// 获取列表返回参数类型
export interface SeckillFilterState {
    productId: number;
    seckillLimitNum: number;
    seckillSales: number;
    productName: string;
    picThumb: string;
    productSn: string;
    marketPrice: string;
    seckillPrice: string;
    seckillStock: number;
    skuId: number;
    shopId: number;
    // 二期会员标签（D1096）：false 时秒杀正常展示但置灰抢购并提示
    canJoin?: boolean;
    restrictTip?: string;
}

export interface SeckillFilterResult {
    data: SeckillData;
    code: number;
    message: string;
}

export interface SeckillData {
    records: SeckillFilterState[];
    total: number;
}

import type { SkuList } from "@/types/product/product";

// 列表查询时筛选参数类型
export interface CollectProductFilterParams {
    page: number;
    size: number;
    keyword?: string;
}

export interface CollectProductResponse {
    data: CollectProductData;
    code: number;
    message: string;
}

export interface CollectProductData {
    records: CollectProductList[];
    total: number;
}
export interface CollectProductList {
    collectId: number;
    productStock: number;
    userId?: number;
    productId: number;
    addTime?: string;
    isAttention?: number;
    productName?: string;
    productSn?: string;
    picThumb: string;
    marketPrice?: string;
    isPromote?: number;
    promotePrice?: string;
    promoteStartDate?: string;
    promoteEndDate?: string;
    username?: string;
    rankId?: number;
    discount?: number;
    userPrice?: string;
    productPrice?: string;
    productSku?: SkuList[];
    price?: string;
}

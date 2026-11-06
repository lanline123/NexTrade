import type { LinkType } from "@/types/decorate/decorate";
// 列表查询时筛选参数类型
export interface MobileCatNavFilterParams {
    page?: number;
    size?: number;
    sortField?: string;
    sortOrder?: string;
    paging?: number;
    isShow?: number;
}

// 获取列表返回参数类型
export interface MobileCatNavFilterState {
    mobileCatNavId: number;
    categoryName?: string;
    isShow?: boolean;
    sortOrder?: number;
}

export interface MobileCatNavFilterResult {
    data: MobileCatNavData;
    code: number;
    message: string;
}

export interface MobileCatNavData {
    records: MobileCatNavFilterState[];
    filter: MobileCatNavFilterParams;
    total: number;
}

// 获取详情返回参数类型
export interface MobileCatNavFormState {
    id?: number;
    categoryId?: number;
    catColor?: string;
    imgUrl?: any[];
    childCatIds?: number[];
    brandIds: any[];
    isShow?: number;
    sortOrder?: string;
}

export interface MobileCatNavFormResult {
    item: MobileCatNavFormState;
}

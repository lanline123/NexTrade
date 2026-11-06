import type { ArticleFilterState } from "@/types/article/article";

export interface CategoryFilterParams {
    page: number;
    size: number;
    sortField?: string;
    sortOrder?: string;
    keyword?: string;
    categorySn?: string;
}

// 获取列表返回参数类型
export interface CategoryFilterState {
    articleCategoryId?: number;
    parentId?: number;
    articleId?: number;
    articleCategoryName?: string;
    categorySn?: string;
    children?: CategoryFilterState[];
    articleChildren?: ArticleFilterState[];
    articles: ArticleFilterState[];
}
//详情参数
export interface CategoryFormState {
    consignee?: string;
    regionIds?: number[];
    region_name?: string;
    addressId?: number;
    address?: string;
    email?: string;
    telephone?: string;
    mobile?: string;
}
export interface CategoryFilterResult {
    data: CategoryData;
    code: number;
    message: string;
}

export interface CategoryData {
    records: CategoryFilterState[];
    filter: CategoryFilterParams;
    total: number;
}

export interface CategoryFormResult {
    item: CategoryFormState;
}

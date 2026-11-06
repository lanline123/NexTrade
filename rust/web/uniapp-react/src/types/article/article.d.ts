// 列表查询时筛选参数类型
import type { ProductItem } from "@/types/product/product";

export interface ArticleFilterParams {
    page: number;
    size?: number;
    categorySn: string;
}

// 获取列表返回参数类型
export interface ArticleFilterState {
    articleId: number;
    articleCategoryId: number;
    articleTitle: string;
    addTime: string;
    content: string;
    articleThumb: string;
    articleTag: string;
    description: string;
    link: string;
}

export interface ArticleFilterResult {
    code: number;
    data: ArticleData;
    message: string;
}

export interface ArticleData {
    records: ArticleFilterState[];
    filter: ArticleFilterParams;
    total: number;
}

export interface ArticleFormState {
    articleTitle?: string;
    addTime?: string;
    content?: string;
    articleThumb?: string;
    product_list?: ProductItem[];
    next?: prevAndNext;
    prev?: prevAndNext;
}
export interface prevAndNext {
    articleId?: number;
    articleTitle?: string;
}

export interface ArticleFormResult {
    item: ArticleFormState;
    next: object;
    prev: object;
}

export interface ArticleDetailParams {
    id?: number | string;
    articleSn?: string;
}

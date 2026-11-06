import type { ProductData } from "@/types/product/product";

/* 分类树结构 */
export interface DataResponse {
    item: ProductData["item"];
    descArr: ProductData["descArr"];
    skuList: any[];
    picList: ProductData["picList"];
    attrList: ProductData["attrList"];
    rankDetail: ProductData["rankDetail"];
    code: number;
    message: string;
}

export interface filterSeleted {
    categoryId: number;
    categoryName: string;
    keywords?: string;
    categoryDesc?: string;
    nparentId?: number;
    sortOrder?: number;
    measureUnit?: string;
    isShow?: number;
    seoTitle?: string;
    shortName?: string;
    categoryPic?: string;
    categoryIco?: number;
    isHot?: number;
    searchKeywords?: string;
    children?: filterSeleted[];
}

export interface SearchFilterResult {
    data: filterSeleted[];
    code: number;
    message: string;
}

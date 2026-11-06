export interface filterSeleted {
    categoryId?: number;
    categoryName?: string;
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

export interface ProductFilterParams {
    page: number;
    size: number;
    sort?: string;
    order?: string;
    max?: number | string | null;
    min?: number | string | null;
    keyword?: string;
    cat?: number;
    brand?: string | number[];
    attrs?: attrsData[];
    intro?: string;
    couponId?: number;
    shopId?: number;
    shopCategoryId?: number;
    pageType?: string;
}
export interface CouponProductParams {
    page: number;
    size: number;
    sort?: string;
    order?: string;
    keyword?: string;
    couponId?: number;
}

export interface ProductFilterResult {
    data: ProductFilteData;
    message: string;
    code: number;
}

export interface ProductFilteData {
    productList: ProductList[];
    filter: {
        brand?: Brand[];
        category: filterSeleted[];
        shopCategory: filterSeleted[];
        maxPrice?: number | string;
        max_price?: number | string;
    };
    filterSelected: any;
    total: number;
}

export interface Brand {
    brandId: number;
    brandName?: string;
    brandLogo?: string;
    isShow?: number;
}

export interface ProductList {
    productId?: number;
    picThumb?: string;
    picUrl?: string;
    productName?: string;
    checkStatus?: number;
    shopId?: number;
    suppliersId?: number;
    productType?: number;
    productSn?: string;
    productPrice?: number;
    marketPrice?: number;
    productStatus?: number;
    isBest?: number;
    isNew?: number;
    isHot?: number;
    productStock?: number;
    sortOrder?: number;
    seckillPrice?: number;
    orgProductPrice?: number;
    isCheck?: boolean;
    price: string;
}

export interface ProductListResponse {
    data: ProductListData;
    code: number;
    message: string;
}

export interface ProductListData {
    records: Record[];
    total: number;
    size: number;
    current: number;
    optimizeCountSql: OptimizeCountSQL;
    searchCount: OptimizeCountSQL;
    pages: number;
}

export interface OptimizeCountSQL {}

export interface Record {
    categoryId: number;
    brandId: number;
    productTsn: string;
    marketPrice: number;
    shippingTplId: number;
    freeShipping: number;
    productId: number;
    picUrl: string;
    picThumb: string;
    productName: string;
    checkStatus: number;
    checkReason: string;
    shopId: number;
    suppliersId: number;
    productType: number;
    productSn: string;
    productPrice: number;
    productStatus: number;
    isBest: number;
    isNew: number;
    isHot: number;
    productStock: number;
    sortOrder: number;
    productSku: ProductSku[];
    shop: Shop | null;
    isCheck: boolean;
}

export interface ProductSku {
    skuId: number;
    productId: number;
    skuValue: string;
    skuData: SkuDatum[];
    skuSn: string;
    skuStock: number;
    skuTsn: string;
    skuPrice: string;
}

export interface SkuDatum {
    name: string;
    value: string;
}

export interface Shop {
    shopId: number;
    shopTitle: string;
    addTime: number;
    shopLogo: string;
    clickCount: number;
    status: number;
    merchantId: number;
    shopMoney: number;
    frozenMoney: number;
    contactMobile: string;
    description: string;
    kefuPhone: string;
    kefuWeixin: string;
    kefuLink: string;
    isContactKefu: number;
    kefuInlet: string;
}
export interface attrsData {
    attrName: string;
    attrValue: string[];
}

export interface attrsListData {
    name: string;
    values: attrsValueData[];
}
interface attrsValueData {
    value: string;
    count: number;
}

export interface ShopDetailResponse {
    data: ShopDetailItem;
    code: number;
    message: string;
}

export interface ShopDetailItem {
    statusText: string;
    shopId: number;
    shopTitle: string;
    addTime: string;
    shopLogo: string;
    clickCount: null;
    status: number;
    merchantId: number;
    shopMoney: null;
    frozenMoney: null;
    contactMobile: string;
    description: string;
    productCount: number;
    newProductCount: number;
    collectShop: boolean;
    kefuPhone: string;
    kefuInlet: any[];
    collectCount?: number;
    shopStar?: number;
    productScore?: number;
    /** 已通过合规快照的营业执照图；空串或 null 表示前台不公示 */
    businessLicensePic?: string | null;
}

export interface ShopCategoryResponse {
    data: ShopCategoryList[];
    code: number;
    message: string;
}

export interface ShopCategoryList {
    categoryId: number;
    categoryName: string;
    parentId: number;
    isChecked?: boolean;
    children?: ShopCategoryList[];
}

export interface ShopGroupDetailResponse {
    data: ShopGroupDetail;
    code: number;
    message: string;
}

export interface ShopGroupDetail {
    groupId: number;
    shopType: number;
    groupName: string;
}

export interface shopListResponse {
    data: shopListData;
    code: number;
    message: string;
}

export interface shopListData {
    records: shopListItem[];
    total: number;
}

export interface shopListItem {
    statusText: string;
    shopId: number;
    shopTitle: string;
    addTime: string;
    shopLogo: string;
    clickCount: number;
    status: number;
    merchantId: number;
    shopMoney: string;
    frozenMoney: string;
    contactMobile: string;
    description: string;
    kefuPhone: string;
    kefuWeixin: string;
    kefuLink: string;
    isContactKefu: number;
    kefuInlet: any[] | null;
    collectCount: number;
    listingCount: number;
    listingProduct: shopListListingProduct[];
}

export interface shopListListingProduct {
    productId: number;
    productName: string;
    productSn: string;
    productTsn: string;
    productStock: number;
    productPrice: string;
    marketPrice: string;
    shippingTplId: number;
    productStatus: number;
    productType: number;
    categoryId: number;
    brandId: number;
    shopId: number;
    keywords: string;
    shopCategoryId: number;
    checkStatus: number;
    checkReason: string;
    clickCount: number;
    productWeight: string;
    isPromote: number;
    isPromoteActivity: number;
    promotePrice: string;
    promoteStartDate: string;
    promoteEndDate: string;
    seckillMaxNum: number;
    productBrief: string;
    productDesc: string;
    picUrl: string;
    picThumb: string;
    picOriginal: string;
    commentTag: null;
    freeShipping: number;
    integral: number;
    addTime: number;
    sortOrder: number;
    storeSortOrder: number;
    isDelete: number;
    isBest: number;
    isNew: number;
    isHot: number;
    lastUpdate: number;
    remark: string;
    giveIntegral: number;
    rankIntegral: number;
    suppliersId: number;
    virtualSales: number;
    limitNumber: number;
    productCare: string;
    productRelated: any[];
    productServiceIds: number[];
    isSupportReturn: number;
    isSupportCod: number;
    productVideo: string;
    prepayPrice: string;
}

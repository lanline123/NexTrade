export interface collectionShopResponse {
    data: collectionShopData;
    code: number;
    message: string;
}

export interface collectionShopData {
    records: collectionShopList[];
    total: number;
}

export interface collectionShopList {
    collectId: number;
    userId: number;
    shopId: number;
    addTime: string;
    shop: Shop;
    collectCount: number;
    productCount: number;
}

export interface Shop {
    statusText: string;
    shopId: number;
    shopTitle: string;
    addTime: string;
    shopLogo: string;
    clickCount: number | null;
    status: number;
    merchantId: number;
    shopMoney: string;
    frozenMoney: string;
    contactMobile: null | string;
    description: string;
    kefuPhone: null | string;
    kefuWeixin: null | string;
    kefuLink: null | string;
    hotProduct: HotProduct[];
    newProduct: any[];
    bestProduct: any[];
    tipNames: any[];
}

export interface HotProduct {
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
    commentTag: string;
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

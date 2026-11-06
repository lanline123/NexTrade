export interface SalesmanProductListResponse {
    data: SalesmanProductListData;
    code: number;
    message: string;
}

export interface SalesmanProductListData {
    records: SalesmanProductListFilterResult[];
    filter: SalesmanProductListFilter;
    total: number;
}

export interface SalesmanProductListFilter {
    productName: string;
    page: number;
    sortField: string;
    sortOrder: string;
    size: number;
    userId: number;
}

export interface SalesmanProductListFilterResult {
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
    productRelated: number[] | null;
    productServiceIds: number[] | null;
    isSupportReturn: number;
    isSupportCod: number;
    productVideo: string;
    prepayPrice: string;
    salesmanProductId: number | null;
    isJoin: number | null;
    commissionType: number | null;
    commissionData: null | string;
    updateTime: null;
    finalCommissionPrice: null | string;
    salesmanProduct: SalesmanProduct | null;
    pics: any[];
}


// 详情
export interface SalesmanProductDetailResponse {
    data: SalesmanProductDetailItem;
    code: number;
    message: string;
}

export interface SalesmanProductDetailItem {
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
    salesmanProductId: number;
    isJoin: number;
    commissionType: number;
    commissionData: string;
    updateTime: null;
    finalCommissionPrice: string;
    pics: Pic[];
    salesmanProduct: SalesmanProduct;
}

export interface Pic {
    picId: number;
    productId: number;
    picUrl: string;
    picDesc: string;
    picThumb: string;
    picOriginal: string;
    picLarge: string;
    sortOrder: number;
}

export interface SalesmanProduct {
    salesmanProductId: number;
    productId: number;
    isJoin: number;
    commissionType: number;
    commissionData: string;
    addTime: null;
    updateTime: null;
    shopId: number | null;
}

// 分销订单
export interface OrderListResponse {
    data: OrderListData;
    code: number;
    message: string;
}

export interface OrderListData {
    records: OrderListFilterResult[];
    filter: OrderListFilter;
    total: number;
}

export interface OrderListFilter {
    page: number;
    sortField: string;
    sortOrder: string;
    size: string;
    orderTimeStart: string;
    orderTimeEnd: string;
    keyword: string;
    salesmanId: number;
}

export interface OrderListFilterResult {
    statusText: string;
    salesmanOrderId: number;
    orderId: number;
    salesmanId: number;
    amount: string;
    status: number;
    addTime: string;
    itemId: number;
    salesmanProductData: OrderListSalesmanProductData;
    orderAmount: string;
    salesmanSettlementData: null;
    settlementTime: number;
    userOrder: OrderListUserOrder;
    userOrderItem: OrderListUserOrderItem;
    userOrderRefund: null;
}

export interface OrderListSalesmanProductData {
    salesmanProductId: number;
    productId: number;
    isJoin: number;
    commissionType: number;
    commissionData: number;
    addTime: null;
    updateTime: null;
    shopId: null;
}

export interface OrderListUserOrder {
    orderId: number;
    orderSn: string;
    userId: number;
    parentOrderId: number;
    parentOrderSn: string;
    orderStatus: number;
    shippingStatus: number;
    payStatus: number;
    addTime: string;
    consignee: string;
    address: string;
    regionIds: string;
    regionNames: string;
    addressData: string;
    mobile: string;
    email: string;
    buyerNote: string;
    adminNote: string;
    shippingMethod: number;
    logisticsId: number;
    logisticsName: string;
    shippingTypeId: number;
    shippingTypeName: string;
    trackingNo: string;
    shippingTime: string;
    receivedTime: string;
    payTypeId: number;
    payTime: string;
    usePoints: number;
    isNeedCommisson: number;
    distributionStatus: number;
    referrerUserId: number;
    isDel: number;
    shopId: number;
    isStoreSplited: number;
    commentStatus: number;
    totalAmount: string;
    paidAmount: string;
    unpaidAmount: string;
    unrefundAmount: string;
    productAmount: string;
    couponAmount: string;
    pointsAmount: string;
    discountAmount: string;
    balance: string;
    onlinePaidAmount: string;
    offlinePaidAmount: string;
    serviceFee: string;
    shippingFee: string;
    invoiceFee: string;
    orderExtension: string;
    orderSource: string;
    invoiceData: string;
    outTradeNo: string;
    isSettlement: number;
}

export interface OrderListUserOrderItem {
    itemId: number;
    orderId: number;
    orderSn: string;
    userId: number;
    price: string;
    quantity: number;
    productId: number;
    productName: string;
    productSn: string;
    picThumb: string;
    skuId: number;
    skuData: string;
    deliveryQuantity: number;
    productType: number;
    isGift: number;
    shopId: number;
    isPin: number;
    prepayPrice: string;
    commission: string;
    originPrice: string;
}

// 赚钱攻略
export interface SalesmanContentListResponse {
    data: SalesmanContentListData;
    code: number;
    message: string;
}

export interface SalesmanContentListData {
    records: SalesmanContentListFilterResult[];
    filter: SalesmanContentListFilter;
    total: number;
}

export interface SalesmanContentListFilter {
    page: string;
    size: string;
    sortField: string;
    sortOrder: string;
    from: string;
}

export interface SalesmanContentListFilterResult {
    statusText: string;
    id: number;
    title: string;
    img: string;
    startTime: string;
    endTime: string;
    describe: string;
    isTop: number;
    content: string;
    isAvailable: number;
    shopId: number;
}

// 素材类型
export interface MaterialCategoryResponse {
    data: MaterialCategoryItem[];
    code: number;
    message: string;
}

export interface MaterialCategoryItem {
    categoryId: number | null;
    categoryName: string;
    addTime?: string;
    shopId?: null;
}
// 素材列表
export interface MaterialListResponse {
    data: MaterialListData[];
    code: number;
    message: string;
}

export interface MaterialListData {
    records: MaterialListFilterResult[];
    total: number;
}

export interface MaterialListFilterResult {
    id: number;
    addTime: number;
    isTop: number;
    content: string;
    isAvailable: number;
    shopId: number;
    pics: MaterialListPic[];
    categoryId: number;
    shareNum: number;
    product: AnyObject;
    productId: number;
}

export interface MaterialListPic {
    picId: number;
    picThumb: string;
    picUrl: string;
    picName: string;
}

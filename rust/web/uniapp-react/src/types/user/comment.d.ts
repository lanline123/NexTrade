// 列表查询时筛选参数类型
export interface CommentFilterParams {
    page: number;
    size: number;
}

// 获取列表返回参数类型
export interface CommentFilterState {
    orderId: number;
    productSn?: number;
    consignee: string;
    addTime: string;
    shippingFee: string;
    payStatusName: string;
    totalAmount?: string;
    unpaidAmount?: string;
    orderStatus?: number;
    payTypeId?: number;
    orderSn?: string;
    isShow?: boolean;
    items?: ProductItems[];
    invoiceData?: InvoiceData;
    commentRank?: number;
    productId?: number;
    commentTag?: string[];
    picThumb?: string;
    productName?: string;
    content?: string;
    commentId?: number;
    replies?: ReplyObject[];
    skuData: any[];
    showPics: any[];
}
export interface ReplyObject {
    commentId: number;
    userId: number;
    username: string;
    content: string;
    addTime: string;
    parentId: number;
}
export interface InvoiceData {
    status: number;
}

export interface ProductItems {
    picThumb: string;
    productName: string;
    skuData: string;
    productSn: string;
    productId: number;
    quantity: number;
    price: string;
    subtotal: string;
}

export interface CommentFilterResult {
    records: CommentFilterState[];
    filter: CommentFilterParams;
    total: number;
}

export interface subNumFilterResult {
    awaitComment?: number;
    showPics?: number;
    commented?: number;
}

export interface CommentEditFormData {
    productId: number;
    orderId: number;
    orderItemId: number;
    shopId: number;
    commentRank: number;
    commentTag: string[];
    content: string;
    showPics: any[];
}

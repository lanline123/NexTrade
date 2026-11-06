export interface afterSaleEditParams {
    itemId?: number | null;
    orderId: number;
}

export interface afterSaleEditResponse {
    data: AfterSaleEditData;
    code: number;
    message: string;
}

export interface AfterSaleEditData {
    list: List[];
    order: Order;
}

export interface List {
    itemId: number;
    picThumb: string;
    productSn: string;
    productName: string;
    price: string;
    quantity: number;
    subtotal: string;
    canApplyQuantity: number;
    number?: number;
}

export interface Order {
    orderStatusName: string;
    userAddress: string;
    shippingStatusName: string;
    payStatusName: string;
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
    regionIds: number[];
    regionNames: string[];
    addressData: null;
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
    distributionStatus: number;
    promoterUserId: number;
    isDel: number;
    shopId: number;
    shopTitle: string;
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
    orderExtension: OrderExtension;
    orderSource: string;
    invoiceData: InvoiceData;
    outTradeNo: string;
    username: string;
    availableActions: { [key: string]: boolean };
    stepStatus: StepStatus;
    items: Item[];
}

export interface InvoiceData {
    invoiceType: number;
    titleType: number;
    companyCode: string;
    companyName: string;
    companyAddress: string;
    companyPhone: string;
    companyBank: string;
    companyAccount: string;
    invoiceContent: string;
    amount: string;
    mobile: string;
    email: string;
    userId: number;
    status: number;
    orderId: number;
}

export interface Item {
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
    skuData: any[];
    deliveryQuantity: number;
    productType: number;
    isGift: number;
    shopId: number;
    isPin: number;
    prepayPrice: string;
    productPicThumb: string;
    productStock: number;
    productWeight: string;
    skuStock: null;
    skuSn: null;
    skuValue: null;
    stock: number;
    subtotal: number;
    aftersalesItem: null;
}

export interface OrderExtension {
    couponMoney: CouponMoney;
    coupon: Coupon;
    shippingFee: number[];
    shippingType: ShippingType[];
}

export interface Coupon {
    "0": number[];
    "1": number[];
}

export interface CouponMoney {
    "0": number;
    "1": number;
}

export interface ShippingType {
    typeId: number;
    typeName: string;
}

export interface StepStatus {
    current: number;
    status: string;
    steps: Step[];
}

export interface Step {
    title: string;
    description: string;
}

export interface afterSaleInfoResponse {
    data: afterSaleInfoItem;
    code: number;
    message: string;
}

export interface afterSaleInfoItem {
    aftersalesTypeName: string;
    statusName: string;
    userName: string;
    shippingTime: string;
    aftersaleId: number;
    aftersaleType: number;
    status: number;
    pics: any[];
    description: string;
    reply: string;
    refund: any;
    addTime: string;
    trackingNo: string;
    logisticsName: string;
    returnAddress: null;
    aftersaleReason: string;
    aftersalesSn: string;
    orderId: number;
    userId: number;
    refundAmount: string;
    canCancel: boolean;
    stepStatus: any;
    aftersalesItems: any;
    aftersalesLog: any;
    orders: AnyObject;
    returnGoodsTip: string;
}

export interface NegotiateResponse {
    data: NegotiateItem[];
    code: number;
    message: string;
}

export interface NegotiateItem {
    logId: number;
    aftersaleId: number;
    logInfo: string;
    addTime: string;
    adminName: string;
    refundMoney: string;
    refundType: number;
    refundDesc: string;
    userName: string;
    returnPic: null | ReturnPic[];
}
interface ReturnPic {
    picName: string;
    picThumb: string;
    picUrl: string;
}

// 售后申请列表
export interface AfterSaleListResponse {
    data: AfterSaleListData;
    code: number;
    message: string;
}

export interface AfterSaleListData {
    records: AfterSaleListFilterResult[];
    total: number;
}

export interface AfterSaleListFilter {
    page: string;
    size: string;
    sortField: string;
    sortOrder: string;
}

export interface AfterSaleListFilterResult {
    aftersalesTypeName: string;
    statusName: string;
    aftersaleId: number;
    aftersaleType: number;
    status: number;
    pics: string[];
    description: string;
    reply: string;
    addTime: string;
    trackingNo: string;
    logisticsName: string;
    returnAddress: null;
    aftersaleReason: string;
    aftersalesSn: string;
    orderId: number;
    userId: number;
    refundAmount: string;
    orderSn: string;
    aftersalesItems: AftersalesItem[];
}

export interface AftersalesItem {
    aftersalesItemId: number;
    orderItemId: number;
    number: number;
    aftersaleId: number;
    orderSn: string;
    productName: string;
    orderId: number;
    picThumb: string;
    productSn: string;
    productId: number;
    quantity: number;
    price: string;
}

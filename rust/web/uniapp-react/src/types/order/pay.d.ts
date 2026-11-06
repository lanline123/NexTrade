import type { OfflinePaymentClaim } from "./offlinePaymentClaim";

export interface payResponse {
    data: PayData;
    code: number;
    message: string;
}

export interface PayData {
    order: Order;
    paymentList: string[];
    offlinePaymentList: OfflinePaymentList;
    /** 拼团记录ID（存在时支付页会跳转到拼团详情） */
    grouponPromotionRecordId?: number;
    /** 会员优惠立减金额（挽留弹窗展示） */
    memberDiscountAmount?: string | number;
    /** 本单将赠送积分（挽留弹窗展示） */
    willSendPoints?: string | number;
}

export interface OfflinePaymentList {
    thirdPartyPaymentTransfer: string;
    offlinePayBank: string;
    offlinePayCompany: string;
    otherPaymentRemittance: string;
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
    /** 服务端计算的支付截止时间，仅待支付普通订单返回 */
    payEndTime?: string;
    /** 服务端当前时间，用于消除客户端时钟偏差 */
    serverTime?: string;
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
    offlinePaymentClaimStatus?: number | null;
    offlinePaymentClaimStatusName?: string;
    offlinePaymentClaimRejectReason?: string | null;
    offlinePaymentClaim?: OfflinePaymentClaim | null;
    availableActions?: { [key: string]: boolean };
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
    username: string;
    items: Item[];
    amount?: string;
    // 预售订单支付信息（存在时用于定金/尾款支付分流）
    presaleInfo?: import("@/types/presale/presale").OrderPresaleInfo;
    /** 会员优惠立减金额（挽留弹窗展示） */
    memberDiscountAmount?: string | number;
    /** 本单将赠送积分（挽留弹窗展示） */
    willSendPoints?: string | number;
}

export interface InvoiceData {
    titleType: number;
    invoiceType: number;
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

export interface creatPayParams {
    id: number;
    type: string;
    code?: number;
}

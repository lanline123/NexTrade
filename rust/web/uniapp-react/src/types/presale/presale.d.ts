export interface PresaleInfo {
    presaleId: number;
    productId: number;
    saleMode: number;
    saleModeText: string;
    depositType: number;
    depositValue: number;
    depositAmount: number;
    isRoundDown: number;
    finalPaymentRelativeDays: number;
    finalPaymentDurationDays?: number;
    finalPaymentDurationHours?: number;
    deliveryType: number;
    deliveryDays?: number;
    deliveryRelativeDays?: number;
    deliveryRelativeHours?: number;
    deliveryDate?: string;
    status: number;
    addTime?: number;
    updateTime?: number;
    finalPaymentAmount?: number;
    presaleStatus?: number;
    finalPaymentType: number;
    finalPaymentStartTimeText: string;
    finalPaymentStartTime: string;
    finalPaymentEndTime: string;
}

export interface OrderPresaleInfo {
    presaleOrderId?: number;
    orderId: number;
    orderSn?: string;
    productId?: number;
    depositAmount: number;
    finalPaymentAmount: number;
    depositPaidTime?: number;
    finalPaymentStartTime: number;
    finalPaymentPaidTime?: number;
    presaleStatus: number;
    presaleStatusText: string;
    canPayFinalPayment: boolean;
    deliveryDays?: number;
    deliveryDate?: number;
    // 部分接口会额外带上商品预售信息（用于展示尾款/发货时间文案）
    productPresale?: PresaleInfo;
    // 部分接口会直接带 saleMode（与商品 presaleInfo.saleMode 对齐）
    saleMode?: number;
}

export interface PresalePaymentConfig {
    payLogId: number;
    orderId: number;
    orderSn: string;
    orderAmount: number;
    payType: string;
    payConfig?: {
        appId?: string;
        timeStamp?: string;
        nonceStr?: string;
        package?: string;
        signType?: string;
        paySign?: string;
        orderString?: string;
    };
    payStatus?: number;
}

export interface PresalePaymentConfigResponse {
    data: PresalePaymentConfig;
    code: number;
    message: string;
}

export enum PresalePaymentStatus {
    UNPAID = 0,
    PAID = 1,
    PAYING = 2
}

export enum PresaleStatus {
    WAIT_DEPOSIT = 0,
    WAIT_FINAL = 1,
    COMPLETED = 2
}

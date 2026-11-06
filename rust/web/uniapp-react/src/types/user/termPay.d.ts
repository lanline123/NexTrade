export interface UserCreditDetailResponse {
    data: UserCreditDetailVO;
    code: number;
    message: string;
}

export interface UserCreditDetailVO {
    creditLimit: number | string;
    usedAmount: number | string;
    availableAmount: number | string;
    settlementType: number; // 1-月结，2-季结
    settlementDays: number; // 30 or 90
    remainingDays: number;
    pendingOrders: UserCreditOrderItem[];
    settledOrders: UserCreditOrderItem[];
}

export interface UserCreditOrderItem {
    orderId: number;
    orderSn: string;
    orderTime: string;
    creditAmount: number | string;
    totalQuantity: number;
    settlementStatus: number; // 0-未结算，1-已结算，2-已取消，3-退款中
    settlementStatusText: string;
    riskStatus: number; // 0-正常，1-逾期
    riskStatusText: string;
    items: UserCreditOrderProductItem[];
}

export interface UserCreditOrderProductItem {
    productId: number;
    productName: string;
    picThumb: string;
    quantity: number;
    /** 规格文本（可能包含 '|' 分隔） */
    skuValue?: string;
    price?: number | string;
}

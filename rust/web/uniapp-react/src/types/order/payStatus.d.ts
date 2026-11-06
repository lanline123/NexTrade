export interface PayLogResponse {
    code: number;
    message: string;
    data: PayLogData;
}

export interface PayStatusResponse {
    code: number;
    message: string;
    data: number;
}

export interface PayLogData {
    paylogId: number;
    paySn: string;
    payName: string;
    orderId: number;
    orderSn: string;
    orderAmount: string;
    orderType: number;
    payAmount: string;
    payStatus: number;
    payCode: string;
    addTime: Date;
    transactionId: string;
    notifyData: string;
    refundAmount: string;
    tokenCode: string;
    orderReservation?: any;
}

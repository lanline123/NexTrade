export interface OfflinePaymentClaim {
    claimId: number;
    orderId: number;
    orderSn?: string;
    userId?: number;
    claimedAmount?: number | string;
    transferTime: number;
    payerName: string;
    payerAccount?: string;
    bankSerialNo: string;
    voucherUrls: string[];
    remark?: string;
    status: number;
    statusName?: string;
    auditRemark?: string | null;
    reviewAdminId?: number;
    reviewTime?: number;
    rejectReason?: string | null;
    addTime?: number;
    updateTime?: number;
}

export interface OfflinePaymentClaimSubmitParams {
    orderId: number;
    transferTime?: number;
    payerName?: string;
    payerAccount?: string;
    bankSerialNo?: string;
    voucherUrls: string[];
    remark?: string;
}

export interface OfflinePaymentClaimResponse { data: OfflinePaymentClaim | null; code: number; message: string; }
export interface OfflinePaymentClaimListResponse { data: OfflinePaymentClaim[]; code: number; message: string; }
export interface OfflinePaymentClaimSubmitResponse { data: { claimId: number }; code: number; message: string; }

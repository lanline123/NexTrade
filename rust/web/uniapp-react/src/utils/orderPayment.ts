interface OrderPaymentState {
    availableActions?: { toPay?: boolean };
    payTypeId?: number | string | null;
    offlinePaymentClaimStatus?: number | string | null;
    presaleInfo?: { saleMode?: number | string; presaleStatus?: number | string } | null;
}

/** 定金认款通过后允许继续付尾款，待审核和驳回仍使用原有认款入口。 */
export const canShowOrderPayment = (order: OrderPaymentState): boolean => {
    if (!order.availableActions?.toPay) return false;
    if (Number(order.payTypeId) !== 3) return true;

    const status = order.offlinePaymentClaimStatus;
    if (status === null || status === undefined) return true;

    return Number(status) === 1 && Number(order.presaleInfo?.saleMode) === 2 && Number(order.presaleInfo?.presaleStatus) === 1;
};
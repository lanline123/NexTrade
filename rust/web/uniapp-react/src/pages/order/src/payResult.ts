// 自旧 view/uniapp/src/pages/order/src/payResult.ts 原样移植（B3 交易链路第四批）
export type PayResultState = "loading" | "success" | "error";

export interface PayResultInfo {
    payStatus?: number;
    paylogId?: number;
    orderId?: number;
    orderType?: number;
    payAmount?: string | number | null;
    orderReservation?: unknown;
}

interface ResolvePayResultOptions<T extends PayResultInfo> {
    orderId: number;
    loadPayLog: (params: { id: number }) => Promise<T>;
    loadOrderPayStatus: (params: { id: number }) => Promise<number>;
}

export type PayResult<T extends PayResultInfo> = { state: "success"; info: T } | { state: "error"; error?: unknown };

const hasUsablePayResultInfo = (info: PayResultInfo | null | undefined): info is PayResultInfo => {
    if (!info) return false;

    return (
        info.payStatus !== undefined ||
        info.paylogId !== undefined ||
        info.orderId !== undefined ||
        info.orderType !== undefined ||
        info.payAmount !== undefined ||
        info.orderReservation !== undefined
    );
};

/**
 * 确认支付结果。
 * 在线支付优先使用成功流水；余额、零元等无流水场景再查询订单支付状态。
 */
export async function resolvePayResult<T extends PayResultInfo>({
    orderId,
    loadPayLog,
    loadOrderPayStatus
}: ResolvePayResultOptions<T>): Promise<PayResult<T>> {
    try {
        const info = await loadPayLog({ id: orderId });

        if (!hasUsablePayResultInfo(info)) {
            return { state: "error" };
        }

        if (info.payStatus === 1) {
            return { state: "success", info };
        }

        const orderPayStatus = await loadOrderPayStatus({ id: orderId });
        return orderPayStatus === 1 ? { state: "success", info } : { state: "error" };
    } catch (error) {
        return { state: "error", error };
    }
}

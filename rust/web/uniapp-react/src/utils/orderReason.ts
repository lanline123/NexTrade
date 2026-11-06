/**
 * 取消订单原因工具（自旧 utils/orderReason.mjs 原样移植为 TS）
 */
export const buildCancelOrderPayload = (id: number, reason?: string) => {
    const description = String(reason ?? "").trim();
    return description ? { id, description } : { id };
};

export const keepValidSelection = (selected: string, reasons: string[]) => (reasons.includes(selected) ? selected : "");
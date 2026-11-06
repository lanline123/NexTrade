export interface ProductSaleState {
    productStatus?: unknown;
    isDisabled?: boolean;
    sku?: { isEnabled?: number };
    saleStatus?: unknown;
    effectiveSaleStatus?: unknown;
}

export const isSaleProhibited = (item?: ProductSaleState | null): boolean => Number(item?.saleStatus ?? item?.effectiveSaleStatus ?? 1) === 0;

export const isProductUnavailable = (item?: ProductSaleState | null): boolean => isSaleProhibited(item) || Number(item?.productStatus ?? 1) === 0;

/** 保留商品原始上下架状态，只调整购买选择。 */
export const applyCartSaleState = <T extends { cartList?: Array<{ carts?: any[] }> }>(result: T): T => {
    for (const group of result.cartList ?? []) {
        for (const line of group.carts ?? []) {
            if (isProductUnavailable(line) || line.isDisabled || line.sku?.isEnabled === 0) {
                line.isDisabled = true;
                line.isChecked = false;
            }
        }
    }
    return result;
};

/** 消费端详情对不存在、下架、禁售统一返回该码。文案会随语言翻译，只认这个码。 */
export const PRODUCT_CLIENT_UNAVAILABLE = 5101;

export const isProductOfflineError = (error: unknown): boolean => {
    const result = error as { code?: unknown } | null;
    return Number(result?.code) === PRODUCT_CLIENT_UNAVAILABLE;
};

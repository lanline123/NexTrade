type ProductSoldOutLike = {
    productType?: unknown;
    deliveryMode?: unknown;
    deliveryType?: unknown;
};

interface ShouldShowSoldOutOptions {
    stockField?: string;
    isSubCard?: boolean;
}

/** 预约上门商品类型，对应结算 flowType 10 */
export const RESERVATION_HOME_PRODUCT_TYPE = 5;
/** 预约到店商品类型，对应结算 flowType 9 */
export const RESERVATION_STORE_PRODUCT_TYPE = 6;

export const isReservationProductType = (productType: unknown): boolean => {
    return [RESERVATION_HOME_PRODUCT_TYPE, RESERVATION_STORE_PRODUCT_TYPE].includes(Number(productType ?? 0));
};

export const getReservationFlowTypeByProductType = (productType: unknown): 9 | 10 | null => {
    const type = Number(productType ?? 0);
    if (type === RESERVATION_STORE_PRODUCT_TYPE) return 9;
    if (type === RESERVATION_HOME_PRODUCT_TYPE) return 10;
    return null;
};

type CartReservationLike = {
    carts?: Array<{ productType?: unknown } | null | undefined> | null;
} | null | undefined;

/** 从结算购物车识别预约到店/上门，礼品卡兑换(flowType=12)时仍需走预约时间 */
export const getCartReservationFlowType = (cartList?: CartReservationLike[] | null): 9 | 10 | null => {
    if (!cartList?.length) return null;
    for (const store of cartList) {
        for (const cart of store?.carts ?? []) {
            const reservationFlowType = getReservationFlowTypeByProductType(cart?.productType);
            if (reservationFlowType) return reservationFlowType;
        }
    }
    return null;
};

export const isSubCardReservationProduct = (
    item?: ProductSoldOutLike | null,
    isSubCard = Number(item?.deliveryMode) === 2 && Number(item?.deliveryType) === 2
): boolean => {
    return Boolean(isSubCard) && isReservationProductType(item?.productType);
};

export const shouldShowSoldOut = <T extends ProductSoldOutLike>(item?: T | null, options: ShouldShowSoldOutOptions = {}): boolean => {
    const { stockField = "productStock", isSubCard = Number(item?.deliveryMode) === 2 && Number(item?.deliveryType) === 2 } = options;
    const data = item as Record<string, unknown> | null | undefined;
    const stock = Number(data?.[stockField] ?? 0);
    return stock === 0 && !isSubCardReservationProduct(item, isSubCard);
};

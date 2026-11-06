export interface CheckResponse {
    code: number;
    message: string;
    data: CheckItem;
}
export interface CheckItem {
    addressList: AddressList[];
    availablePaymentType: AvailablePaymentType[];
    storeShippingType: Array<StoreShippingType[]>;
    cartList: CartList[];
    total: Total;
    // 预售商品的预售信息（若本次结算为预售单）
    productPresale?: import("@/types/presale/presale").PresaleInfo;
    balance: number;
    points: number;
    availablePoints: number;
    couponList: CouponList;
    /** 账期支付信息（非授信会员返回 null） */
    creditPaymentInfo?: CreditPaymentInfo | null;
    item: Item;
    code: number;
    message: string;
    tmplIds: [];
    useCouponIds: number[];
    selectUserCouponIds: number[];
    deliveryOption: DeliveryOption | null;
}

/** 账期支付信息（GET /api/order/check/index 新增字段） */
export interface CreditPaymentInfo {
    creditPaymentStatus?: number;
    canUseCredit: boolean;
    disableReason: string | null;
    creditLimit: number;
    usedAmount: number;
    availableAmount: number;
    settlementType: number;
    settlementTypeText: string;
    settlementDays: number;
    remainingDays: number;
}

export interface AddressList {
    regionName: string;
    addressId: number;
    addressTag: string;
    userId: number;
    consignee: string;
    email: string;
    regionIds: number[];
    regionNames: string[];
    address: string;
    postcode: string;
    telephone: string;
    mobile: string;
    isDefault: number;
    isSelected: number;
}

export interface AvailablePaymentType {
    typeId: number;
    typeName: string;
    disabled: boolean;
    disabledDesc: string;
    isShow: boolean;
}

export interface CartList {
    shopId: number;
    shopTitle: string;
    noShipping: number;
    carts: Cart[];
    gift: any[];
    isNotReachMinOrderAmount?: boolean;
    minOrderAmountDiff?: number;
}

export interface Cart {
    cartId: number;
    userId: number;
    productId: number;
    productSn: string;
    productName: string;
    picThumb: string;
    marketPrice: string;
    originalPrice: string;
    originPrice: string;
    quantity: number;
    skuId: number;
    skuData: any[];
    productType: number;
    isChecked: boolean;
    shopId: number;
    type: number;
    shopTitle: null;
    productWeight: string;
    shippingTplId: number;
    freeShipping: number;
    productStatus: number;
    price: string;
    stock: number;
    subtotal: number;
    isDisabled: boolean;
    activityInfo?: any;
    extraSkuData?: ExtraSkuData[];
    extraSkuAllData?: {
        extra: Extra[];
    };
}
export interface ExtraSkuData {
    attrName: string;
    attrValue: string;
    attrPrice: string;
    attributesId: number;
}

export interface Extra {
    attrName: string;
    attrList: ExtraSkuData[];
}

export interface CouponList {
    enableCoupons: EnableCoupon[];
    disableCoupons: DisableCoupon[];
}

export interface DisableCoupon {
    id: number;
    couponName: string;
    minOrderAmount: string;
    couponDesc: string;
    couponType: number;
    couponMoney: string;
    isGlobal: number;
    couponDiscount: number;
    shopId: number;
    endDate: string;
    couponId: number;
    disableReason: string;
    disabled: boolean;
    selected: boolean;
}

export interface EnableCoupon {
    id: number;
    couponName: string;
    couponDesc: string;
    minOrderAmount: string;
    couponType: number;
    couponMoney: number | string;
    isGlobal: number;
    couponDiscount: number;
    shopId: number;
    endDate: string;
    couponId: number;
    disableReason: string;
    disabled: boolean;
    selected: boolean;
    userCouponId: number;
}

export interface Item {
    addressId: number;
    shippingType: CheckoutShippingTypeMap;
    payTypeId: number;
    usePoint: number;
    useBalance: number;
    useCouponIds: number[];
    deliveryType: number;
}

export interface ShippingType {
    typeId: number;
    shopId: number;
    typeName: string;
}

export interface CheckoutShippingType extends ShippingType {
    pickupId?: number;
    pickupTitle?: string;
    expectPickupTime?: string;
    pickupTime?: string;
    pickupDateType?: number;
}

export type CheckoutShippingTypeMap = Record<string, CheckoutShippingType>;

export interface DeliveryPickupPoint {
    shopId: number;
    shopTitle: string;
}

export interface DeliveryPickupGroup {
    shopId: number;
    pickups?: DeliveryPickupPoint[] | null;
    products?: unknown[];
}

export interface ShopDeliveryDatum {
    shopId: number;
    distance: number | string | null;
    isOutOfRange: boolean;
}

export interface DeliveryOption {
    /** 配送能力分类：1 全选、2 部分选择、3 仅物流、4 仅自提、5 仅同城 */
    deliveryType?: number;
    deliveryProducts?: unknown[] | null;
    pickupProducts?: DeliveryPickupGroup[] | null;
    shopDeliveryData?: ShopDeliveryDatum[] | null;
    shopDeliveryProducts?: unknown[] | null;
}

export interface OrderSubmitPayload {
    shippingType: CheckoutShippingTypeMap;
    deliveryType: number;
    addressId?: number;
    productReservationTimeId?: number;
    reservationDate?: string;
    [key: string]: unknown;
}

export interface OrderSubmitResponse {
    code: number;
    message: string;
    data: OrderSubmitResult;
}

export interface OrderSubmitResult {
    orderId: number;
    returnType: number;
    orderSn: string;
    grouponPromotionRecordId?: number;
    balance?: number;
    isCardRedeem?: boolean;
}

export interface StoreShippingType {
    shippingTypeId: number;
    shippingTypeName: string;
    shippingDefaultId: number;
    shippingTypeDesc: string;
    shippingTimeDesc: string;
    isSupportCod: number;
    sortOrder: number;
    shopId: number;
}

export interface Total {
    productAmount: number;
    checkedCount: number;
    discounts: number;
    discountAfter: number;
    totalCount: number;
    discountCouponAmount: number;
    discountSeckillAmount: number;
    discountProductPromotionAmount: number;
    discountTimeDiscountAmount: number;
    pointsAmount: number;
    shippingFee: number;
    serviceFee?: number;
    storeShippingFee: number[];
    totalAmount: number;
    balance: number;
    creditAmount?: number;
    unpaidAmount: number;
    orderSendPoint: number;
    exchangePoints?: number;
    storeShippingRule?: any;
    // 预售：尾款金额 / 实付定金金额 / 定金金额（后端按场景返回其一或多个）
    finalPaymentAmount?: number;
    actualPayDepositAmount?: number;
    depositAmount?: number;
}

export interface PaymentTypeResponse {
    code: number;
    message: string;
    data: PaymentTypeItem[];
}

export interface PaymentTypeItem {
    typeId: number;
    typeName: string;
    disabled: boolean;
    disabledDesc: string;
    isShow: boolean;
}

export interface ShippingTypeResponse {
    code: number;
    message: string;
    data: { [key: string]: ShippingTypeItem[] };
}

export interface ShippingTypeItem {
    shippingTypeId: number;
    shippingTypeName: string;
    shippingDefaultId: number;
    shippingTypeDesc: string;
    shippingTimeDesc: string;
    isSupportCod: number;
    sortOrder: number;
    shopId: number;
}

interface TimeSlotStockList {
    productReservationTimeId: number;
    startTime: string;
    endTime: string;
    totalStock: number;
    usedStock: number;
    availableStock: number;
    enable: number;
}

export interface DateStockList {
    stockDate: string;
    day?: string;
    weekDay?: string;
    timeSlotStockList: Array<TimeSlotStockList>;
}

export interface StockCalendarParams {
    productId: number;
    shopId: number;
    skuId?: number;
}

interface StockCalendarData {
    productId: number;
    shopId: number;
    dateStockList: Array<DateStockList>;
}

export interface StockCalendarResponse {
    code: number;
    message: string;
    data: StockCalendarData;
}

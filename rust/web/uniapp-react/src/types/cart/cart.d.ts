export interface updateCartItemDataParams {
    cartId: number;
    data: {
        quantity?: number;
    };
}

export interface updateCartCheckParams {
    data: updateCartCheckitem[];
}
export interface updateCartCheckitem {
    cartId: number;
    isChecked: number;
}
export interface removeCartItemDataParams {
    cartIds: number[];
}

export interface CartResponse {
    data: CartData;
    code: number;
    message: string;
}

export interface CartData {
    cartList: CartList[];
    total: Total;
}

export interface CartList {
    shopId: number;
    shopTitle: string;
    carts: Cart[];
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
    quantity: number;
    skuId: number;
    skuData: SkuDatum[];
    productType: number;
    isChecked: boolean;
    shopId: number;
    type: number;
    shopTitle: null | string;
    productWeight: string;
    shippingTplId: number;
    freeShipping: number;
    productStatus: number;
    saleStatus?: number;
    effectiveSaleStatus?: number;
    price: string;
    stock: number;
    subtotal: number;
    isDisabled: boolean;
    sku?: { isEnabled?: number | null };
}

export interface SkuDatum {
    name: string;
    value: string;
}

export interface Total {
    productAmount: number;
    checked_count: number;
    discounts: number;
    totalCount: number;
}

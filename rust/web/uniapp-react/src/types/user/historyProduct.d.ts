export interface HistoryProductResponse {
    data: HistoryProductList[];
    code: number;
    message: string;
}

export interface HistoryProductList {
    categoryId: number;
    brandId: number;
    productTsn: string;
    marketPrice: string;
    shippingTplId: number;
    freeShipping: number;
    productId: number;
    picThumb: string;
    productName: string;
    checkStatus: number;
    shopId: number;
    suppliersId: number;
    productType: number;
    productSn: string;
    productPrice: string;
    productStatus: number;
    isBest: number;
    isNew: number;
    isHot: number;
    productStock: number;
    sortOrder: number;
    price: string;
}

export interface ExchangeListResponse {
    data: ExchangeListData;
    code: number;
    message: string;
}

export interface ExchangeListData {
    records: ExchangeListFilterResult[];
    filter: ExchangeListFilter;
    total: number;
}

export interface ExchangeListFilter {
    isEnabled: number;
    page: number;
    size: number;
    sortField: string;
    sortOrder: string;
}

export interface ExchangeListFilterResult {
    id: number;
    productId: number;
    exchangeIntegral: number;
    pointsDeductedAmount: string;
    isHot: number;
    isEnabled: number;
    skuId: number;
    productName: string;
    marketPrice: string;
    productPrice: string;
    picUrl: string;
    virtualSales: number;
    ProductSn: string;
    productStock: number;
    discountsPrice: string;
    productSku: ExchangeListProductSku | null;
}

export interface ExchangeListProductSku {
    skuId: number;
    productId: number;
    skuValue: string;
    skuData: ExchangeListSkuDatum[];
    skuSn: string;
    skuStock: number;
    skuTsn: string;
    skuPrice: string;
}

export interface ExchangeListSkuDatum {
    name: string;
    value: string;
}

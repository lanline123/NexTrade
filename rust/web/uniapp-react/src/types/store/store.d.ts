export interface StoreListResponse {
    code: number;
    message: string;
    data: StoreListResult;
}

export interface ContactConfigs {
    type: number;
    values: string;
}

export interface OpenCloseConfig {
    type: number;
    times: Array<unknown>;
}

export interface StoreListRecords {
    inLocalDeliveryRange?: StoreDetailData["inLocalDeliveryRange"];
    shopId: number;
    shopLogo: string;
    shopTitle: string;
    inServiceRange?: boolean;
    status: number;
    score: string;
    shopSales: string;
    shopStar: number;
    address: string;
    hasCoupon: number;
    labTexts: Array<string>;
    distance: number;
    longitude: number;
    latitude: number;
    contactConfigs: Array<ContactConfigs>;
    tipNames: Array<string>;
    shopStarNum: number;
    description: string;
    collectShop: boolean;
    isChecked?: boolean;
    shopOpenCloseConfig?: OpenCloseConfig;
}

export interface StoreListResult {
    records: Array<StoreListRecords>;
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface StoreDetailResponse {
    code: number;
    message: string;
    data: StoreDetailData;
}

interface ShopShowPicture {
    picId: number;
    picThumb: string;
    picUrl: string;
    picName: string;
}

interface ShopContactConfig {
    type: number;
    values: string;
}

interface ShopOpenCloseConfig {
    type: number;
    times: Array<unknown>;
}

export interface StoreDetailData {
    shopType: number;
    storeParentId: null;
    shopCoverPicture: string;
    shopShowPicture: Array<ShopShowPicture>;
    description: string;
    status: number;
    shopContactConfig: Array<ShopContactConfig>;
    shopOpenCloseConfig: ShopOpenCloseConfig;
    shopRegionIds: Array<number>;
    shopRegionNames: Array<string>;
    shopDetailedAddress: string;
    shopLongitude: number;
    shopLatitude: number;
    shopTips: null;
    shopId: null;
    shopTitle: string;
    inServiceRange?: boolean;
    // 携带配送类型查询详情时返回：当前地址是否在门店的同城/快递配送范围内
    inLocalDeliveryRange?: boolean;
    shopLogo: string;
    shopStar: number;
    shopStarNum: number;
    shopSales: number;
    tipNames: Array<unknown>;
    collectShop: boolean;
    distance: null;
    /** 已通过合规快照的营业执照图，空串或 null 表示前台不公示 */
    businessLicensePic?: string | null;
}

export interface PickupInfoResponse {
    code: number;
    message: string;
    data: PickupInfoData;
}

export interface PickupInfoData {
    mobile?: string;
    orderItems?: OrderItem[];
    pickupQrCode?: string;
    pickupSn?: string;
    shipmentStatus?: number;
    shipmentStatusName?: string;
    shopDetailedAddress?: string;
    expectPickupTime: any;
    pickupName: string;
    store: any;
    userPickupInfo: any;
    userAddressInfo: any;
}

export interface OrderItem {
    cardGroupName: string;
    commission: string;
    deliveryQuantity: number;
    extraSkuData: string;
    isGift: number;
    isPin: number;
    isSeckill: number;
    itemId: number;
    orderId: number;
    orderSn: string;
    originPrice: number;
    picThumb: string;
    prepayPrice: number;
    price: number;
    productId: number;
    productName: string;
    productSn: string;
    productType: number;
    promotionData: string;
    quantity: number;
    shopId: number;
    skuData: string;
    skuId: number;
    suppliersId: number;
    userId: number;
    vendorId: any; // 可以为 null
    vendorProductId: any; // 可以为 null
    vendorProductSkuId: number;
    vendorProductSupplyPrice: any; // 可以为 null
}

export interface StoreLocationParams {
    latitude?: number | string;
    longitude?: number | string;
}

export interface StoreListParams extends StoreLocationParams {
    page?: number;
    size?: number;
    keyword?: string;
    regionId?: number;
    /** 用户手选的地区，不受后台跨地区展示配置影响。 */
    storeRegionId?: number | null;
    productId?: number | string;
    shopId?: number | string;
    categoryId?: number | string;
    shopGroupId?: number | string;
    groupId?: number | string;
    shopIds?: string;
    selectedShopId?: number;
    excludeSelfOperated?: number;
    deliveryTypes?: string;
    sortField?: string;
    sortOrder?: string;
}

export interface StoreDetailParams extends StoreLocationParams {
    shopId: number | string;
    deliveryType?: number;
    deliveryTypes?: string;
}

export interface PickupInfoParams {
    orderId?: number | string | null;
}

// 获取地址列表类型
export interface RegionFilterState {
    data: [];
    code: number;
    message: string;
}

export interface AddressFilterParams {
    page: number;
    size: number;
}

export interface AddressResponse {
    code: number;
    message: string;
    data: AddressData;
}

export interface AddressData {
    records: AddressFilterResult[];
    total: number;
    size: number;
    current: number;
    pages: number;
}

export interface AddressFilterResult {
    countryCode?: string;
    countryName?: string;
    mobileAreaCode?: string;
    internationalMobile?: string;
    addressData?: Record<string, string>;
    formattedAddress?: string;
    fullAddress?: string;
    isInvalid?: boolean;
    regionName: string;
    addressId: number;
    userId: number;
    consignee: string;
    email: string;
    regionNames: string[];
    address: string;
    postcode?: string;
    addressTag?: string;
    telephone: string;
    mobile: string;
    isSelected: number;
    isDefault: number;
    latitude?: number | null;
    longitude?: number | null;
}

/* 地址详情 */
export interface AddressDetailResponse {
    data: Item;
    code: number;
    message: string;
}

export interface Item {
    addressId: number;
    addressTag: string;
    countryCode?: string;
    countryName?: string;
    internationalMobile?: string;
    addressData?: Record<string, string>;
    formattedAddress?: string;
    fullAddress?: string;
    userId: number;
    consignee: string;
    email: string;
    regionIds: number[];
    regionNames: string[];
    address: string;
    postcode: string;
    telephone: string;
    mobile: string;
    mobileAreaCode?: string;
    isDefault: number;
    isSelected: number;
}

export interface CityRegionResponse {
    code: number;
    message: string;
    data: CityRegionData;
}

export interface CityRegion {
    regionId: number;
    regionName: string;
    parentId: number;
    level: number;
    isHot: number;
    firstWord: string;
}

export interface CityRegionData {
    hot: Array<CityRegion>;
    city: Array<CityRegion>;
}

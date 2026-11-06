export interface UserPickupListResponse {
    code: number;
    message: string;
    data: UserPickupListData;
}

export interface UserPickupListData {
    orders: UserPickupListOrder[];
    records: UserPickupListRecord[];
    searchCount: boolean;
    size: number;
    total: number;
}

export interface UserPickupListOrder {
    asc?: boolean;
    column?: string;
}

export interface UserPickupListRecord {
    consignee?: string;
    isDefault?: number;
    isSelected?: number;
    mobile: string;
    mobileAreaCode?: string;
    userId?: number;
    userPickupId: number;
}

export interface UserPickuDetailResponse {
    code: number;
    message: string;
    data: UserPickuDetailData;
}

export interface UserPickuDetailData {
    consignee?: string;
    isDefault?: number;
    isSelected?: number;
    mobile?: string;
    mobileAreaCode?: string;
    userId?: number;
    userPickupId?: number;
}

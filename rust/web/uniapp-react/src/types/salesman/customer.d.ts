export interface CustomerListParams {
    page: number;
    size: number;
    customerType?: "all" | "ordered" | "salesman";
    keyword?: string;
    startTime?: string;
    endTime?: string;
}
export interface CustomerItem {
    userId: number;
    username?: string;
    avatar?: string;
    mobile?: string;
    nickname?: string;
    rankName?: string;
    customerType?: "customer" | "ordered" | "salesman";
    orderCount?: number;
    orderAmount?: number;
    averageOrderAmount?: number;
    lastOrderTime?: string | null;
    bindTime?: string | null;
    channel?: string;
    remark?: string;
}
export interface CustomerListResponse {
    records: CustomerItem[];
    total: number;
    size?: number;
    current?: number;
    pages?: number;
}
export type CustomerDetail = CustomerItem;

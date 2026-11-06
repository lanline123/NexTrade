export interface ProductActiveStyleVO {
    borderStyleId: number | null;
    borderImage: string | null;
    activityStyleId: number | null;
    activityStyleName: string | null;
    activityBackgroundImage: string | null;
}

export interface ProductActiveStyleResponse {
    code: number;
    message: string;
    data: ProductActiveStyleVO;
}

export interface BatchActiveStyleResponse {
    code: number;
    message: string;
    data: Record<number, ProductActiveStyleVO>;
}

export interface PointFilterParams {
    page: number;
    size?: number;
}

// 获取列表返回参数类型
export interface PointFilterState {
    logId?: number;
    userId?: number;
    points?: string;
    changeTypeName?: string;
    changeTime?: string;
    changeDesc?: string;
    changeType?: number;
}
export interface PointFilterResult {
    data: PointData[];
    code: number;
    message: string;
}

export interface PointData {
    records: PointFilterState[];
    total: number;
}

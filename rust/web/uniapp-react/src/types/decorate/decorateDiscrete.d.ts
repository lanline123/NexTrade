// 列表查询时筛选参数类型
export interface DecorateDiscreteFormState {
    backgroundColor?: string;
    backgroundPic?: {
        picUrl?: string;
        picThumb?: string;
    };
}

// 获取详情返回参数类型
export interface FormResult {
    item: {
        data?: DecorateDiscreteFormState;
    };
}

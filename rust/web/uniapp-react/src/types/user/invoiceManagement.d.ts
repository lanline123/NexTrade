// 列表查询时筛选参数类型
// 获取详情返回参数类型
export interface UserInvoiceFormState {
    invoiceId?: number;
    titleType?: number;
    confirm?: boolean;
    isConfirm?: number;
    invoiceType?: number;
    isAdd?: number;
    status?: number;
    invoiceContent?: string;
    companyName?: string;
    companyCode?: string;
    companyAddress?: string;
    companyPhone?: string;
    companyBank?: string;
    companyAccount?: string;
    applyReply?: string;
}

export interface UserInvoiceFormResult {
    item: UserInvoiceFormState;
}
export interface UserInvoiceStatus {
    item: boolean;
}

// 编辑表单

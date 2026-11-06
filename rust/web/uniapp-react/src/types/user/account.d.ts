// 列表查询时筛选参数类型
export interface AccountFilterParams {
    page: number;
    size: number;
    status?: number;
    accountType?: number;
}

export interface AccountDetailFilterResult {
    data: AccountDetailData;
    code: number;
    message: string;
}

export interface AccountDetailData {
    records: AccountDetailFilterState[];
    filter: AccountFilterParams;
    total: number;
}

export interface AccountDetailFilterState {
    changeTime?: string;
    balance?: number;
    frozenBalance?: number;
    changeType?: string;
    changeDesc?: string;
    changeTypeName?: string;
}

export interface AccountFilterResult {
    records: AccountFilterState[];
    filter: AccountFilterParams;
    total: number;
}

export interface AccountFilterState {
    addTime?: string;
    amount?: string;
    type?: string;
    postscript?: string;
    statusType?: string;
}

export interface DepositFilterResult {
    data: DepositFilterState[];
    code: number;
    message: string;
}

export interface DepositFilterState {
    discountMoney?: string;
    money?: string;
    rechargeId?: number;
    selected?: boolean;
}

// 获取详情返回参数类型
export interface AccountFormState {
    amount?: string;
    accountData: AccountData;
}

export interface AccountData {
    accountType?: number;
    accountName?: string;
    accountNo?: string;
    identity?: string;
    bankName?: string;
}

export interface AccountInfoResult {
    data: AccountInfoData;
    code: number;
    message: string;
}

export interface AccountInfoData {
    records: AccountInfo[];
    filter: object;
}

export interface AccountInfo {
    accountTypeName: string;
    accountId: number;
    userId: number;
    accountType: number;
    accountName: string;
    accountNo: string;
    identity: string;
    bankName: string;
}
export interface AccountFormResult {
    data: AccountInfo;
    code: number;
    message: string;
}
export interface AccountNoFilterParams {
    page: number;
    status?: number;
    accountType?: number;
}

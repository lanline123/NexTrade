export interface ProfileFormResult {
    data: ProfileFormState;
    code: number;
    message: string;
}

// 获取详情返回参数类型
export interface ProfileFormState {
    userId?: number;
    birthday: string;
    nickname?: string;
    email?: string;
    mobile?: string;
    showMobile?: string;
    isBindWechat?: boolean;
}

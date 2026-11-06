export interface UserDataResponse {
    data: UserItem;
    code: number;
    message: string;
}

export interface UserItem {
    dimUsername: string;
    userId: number;
    username: string;
    nickname: string;
    avatar: string;
    points: number;
    balance: string;
    frozenBalance: string;
    commissionBalance?: string; // 分销佣金可用余额（D1107）
    frozenCommissionBalance?: string; // 分销佣金冻结余额（D1107）
    birthday: string;
    mobile: string;
    email: string;
    rankId: number;
    rankName: string;
    rankIco: string;
    discount: number;
    totalBalance: string;
    coupon: number;
    showSign: number;
}

export interface MemberCenterResponse {
    data: MemberCenterItem;
    code: number;
    message: string;
}

/**
 * 会员中心（PC端：user/user/memberCenter）
 * 这里只声明当前页面需要用到的字段；其他字段按需补充
 */
export interface MemberCenterItem {
    /** 待使用优惠券数量（用于“优惠券”入口展示） */
    awaitCoupon?: number;
}

export interface UnreadCountResponse {
    data: UnreadCountItem;
    code: number;
    message: string;
}

export interface UnreadCountItem {
    userMessageCount: number;
    orderMessageCount: number;
    imMessageCount: number;
}

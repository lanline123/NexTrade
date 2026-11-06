export interface SalesmanPersoanlDataResponse {
    data: SalesmanPersonalItem;
    code: number;
    message: string;
}

export interface SalesmanPersonalItem {
    dimUsername: string;
    userId: number;
    username: string;
    nickname: string;
    avatar: string;
    points: number;
    balance: string;
    frozenBalance: string;
    birthday: string;
    mobile: string;
    email: string;
    rankId: number;
    rankName: string;
    rankIco: string;
    discount: number;
    totalBalance: string;
    coupon: number;
    cardname?: string;
    wechatname?: string;
    qrcode?: string;
}

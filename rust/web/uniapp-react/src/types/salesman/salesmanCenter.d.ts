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
}

export interface SalesmanDataResponse {
    data: SalesmanItem;
    code: number;
    message: string;
}
export interface SalesmanItem {
    salesmanId: number;
    userId: number;
    level: number;
    groupId: number;
    pid: number;
    addTime: string | null;
    shopId: number | null;
    saleAmount: string;
    levelName: string;
    condition: Condition;
    order: Order;
    salesmanConfig: SalesmanConfig;
}
interface Condition {
    selfBuyAmount: ObjectSales;
    salesAmount: ObjectSales;
    salesInviteUsers: ObjectSales;
}
interface ObjectSales {
    checked: boolean;
    value: number;
}
interface Order {
    todaySum: number;
    allSum: number;
    waitCpsSum: number;
    todayCount: number;
    allCount: number;
    todayUserCount: number;
    allUserCount: number;
    selfBuySum: number;
}
interface SalesmanConfig {
    code: string;
    saleType: number;
    salesmanId: number;
    shopId: string | null;
    userId: number;
    level: SalesmanLevel[];
    /** 分销隐私：是否允许查看自己的客户信息，0-关闭 1-开启 */
    viewCustomerInfo?: number;
}

export interface SalesmanLevel {
    id: number;
    name: string;
    rate: number;
    downSalesmanRate: number;
    condition: {
        selfBuyAmount: SalesmanLevelCondition;
        salesAmount: SalesmanLevelCondition;
        salesInviteUsers: SalesmanLevelCondition;
        inviteSales: SalesmanLevelCondition;
    };
}

export interface SalesmanLevelCondition {
    checked: boolean;
    value: number;
    title: string;
    unit: string;
}

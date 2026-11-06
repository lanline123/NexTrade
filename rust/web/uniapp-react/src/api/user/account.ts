import type { ApiEnvelope } from "@/types/api";
import request from "@/utils/request";
import type {
    AccountFilterParams,
    AccountDetailFilterResult,
    AccountFilterResult,
    DepositFilterResult,
    AccountInfoResult,
    AccountNoFilterParams,
    AccountFormResult
} from "@/types/user/account";

/**
 * @description 获取账户资金变动记录
 * @param params 筛选条件
 * @returns 变动记录列表
 */
export const getAccountList = (params?: AccountFilterParams) => {
    return request<AccountDetailFilterResult>({
        url: "user/account/list",
        method: "get",
        params
    });
};

/**
 * @description 获取充值订单列表
 * @param params 筛选条件
 * @returns 充值记录列表
 */
export const getRechargeOrderList = (params?: AccountFilterParams) => {
    return request<ApiEnvelope<AccountFilterResult>>({
        url: "user/rechargeOrder/list",
        method: "get",
        params
    });
};

/**
 * @description 获取充值配置（充值金额档位等）
 * @returns 充值配置
 */
export const getDepositList = () => {
    return request<DepositFilterResult>({
        url: "user/rechargeOrder/setting",
        method: "get"
    });
};

/**
 * @description 提交充值申请
 * @param data 充值金额等
 * @returns 操作结果
 */
export const updateRechargeOrder = (data: object) => {
    return request({
        url: "user/rechargeOrder/update",
        method: "post",
        data
    });
};

/**
 * @description 获取提现申请列表
 * @param params 筛选条件
 * @returns 提现记录列表
 */
export const getAccountNoList = (params?: AccountNoFilterParams) => {
    return request<AccountInfoResult>({
        url: "user/withdrawApply/list",
        method: "get",
        params
    });
};

/**
 * @description 提交提现申请
 * @param data 提现金额、账户信息等
 * @returns 操作结果
 */
export const updateWithdrawApply = (data: object) => {
    return request({
        url: "user/withdrawApply/apply",
        method: "post",
        data
    });
};

/**
 * @description 获取分销佣金账户变动明细（D1107，与余额明细隔离）
 * @param params 筛选条件
 * @returns 佣金变动记录列表
 */
export const getCommissionAccountList = (params?: AccountFilterParams) => {
    return request<AccountDetailFilterResult>({
        url: "user/account/commissionList",
        method: "get",
        params
    });
};

/**
 * @description 提交分销佣金提现申请（D1107，从佣金账户扣减）
 * @param data 包含提现金额、收款账户ID
 * @returns 申请结果
 */
export const updateCommissionWithdrawApply = (data: object) => {
    return request({
        url: "user/withdrawApply/applyCommission",
        method: "post",
        data
    });
};

/**
 * @description 删除提现账户
 * @param params 包含账户ID
 * @returns 操作结果
 */
export const delAccount = (data: object) => {
    return request({
        url: "user/withdrawApply/delAccount",
        method: "post",
        data
    });
};

/**
 * @description 获取提现账户详情
 * @param params 包含账户ID
 * @returns 账户信息
 */
export const getAccount = (params?: object) => {
    return request<AccountFormResult>({
        url: "user/withdrawApply/accountDetail",
        method: "get",
        params
    });
};

/**
 * @description 新增/更新提现账户
 * @param data 账户信息
 * @param url 操作类型（create/update）
 * @returns 操作结果
 */
export const updateAccount = (data: object, url: string) => {
    return request({
        url: "user/withdrawApply/" + url,
        method: "post",
        data
    });
};

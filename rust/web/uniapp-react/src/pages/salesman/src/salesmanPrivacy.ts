import Taro from "@tarojs/taro";

import { getSalesman } from "@/api/salesman/salesmanCenter";

/**
 * 分销隐私（自旧 pages/salesman/src/salesmanPrivacy.ts 移植）
 * - 仅明确为 1 时允许进入客户列表，缺省/未下发/0 都不能跳转
 */
export const isViewCustomerInfoEnabled = (value?: number | string | boolean | null) => Number(value) === 1;

const leaveCustomerPage = () => {
    Taro.navigateBack({
        fail: () => {
            Taro.redirectTo({ url: "/pages/salesman/index" });
        }
    });
};

export const ensureViewCustomerInfo = async () => {
    try {
        const result = await getSalesman();
        if (isViewCustomerInfoEnabled(result?.salesmanConfig?.viewCustomerInfo)) {
            return true;
        }
    } catch {
        // 配置读取失败时按未开启处理，避免绕过隐私开关
    }
    leaveCustomerPage();
    return false;
};
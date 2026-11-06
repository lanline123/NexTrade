import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";

/**
 * 是否需要显示 B2B 登录或实名认证后查看价格的提示。
 */
export const isShowB2bPriceText = () => {
    const { isIdentity } = useConfigStore.getState();
    const { userInfo } = useUserStore.getState();
    if (isIdentity !== 1) {
        return false;
    }
    return Object.keys(userInfo).length === 0 || !userInfo.isCompanyAuth;
};

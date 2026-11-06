import Taro from "@tarojs/taro";

import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { currFullPath } from "@/utils";

/**
 * 根据当前终端配置清理登录态，并进入微信授权或普通登录页。
 */
export const handleLogin = () => {
    const configStore = useConfigStore.getState();
    const userStore = useUserStore.getState();
    if (
        configStore.openWechatOauth === 1 &&
        configStore.openWechatRegister === 1 &&
        (configStore.XClientType === "miniProgram" || configStore.XClientType === "wechat")
    ) {
        userStore.clear();
        userStore.setAuthType("wechatLogin");
    } else {
        userStore.clear();
        const fullPath = currFullPath();
        if (fullPath.indexOf("login") > -1) return;
        const url = `/pages/login/index${fullPath ? `?url=${encodeURIComponent(fullPath)}` : ""}`;
        setTimeout(() => {
            Taro.navigateTo({ url }).catch(() => {});
        }, 200);
    }
};

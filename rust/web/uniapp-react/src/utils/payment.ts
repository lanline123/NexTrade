import Taro from "@tarojs/taro";

import { getShellBridge } from "@/utils/nativeBridge";

// 自旧 view/uniapp/src/utils/payment.ts 移植（B3 交易链路第四批）
// 支付工具：第三方收银台 URL 打开分发

export interface OpenExternalPaymentOptions {
    clientType: string;
    onFail?: () => void;
}

const isInIframe = () => {
    try {
        return window.self !== window.top;
    } catch {
        return true;
    }
};

const redirectToTopLevel = (url: string): boolean => {
    let launched = false;
    if (process.env.TARO_ENV === "h5") {
        if (isInIframe()) {
            const link = document.createElement("a");
            link.href = url;
            link.target = "_top";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } else {
            window.location.assign(url);
        }
        launched = true;
    }
    return launched;
};

/**
 * 按客户端能力打开第三方收银台。
 * - H5/公众号（含 H5 壳）：顶层页面跳转；壳内可经桥改走系统浏览器（对齐旧 APP-PLUS openURL 行为）
 * - 小程序：受控 web-view（pages/webviewPage）；目标域名仍需在对应平台配置业务域名
 */
export const openExternalPaymentUrl = (rawUrl: unknown, options: OpenExternalPaymentOptions): boolean => {
    const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
    if (!/^https:\/\//i.test(url)) return false;

    const { clientType, onFail } = options;

    if (clientType === "h5" || clientType === "wechat") {
        // H5 壳内：旧 APP-PLUS 用 plus.runtime.openURL 跳系统浏览器，桥可用时对齐该行为
        const bridge = getShellBridge();
        if (bridge?.openUrl) {
            try {
                bridge.openUrl(url);
                return true;
            } catch {
                // 桥调用失败回落页内跳转
            }
        }
        return redirectToTopLevel(url);
    }

    if (clientType === "miniProgram") {
        let launched = false;
        // #ifdef MP → Taro 小程序端
        if (process.env.TARO_ENV !== "h5") {
            Taro.navigateTo({
                url: `/pages/webviewPage/index?url=${encodeURIComponent(url)}`,
                fail: () => onFail?.()
            });
            launched = true;
        }
        return launched;
    }

    return false;
};

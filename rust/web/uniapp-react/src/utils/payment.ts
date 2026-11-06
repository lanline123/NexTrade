import Taro from "@tarojs/taro";

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
 * - H5/公众号：顶层页面跳转
 * - 小程序：受控 web-view（pages/webviewPage）；目标域名仍需在对应平台配置业务域名
 * TODO(MIGRATION)：App 端分支（uni-app APP-PLUS plus.runtime.openURL / APP-HARMONY web-view）
 * 待 App 批次落地时补充，当前 App 端返回 false（页面会提示"无法打开支付页面"）。
 */
export const openExternalPaymentUrl = (rawUrl: unknown, options: OpenExternalPaymentOptions): boolean => {
    const url = typeof rawUrl === "string" ? rawUrl.trim() : "";
    if (!/^https:\/\//i.test(url)) return false;

    const { clientType, onFail } = options;

    if (clientType === "h5" || clientType === "wechat") {
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

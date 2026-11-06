import Taro from "@tarojs/taro";

/**
 * 执行页面返回，行为与 TigNavbar 保持一致。
 * H5 使用浏览器历史；非 H5 在页面栈为空时回到首页。
 * （Phase 1 未声明原生 tabBar，页面栈为空时用 reLaunch 回首页）
 */
export const navigateBack = () => {
    if (process.env.TARO_ENV === "h5") {
        history.back();
        return;
    }
    const pageList = Taro.getCurrentPages();
    if (pageList.length > 1) {
        Taro.navigateBack().catch(() => {});
    } else {
        Taro.reLaunch({ url: "/pages/index/index" }).catch(() => {});
    }
};

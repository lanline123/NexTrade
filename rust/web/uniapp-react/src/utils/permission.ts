import Taro from "@tarojs/taro";

import { useConfigStore } from "@/store/config";
import { useUserStore } from "@/store/user";
import { clearJsonLd } from "@/utils/seo";

/**
 * 路由权限白名单（与旧 uniapp 版一致）。
 *
 * 迁移说明：旧方案用 uni.addInterceptor('navigateTo'/'redirectTo'/'reLaunch'/'switchTab')
 * 做跳转拦截；Taro（含 H5 端）的 addInterceptor 只挂在 Taro.request 上，不拦截路由 API，
 * 因此改为页面级守卫 —— 所有页面统一调用 usePageGuards()（utils/pageMixin.ts），
 * 在页面展示时校验白名单与登录态（比拦截器更可靠，不漏任何跳转入口）。
 */
const whiteList = [
    "/pages/login/index",
    "/pages/login/mallAgreement",
    "/pages/register/index",
    "/pages/register/agreement",
    "/pages/index/index",
    "/pages/search/index",
    "/pages/search/result",
    "/pages/productCate/index",
    "/pages/cart/index",
    "/pages/member/index",
    "/pages/product/index",
    "/pages/shop/index",
    "/pages/shop/list",
    "/pages/category/index",
    "/pages/im/index",
    "/pages/user/bindMobilePhone/index",
    "/pages/salesman/salesmanCard",
    "/pages/reset/index",
    "/pages/customPage/index",
    "/pages/store/index",
    "/pages/storeList/index",
    "/pages/region/index",
    "/pages/buyerShow/index",
    "/pages/buyerShow/addBuyerShow",
    "/pages/buyerShow/buyerShowDetail",
    // 以图搜图不设登录门槛，游客可拍照和查看结果
    "/pages/imageSearch/capture",
    "/pages/imageSearch/captureMp",
    "/pages/search/image",
    "/pages/langSet/index"
];

export function hasPermission(url: string): boolean {
    const { token } = useUserStore.getState();
    let currentUrl = url;
    if (url.includes("?")) {
        currentUrl = url.split("?")[0];
    }
    // 统一为 /pages/... 形式再比对（useRouter().path 无前导斜杠）
    const normalized = currentUrl.startsWith("/") ? currentUrl : `/${currentUrl}`;
    // 在白名单中或有token，直接放行
    if (whiteList.indexOf(normalized) !== -1 || Taro.getStorageSync("token") || token) {
        return true;
    }
    return false;
}

/**
 * 页面级权限守卫：无权限时按端配置进入微信授权态或跳登录页。
 * 返回 true 表示已放行。
 */
export function guardPage(url: string): boolean {
    if (hasPermission(url)) {
        return true;
    }
    const { openWechatOauth, openWechatRegister, XClientType } = useConfigStore.getState();
    const userStore = useUserStore.getState();
    if (
        openWechatOauth === 1 &&
        openWechatRegister === 1 &&
        (XClientType === "miniProgram" || XClientType === "wechat")
    ) {
        userStore.setAuthType("wechatLogin");
    } else {
        Taro.setStorageSync("URL", url);
        Taro.navigateTo({ url: "/pages/login/index" }).catch(() => {});
    }
    return false;
}

/** H5 端路由切换时清理上一页注入的 JSON-LD（对齐旧跳转拦截器行为） */
export function clearSeoOnNavigate() {
    if (process.env.TARO_ENV === "h5") {
        clearJsonLd();
    }
}

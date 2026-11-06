import { useEffect } from "react";
import { View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import { getOauthCallback } from "@/api/login/login";
import { useCartStore } from "@/store/cart";
import { useUserStore } from "@/store/user";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./callback.scss";

/**
 * 第三方 OAuth 固定回调页（自旧 pages/oauth/callback.vue 逐行移植）
 * - Google / Facebook 等平台固定回跳到本页面
 * - 读取 code / state 后换取站内登录态
 * - 根据后端返回的 returnUrl 跳转到站内目标页
 * - 回调失败则回到登录页
 */
export default function OauthCallback() {
    usePageGuards();

    const router = useRouter();

    const setToken = useUserStore((s) => s.setToken);
    const getUserInfo = useUserStore((s) => s.getUserInfo);

    /**
     * 将后端返回的 returnUrl 转成 uniapp 路径并跳转
     * - 兼容相对路径（推荐）
     * - 对完整外链做容错，直接 window.location.href 打开（仅 H5）
     */
    const redirectAfterLogin = (returnUrl: string) => {
        const target = returnUrl || "/pages/index/index";

        // 外链：H5 场景下直接跳外链，其他端走首页兜底
        if (/^https?:\/\//i.test(target)) {
            if (process.env.TARO_ENV === "h5") {
                window.location.href = target;
            } else {
                Taro.reLaunch({ url: "/pages/index/index" });
            }
            return;
        }

        const path = target.startsWith("/") ? target : `/${target}`;

        Taro.reLaunch({
            url: path,
            fail: () => {
                Taro.reLaunch({ url: "/pages/index/index" });
            }
        });
    };

    const redirectToLogin = (messageText: string) => {
        Taro.removeStorageSync("oauthPath");
        void Taro.showToast({
            title: messageText,
            icon: "none",
            duration: 1500
        });
        setTimeout(() => {
            Taro.reLaunch({ url: "/pages/login/index" });
        }, 800);
    };

    const handleOauthCallback = async (options: Record<string, any>) => {
        const code = options.code;
        const state = options.state;
        const oauthProvider = Taro.getStorageSync("oauthPath") as string;

        if (!oauthProvider) {
            redirectToLogin(t("缺少授权方式"));
            return;
        }

        if (!code || !state) {
            redirectToLogin(t("缺少授权参数"));
            return;
        }

        try {
            const result: any = await getOauthCallback(oauthProvider, { code, state });
            setToken(result.token);
            await getUserInfo();
            void useCartStore.getState().fetchCartCount(true);
            Taro.removeStorageSync("oauthPath");
            Taro.removeStorageSync("URL");
            redirectAfterLogin(result.returnUrl || "");
        } catch (error: any) {
            console.error(error);
            redirectToLogin(error?.message || t("授权失败"));
        }
    };

    // 旧 onLoad
    useEffect(() => {
        void handleOauthCallback(router.params || {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return <View className="oauth-callback" />;
}
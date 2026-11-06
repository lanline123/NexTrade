import { useEffect } from "react";
import Taro, { useRouter } from "@tarojs/taro";

import { useTabbarStore } from "@/store/tabbar";
import { clearSeoOnNavigate, guardPage } from "@/utils/permission";

/**
 * 页面级 mixin 替代（旧方案为全局 Vue mixin）：
 * 在页面挂载/展示时把当前路由同步进 tabbar store，供自定义 tabBar 高亮与
 * 「是否 tabbar 页」判断使用。
 */
export function useSyncCurrRoute() {
    const router = useRouter();
    const setCurrRoute = useTabbarStore((s) => s.setCurrRoute);

    useEffect(() => {
        const route = (Taro.getCurrentPages().slice(-1)[0]?.path || router.path || "").replace(/^\//, "");
        if (route) {
            setCurrRoute(route);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.path]);
}

/**
 * 页面级登录守卫（替代旧 uni.addInterceptor 路由拦截器，见 utils/permission.ts 说明）。
 */
export function useAuthGuard() {
    const router = useRouter();

    useEffect(() => {
        clearSeoOnNavigate();
        const url = router.path.startsWith("/") ? router.path : `/${router.path}`;
        guardPage(url);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.path]);
}

/**
 * 所有页面的统一入口守卫：路由同步 + 权限校验。
 * 页面组件（或统一 PageShell）只需调用 usePageGuards()。
 */
export function usePageGuards() {
    useSyncCurrRoute();
    useAuthGuard();
}

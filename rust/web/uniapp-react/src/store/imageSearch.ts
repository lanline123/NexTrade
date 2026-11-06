import { create } from "zustand";

import { getImageSearchCapabilities } from "@/api/search/imageSearch";

/**
 * 以图搜图在当前端是否可用（自旧 store/imageSearch.ts 的 Pinia setup store 移植为 zustand）
 * 由后台开关决定；开关未取到或读取失败时按不可用处理，入口不显示，失败后下次进入有入口的页面会重试
 * 开关只在首次用到时读取一次；图搜接口返回功能关闭时先按不可用处理，再重新读取以最新配置刷新界面
 * 店铺/门店内的入口还要看店铺开关，关闭后只影响带店铺的搜索，全站入口不受影响
 */
interface ImageSearchState {
    /** 全站入口是否可用：总开关与当前端开关 */
    available: boolean;
    /** 店铺开关；旧接口没有这个字段时按开启处理 */
    shopEnabled: boolean;
    /**
     * 读取后台开关
     * @param force 忽略已读取的结果重新读取，接口返回功能关闭后用来同步最新配置
     */
    fetchCapabilities: (force?: boolean) => Promise<void>;
    /** 按搜索范围判断入口是否可用 */
    isAvailable: (inShop: boolean) => boolean;
    /**
     * 接口返回功能已关闭：先隐藏对应范围的入口，再重新读取开关，以最新配置刷新界面
     * @param inShop 出错的是店铺内搜索时只隐藏店铺内入口，全站入口不闪烁，重新读取失败也不受影响
     */
    markUnavailable: (inShop?: boolean) => void;
}

// 模块级缓存，对应旧 setup store 内的 loaded / pending 闭包变量
let loaded = false;
let pending: Promise<void> | null = null;

/**
 * 结果页在 Taro 4 只注册了 H5 与微信小程序两个端（App 端待 RN 壳落地）
 * 其它端不请求、不显示入口
 */
const isSupportedPlatform = () => process.env.TARO_ENV === "h5" || process.env.TARO_ENV === "weapp";

export const useImageSearchStore = create<ImageSearchState>((set, get) => {
    const fetchCapabilities = (force = false) => {
        if (!isSupportedPlatform()) return Promise.resolve();
        if (loaded && !force) return Promise.resolve();
        if (pending) return pending;
        pending = getImageSearchCapabilities()
            .then((res) => {
                // TODO(MIGRATION)：旧版 App 端读 appEnabled；Taro 端先只支持 h5 / weapp。
                // 后端没有小程序的端开关，微信小程序暂时跟随 H5 开关
                set({
                    available: !!res?.h5Enabled,
                    shopEnabled: res?.shopEnabled !== false
                });
                loaded = true;
            })
            .catch(() => {
                // 首次读取失败按不可用处理；之后重新读取失败时保留当前结果
                if (!loaded) set({ available: false, shopEnabled: false });
            })
            .finally(() => {
                pending = null;
            });
        return pending;
    };

    const isAvailable = (inShop: boolean) => {
        const { available, shopEnabled } = get();
        return inShop ? available && shopEnabled : available;
    };

    const markUnavailable = (inShop = false) => {
        if (inShop) set({ shopEnabled: false });
        else set({ available: false });
        void fetchCapabilities(true);
    };

    return {
        available: false,
        shopEnabled: false,
        fetchCapabilities,
        isAvailable,
        markUnavailable
    };
});
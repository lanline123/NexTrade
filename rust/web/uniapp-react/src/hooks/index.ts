import { useState } from "react";
import { usePageScroll } from "@tarojs/taro";

import { useConfigStore } from "@/store/config";

/**
 * @description 页面滚动位置hook（React 版，基于 Taro usePageScroll）
 * @returns scrollTop 当前滚动位置
 */
export function useScrollTop() {
    const [scrollTop, setScrollTop] = useState(0);
    usePageScroll((e) => {
        setScrollTop(e.scrollTop);
    });
    return { scrollTop };
}

/**
 * @description 获取安全区域边距hook
 * @returns saveTop 顶部安全距离, safeBottom 底部安全距离
 */
export function useSafeAreaInsets() {
    const safeAreaInsets = useConfigStore((s) => s.safeAreaInsets);
    return {
        saveTop: safeAreaInsets.top,
        safeBottom: safeAreaInsets.bottom
    };
}

/**
 * @description 获取小程序胶囊按钮信息hook
 * @returns 胶囊按钮位置及尺寸
 */
export function useMenuButtonInfo() {
    const menuButtonInfo = useConfigStore((s) => s.menuButtonInfo);
    return {
        menuLeft: menuButtonInfo.left,
        menuRight: menuButtonInfo.right,
        menuTop: menuButtonInfo.top,
        menuHeight: menuButtonInfo.height
    };
}

/**
 * @description 计算顶部导航区域高度hook
 * @param contentHeight 内容高度
 * @returns 计算后的高度信息
 */
export function useSaveTopBoxHeight(contentHeight = 0) {
    const { saveTop } = useSafeAreaInsets();
    const { menuTop, menuHeight, menuLeft } = useMenuButtonInfo();

    // H5 / App：状态栏高度 + 内容高度
    // 小程序：按胶囊位置计算（与旧 #ifndef 分支一致）
    const isMp = process.env.TARO_ENV !== "h5" && process.env.TARO_ENV !== "rn";
    let height: number;
    let finalContentHeight: number;
    let contentWidth = "100%";
    if (!isMp) {
        finalContentHeight = contentHeight;
        height = saveTop + contentHeight;
    } else {
        contentWidth = menuLeft + "px";
        finalContentHeight = (menuTop - saveTop) * 2 + menuHeight;
        height = finalContentHeight + saveTop;
    }

    return {
        height,
        contentHeight: finalContentHeight,
        contentWidth,
        statusBarHeight: saveTop
    };
}

export { default as useStorageData } from "./useStorageData";
export { useProductStyle } from "./useProductStyle";
export { useGroupShopList } from "./useGroupShopList";

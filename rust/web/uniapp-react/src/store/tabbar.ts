import { useMemo } from "react";
import { create } from "zustand";

import { t } from "@/utils/i18n";
import { rpxToDevicePx } from "@/components/modules";
import { getMobileNav } from "@/api/tabbar";
import { useConfigStore } from "@/store/config";
import { urlFormat } from "@/utils/format";
import ico1 from "@/static/images/common/ico_1.png";
import ico2 from "@/static/images/common/ico_2.png";
import ico3 from "@/static/images/common/ico_3.png";
import ico4 from "@/static/images/common/ico_4.png";
import ico1h from "@/static/images/common/ico_1h.png";
import ico2h from "@/static/images/common/ico_2h.png";
import ico3h from "@/static/images/common/ico_3h.png";
import ico4h from "@/static/images/common/ico_4h.png";

const TABBAR_HEIGHT_RPX = 120;

export interface TabbarItem {
    link: string;
    image: string;
    activeImage: string;
    text: string;
}

export interface TabbarState {
    tabbarListDefault: TabbarItem[];
    tabbarEnableAnimation: boolean;
    /** 高度以 rpx 为源，向占位和浮动控件提供换算后的实际 px。 */
    tabbarHeightNum: number;
    currRoute: string;
    // 后台导航装修：背景与配色配置
    tabbarBackgroundColorType: number; // 1=系统色 2=自定义颜色
    tabbarBackgroundColor: string;
    tabbarCornerStyle: number; // 1=直角 2=圆角 3=大圆角
    tabbarIconColorType: number; // 1=系统配色 2=自定义配置
    tabbarSelectedTextColor: string;
    tabbarUnselectedTextColor: string;
    getTabbarList: () => Promise<void>;
    setCurrRoute: (route: string) => void;
}

export const useTabbarStore = create<TabbarState>((set) => ({
    tabbarListDefault: [],
    tabbarEnableAnimation: false,
    tabbarHeightNum: rpxToDevicePx(TABBAR_HEIGHT_RPX),
    currRoute: "",
    tabbarBackgroundColorType: 1,
    tabbarBackgroundColor: "",
    tabbarCornerStyle: 1,
    tabbarIconColorType: 1,
    tabbarSelectedTextColor: "",
    tabbarUnselectedTextColor: "",

    setCurrRoute(route: string) {
        set({ currRoute: route });
    },

    async getTabbarList() {
        try {
            const result = await getMobileNav({ isNew: 1 });
            // request 已解包，result 即响应体：
            // 1) 新结构：result 直接包含 navList / enableAnimation
            // 2) 旧结构：navList 位于 result.data（对象或 JSON 字符串）中
            const root = result && typeof result === "object" ? (result as Record<string, any>) : {};
            let navSource: Record<string, any> = root;
            if (!Array.isArray(root.navList) && root.data) {
                navSource = typeof root.data === "string" ? JSON.parse(root.data) : root.data;
            }
            const navList = Array.isArray(navSource?.navList) ? navSource.navList : [];
            // 开启缩放动画效果开关（兼容 true/false 或 1/0）
            const enableAnimation =
                navSource?.enableAnimation === true || navSource?.enableAnimation === 1 || navSource?.enableAnimation === "1";
            set({
                tabbarEnableAnimation: enableAnimation,
                // 背景与配色配置（老数据缺字段时用系统默认）
                tabbarBackgroundColorType: Number(navSource?.backgroundColorType) || 1,
                tabbarBackgroundColor: navSource?.backgroundColor || "",
                tabbarCornerStyle: Number(navSource?.cornerStyle) || 1,
                tabbarIconColorType: Number(navSource?.iconColorType) || 1,
                tabbarSelectedTextColor: navSource?.selectedTextColor || "",
                tabbarUnselectedTextColor: navSource?.unselectedTextColor || "",
                tabbarListDefault: navList.map((item: any) => {
                    return {
                        link: item.picLink,
                        image: item.picThumb,
                        activeImage: item.picActiveThumb,
                        text: item.picTitle
                    };
                })
            });
        } catch (error) {
            set({
                tabbarEnableAnimation: false,
                tabbarBackgroundColorType: 1,
                tabbarBackgroundColor: "",
                tabbarCornerStyle: 1,
                tabbarIconColorType: 1,
                tabbarSelectedTextColor: "",
                tabbarUnselectedTextColor: "",
                tabbarListDefault: [
                    {
                        link: "/pages/index/index",
                        image: ico1,
                        activeImage: ico1h,
                        text: t("首页")
                    },
                    {
                        link: "/pages/productCate/index",
                        image: ico2,
                        activeImage: ico2h,
                        text: t("分类")
                    },
                    {
                        link: "/pages/cart/index",
                        image: ico3,
                        activeImage: ico3h,
                        text: t("购物车")
                    },
                    {
                        link: "/pages/member/index",
                        image: ico4,
                        activeImage: ico4h,
                        text: t("我的")
                    }
                ]
            });
            console.error(error);
        }
    }
}));

/**
 * 自定义 tabBar 的派生数据。
 * 旧方案是 pinia computed；React 下做成组合两个 store 的 hook，
 * 页面（自定义 Tabbar 组件）只需订阅这一个 hook。
 */
export function useTabbarDerived() {
    const tabbarListDefault = useTabbarStore((s) => s.tabbarListDefault);
    const tabbarHeightNum = useTabbarStore((s) => s.tabbarHeightNum);
    const currRoute = useTabbarStore((s) => s.currRoute);
    const backgroundColorType = useTabbarStore((s) => s.tabbarBackgroundColorType);
    const backgroundColor = useTabbarStore((s) => s.tabbarBackgroundColor);
    const cornerStyle = useTabbarStore((s) => s.tabbarCornerStyle);
    const tabbarEnableAnimation = useTabbarStore((s) => s.tabbarEnableAnimation);
    const tabbarIconColorType = useTabbarStore((s) => s.tabbarIconColorType);
    const tabbarSelectedTextColor = useTabbarStore((s) => s.tabbarSelectedTextColor);
    const tabbarUnselectedTextColor = useTabbarStore((s) => s.tabbarUnselectedTextColor);
    const buyerShowEnabled = useConfigStore((s) => s.buyerShowEnabled);
    const safeBottom = useConfigStore((s) => s.safeAreaInsets.bottom);

    const tabbarList = useMemo(() => {
        if (buyerShowEnabled !== 1) {
            return tabbarListDefault.filter((item) => {
                return item?.link !== "/pages/buyerShow/index" && item?.link !== "buyerShow";
            });
        }
        return tabbarListDefault;
    }, [tabbarListDefault, buyerShowEnabled]);

    const tabbarHeight = `${tabbarHeightNum + safeBottom}px`;

    // 自定义背景色，系统色时返回空让组件走默认
    const tabbarBackground = backgroundColorType === 2 && backgroundColor ? backgroundColor : "";

    // 顶部圆角：直角/圆角/大圆角
    let tabbarRadius = "0";
    switch (cornerStyle) {
        case 2:
            tabbarRadius = "16rpx 16rpx 0 0";
            break;
        case 3:
            tabbarRadius = "32rpx 32rpx 0 0";
            break;
    }

    const formatTabarList = useMemo(() => {
        return tabbarList.map((item) => urlFormat(item.link).split("?")[0]);
    }, [tabbarList]);

    const currentActiveValue = formatTabarList.findIndex((item) => {
        return `/${currRoute}` === item;
    });

    return {
        tabbarList,
        tabbarEnableAnimation,
        tabbarHeight,
        tabbarHeightNum,
        tabbarBackground,
        tabbarRadius,
        tabbarIconColorType,
        tabbarSelectedTextColor,
        tabbarUnselectedTextColor,
        formatTabarList,
        currentActiveValue,
        currRoute
    };
}

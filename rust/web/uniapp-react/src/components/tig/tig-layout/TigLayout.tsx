import type { ReactNode } from "react";
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from "react";
import { View } from "@tarojs/components";

import { useTabbarStore, useTabbarDerived } from "@/store/tabbar";
import { useConfigStore } from "@/store/config";
import { useThemeStore } from "@/store/theme";
import { useI18nStore } from "@/store/i18n";
import { isOverseas } from "@/utils";
import { useSaveTopBoxHeight } from "@/hooks";
import TigNavbar from "@/components/tig/tig-navbar/TigNavbar";
import TigTabbar from "@/components/tig/tig-tabbar/TigTabbar";
import TigWechartLogin from "@/components/tig/tig-wechart-login/TigWechartLogin";
import TigStatisticLog, { type TigStatisticLogRef } from "@/components/tig/tig-statistic-log/TigStatisticLog";

import "./TigLayout.scss";

interface Props {
    needSafeTop?: boolean;
    needSafeBottom?: boolean;
    safeTopBgColor?: string;
    productId?: number | string;
    shopId?: number | string;
    shopCategoryId?: number | string;
    immediateLog?: boolean;
    title?: string;
    customBack?: boolean;
    borderBottom?: boolean;
    background?: string;
    color?: string;
    overflow?: boolean;
    topSlot?: ReactNode;
    navbarRightSlot?: ReactNode;
    children: ReactNode;
    onLoginSuccess?: () => void;
    onBack?: () => void;
}

export interface TigLayoutRef {
    handleLog: () => void;
    isZh: boolean;
}

/**
 * 页面外壳（自旧 tig-layout.vue 移植）：
 * - 根节点注入主题 CSS 变量（themeStyle 的 --general 系 + tabbar/安全区/nav 高度）
 * - 可选标题导航、安全区占位、tab 页自动挂底部导航
 * - 埋点组件随壳挂载，页面可通过 ref 触发 __commonLog
 */
const TigLayout = forwardRef<TigLayoutRef, Props>(function TigLayout(
    {
        needSafeTop = false,
        needSafeBottom = true,
        safeTopBgColor = "#fff",
        productId,
        shopId,
        shopCategoryId,
        immediateLog = true,
        title,
        customBack = false,
        borderBottom = false,
        background = "#fff",
        color = "#000",
        overflow = true,
        topSlot,
        navbarRightSlot,
        children,
        onLoginSuccess,
        onBack
    },
    ref
) {
    const { currentActiveValue } = useTabbarDerived();
    const themeStyle = useThemeStore((s) => s.themeStyle);
    const tabbarHeightNum = useTabbarStore((s) => s.tabbarHeightNum);
    const navHeight = useConfigStore((s) => s.navHeight);
    const safeBottom = useConfigStore((s) => s.safeAreaInsets.bottom);
    const shopTitle = useConfigStore((s) => s.baseInfo.shopTitle);
    const clientType = useConfigStore((s) => s.XClientType);
    const openWechatRegister = useConfigStore((s) => s.openWechatRegister);
    const langCode = useI18nStore((s) => s.langCode);
    const { height } = useSaveTopBoxHeight();

    const isZh = isOverseas() ? (langCode ? langCode.includes("zh") : true) : true;

    const cssVariable = useMemo(() => {
        return {
            ...themeStyle,
            "--tabbar-height": `${tabbarHeightNum}px`,
            "--safe-bottom": `${safeBottom}px`,
            "--safe-top": `${height}px`,
            "--nav-height": `${navHeight}rpx`
        } as Record<string, string | number>;
    }, [themeStyle, tabbarHeightNum, safeBottom, height, navHeight]);

    // H5：未显式传 title 时跟随店铺名（对应旧 watch immediate）
    useEffect(() => {
        if (process.env.TARO_ENV !== "h5") return;
        if (title === undefined && shopTitle) {
            useConfigStore.getState().setH5Title();
        }
    }, [shopTitle, title]);

    const statisticLogRef = useRef<TigStatisticLogRef>(null);
    useImperativeHandle(ref, () => ({
        handleLog: () => statisticLogRef.current?.__commonLog(),
        isZh
    }));

    return (
        <View className={`layout layout-root-a2FvbC10aWdzaG9w ${!isZh && isOverseas() ? "not-zh" : ""}`} style={{ ...cssVariable } as any}>
            {needSafeTop && <View className="safe-top-box" style={`background: ${safeTopBgColor};`} />}

            {title !== undefined && (
                <TigNavbar
                    title={title}
                    borderBottom={borderBottom}
                    background={background}
                    color={color}
                    customBack={customBack}
                    rightSlot={navbarRightSlot}
                    onBack={onBack}
                />
            )}

            {topSlot}

            <View className={`layout-content layout-body-bjIyODJneWs ${overflow ? "overflow" : ""}`}>{children}</View>

            {currentActiveValue === -1 && needSafeBottom && <View className="layout-safe-bottom" />}

            {currentActiveValue > -1 && <TigTabbar />}

            {/* H5 微信授权登录弹层（自旧 tig-layout.vue 的 <tig-wechart-login @login-success="$emit('loginSuccess')" /> 移植接线，含原渲染条件） */}
            {(clientType === "miniProgram" || clientType === "wechat") && openWechatRegister === 1 && (
                <TigWechartLogin onLoginSuccess={onLoginSuccess} />
            )}
            {/* TODO(MIGRATION)：App 更新弹层随 App 端批次移植 */}
            <TigStatisticLog ref={statisticLogRef} immediateLog={immediateLog} productId={productId} shopId={shopId} shopCategoryId={shopCategoryId} />
        </View>
    );
});

export default TigLayout;

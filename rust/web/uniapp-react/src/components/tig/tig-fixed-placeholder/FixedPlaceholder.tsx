import type { CSSProperties, ReactNode } from "react";
import { View } from "@tarojs/components";

import { useTabbarDerived } from "@/store/tabbar";

import "./FixedPlaceholder.scss";

interface Props {
    /** 旧 height（数字按 rpx 处理） */
    height?: number | string;
    /** 旧 background-color */
    backgroundColor?: string;
    /** 旧 border（true：无阴影 + 顶部 1px 分隔线） */
    border?: boolean;
    children?: ReactNode;
}

const addUnit = (value: number | string) => (/^\d+(\.\d+)?$/.test(String(value)) ? `${value}rpx` : String(value));

/**
 * 底部固定操作栏 + 等高占位（自旧 components/tig/tig-fixed-placeholder/tig-fixed-placeholder.vue 移植）
 * - fixed bottom + 安全区 padding
 * - 命中底部导航装修时抬到 tabbar 上方，占位同步增加 tabbar 高度
 */
export default function FixedPlaceholder({ height = 120, backgroundColor = "transparent", border = true, children }: Props) {
    const { currentActiveValue } = useTabbarDerived();
    const hasTabbar = currentActiveValue > -1;
    const heightValue = addUnit(height);

    const contentStyle: CSSProperties = {
        height: heightValue,
        backgroundColor,
        ...(hasTabbar ? { bottom: "var(--tabbar-height)", paddingBottom: 0 } : {})
    };
    const paddingTop = hasTabbar ? `calc(${heightValue} + var(--tabbar-height))` : `calc(${heightValue} + var(--safe-bottom))`;

    return (
        <View className="fixed-placeholder">
            <View className={`content${border ? " border" : ""}`} style={contentStyle}>
                {children}
            </View>
            <View className="placeholder" style={{ paddingTop }} />
        </View>
    );
}
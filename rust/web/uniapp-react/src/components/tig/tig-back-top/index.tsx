import { useMemo } from "react";
import { Image, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { useTabbarStore } from "@/store/tabbar";
import { useConfigStore } from "@/store/config";
import { staticResource } from "@/utils";

import "./index.scss";

interface Props {
    right?: number;
    bottom?: number;
    duration?: number;
    scrollTop?: number | string;
    zIndex?: number | string;
    /** uview u-back-top 的 mode 字段，视觉统一为圆形按钮（保留 prop 兼容旧调用） */
    mode?: string;
    iconStyle?: Record<string, any>;
    customStyle?: Record<string, any>;
}

/**
 * 返回顶部（自旧 tig/tig-back-top/tig-back-top.vue 移植）：
 * - 旧实现基于 uview u-back-top，滚动超过一屏后出现，点击回到顶部；
 * - uview 源码不在本仓库内，按钮视觉按其默认圆形图标样式复刻。
 */
export default function TigBackTop({
    right = 15,
    bottom = 20,
    duration = 500,
    scrollTop = 0,
    zIndex = 999,
    mode: _mode = "circle",
    iconStyle = { fontSize: "32rpx", color: "#333" },
    customStyle = { backgroundColor: "#fff" }
}: Props) {
    const tabbarHeightNum = useTabbarStore((s) => s.tabbarHeightNum);
    const safeBottom = useConfigStore((s) => s.safeAreaInsets.bottom);

    // 对应旧 computed styleFormat
    const styleFormat = useMemo(
        () => ({
            right: `${right}rpx`,
            bottom: `${bottom + tabbarHeightNum + safeBottom}px`
        }),
        [right, bottom, tabbarHeightNum, safeBottom]
    );

    // uview 默认行为：滚动超过一屏后显示
    const show = useMemo(() => Number(scrollTop) > 500, [scrollTop]);
    if (!show) return null;

    const handleClick = () => {
        Taro.pageScrollTo({ scrollTop: 0, duration });
    };

    return (
        <View className="tig-back-top" style={{ ...styleFormat, zIndex, ...customStyle } as any} onClick={handleClick}>
            {/* 本仓库无 uview 内置上箭头资源，复用右箭头图旋转 -90° 呈现向上箭头 */}
            <Image className="tig-back-top__icon" src={staticResource("common/right_arrows.png")} mode="widthFix" style={iconStyle as any} />
        </View>
    );
}

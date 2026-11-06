import type { ReactNode } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { navigateBack } from "@/utils/navigation";
import { t } from "@/utils/i18n";

import "./TigNavbar.scss";

interface Props {
    title?: string;
    background?: string;
    showLeft?: boolean;
    /** 是否自定义返回事件 */
    customBack?: boolean;
    borderBottom?: boolean;
    color?: string;
    needPlaceholder?: boolean;
    /** false：相对定位，可随页面下拉/吸顶容器一起移动（对齐 vortmall order/list） */
    fixed?: boolean;
    leftSlot?: ReactNode;
    rightSlot?: ReactNode;
    titleSlot?: ReactNode;
    onBack?: () => void;
}

/**
 * 小程序端：右侧插槽有内容时，整行右侧预留胶囊区域（胶囊宽度 + 胶囊右边距）。
 * 设备相关、每次启动后不变，这里做惰性单例（对应旧版的立即求值 IIFE）。
 */
let capsuleReserveStyleCache: string | null = null;
const getCapsuleReserveStyle = (): string => {
    if (capsuleReserveStyleCache !== null) return capsuleReserveStyleCache;
    capsuleReserveStyleCache = "";
    if (typeof Taro.getMenuButtonBoundingClientRect !== "function") return capsuleReserveStyleCache;
    try {
        const rect = Taro.getMenuButtonBoundingClientRect();
        const { windowWidth } = Taro.getSystemInfoSync();
        if (!rect || !rect.left || !windowWidth) return capsuleReserveStyleCache;
        const reserve = Math.ceil(windowWidth - rect.left);
        capsuleReserveStyleCache = reserve > 0 ? `padding-right: ${reserve}px; box-sizing: border-box;` : "";
    } catch {
        capsuleReserveStyleCache = "";
    }
    return capsuleReserveStyleCache;
};

let backLock = false;

export default function TigNavbar({
    title = "",
    background = "#fff",
    showLeft = true,
    customBack = false,
    borderBottom = false,
    color = "#000",
    needPlaceholder = true,
    fixed = true,
    leftSlot,
    rightSlot,
    titleSlot,
    onBack
}: Props) {
    const handleIcon = () => {
        // 避免连点/重复触发导致返回两次
        if (backLock) return;
        backLock = true;
        setTimeout(() => {
            backLock = false;
        }, 400);
        if (customBack) {
            onBack?.();
        } else {
            navigateBack();
        }
    };

    return (
        <View className="tig-navbar">
            <View
                className={`navbar-box ${borderBottom ? "border-bottom" : ""} ${!fixed ? "is-static" : ""}`}
                style={`background: ${background};`}
            >
                <View className="navbar">
                    <View className="navbar-content" style={rightSlot ? getCapsuleReserveStyle() : ""}>
                        <View className="left">
                            {showLeft && (leftSlot ?? <View className="iconfont icon-houtui" onClick={handleIcon} />)}
                        </View>

                        <View className="middle">
                            {titleSlot ?? (
                                <View className="title line1" style={`color: ${color};`}>
                                    <Text>{t(title)}</Text>
                                </View>
                            )}
                        </View>

                        <View className="right">{rightSlot}</View>
                    </View>
                </View>
            </View>
            {needPlaceholder && fixed && <View className="placeholder" />}
        </View>
    );
}

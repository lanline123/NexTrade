import { Image, View } from "@tarojs/components";

import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./EmptyBox.scss";

interface Props {
    /** 旧 u-empty 的 mode（本实现不区分模式，仅保留 prop 兼容） */
    mode?: string;
    height?: string;
    background?: string;
    text?: string;
    /** 图标路径（相对 static 资源目录） */
    icon?: string;
    iconWidth?: string;
    iconHeight?: string;
    centerContent?: boolean;
}

/**
 * 通用空状态（自旧 components/empty-box/empty-box.vue 移植，内部 u-empty → 基础组件自绘）：
 * - 旧 u-empty 的内置图标/文案排版按 uview-plus 默认视觉（图标居中、文案 28rpx/#909399、间距 20rpx）复刻
 * - 保留旧 class（含 empty-shell 哈希 class，供既有页面样式命中）
 */
export default function EmptyBox({
    mode = "search",
    height = "300rpx",
    background = "#fff",
    text = "",
    icon = "common/empty-box.png",
    iconWidth = "240rpx",
    iconHeight = "240rpx",
    centerContent = false
}: Props) {
    void mode;
    const displayText = text || t("暂无数据");

    return (
        <View
            className={`empty-box empty-shell-aGZ0dzIyODI${centerContent ? " empty-box--center-content" : ""}`}
            style={{ height, background }}
        >
            <View className="empty-icon">
                <Image className="empty-img" src={staticResource(icon)} mode="aspectFit" style={{ width: iconWidth, height: iconHeight }} />
            </View>
            <View className="empty-text">{displayText}</View>
        </View>
    );
}
import { View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    /** 对应旧 v-model（modelValue）：true = 显示加载页 */
    modelValue?: boolean;
    loadingText?: string;
    mode?: string;
    image?: string;
    fontSize?: string;
    bgColor?: string;
}

/**
 * 页面加载中（自旧 tig/tig-loadingpage/tig-loadingpage.vue 移植）：
 * - 旧实现为 uview up-loading-page 全屏加载页，源码不在本仓库内；
 * - 视觉按其默认行为复刻：全屏纯色遮罩 + 居中 loading 圈 + 文案。
 */
export default function TigLoadingPage({
    modelValue = true,
    loadingText = "加载中",
    mode: _mode = "circle",
    image: _image = "",
    fontSize = "16",
    bgColor = "#ffffff"
}: Props) {
    if (!modelValue) return null;

    return (
        <View className="tig-loading-page" style={{ backgroundColor: bgColor }}>
            <View className="tig-loading-page__content">
                <View className="tig-loading-page__spinner" />
                <View className="tig-loading-page__text" style={{ fontSize: `${fontSize}px` }}>
                    {t(loadingText)}
                </View>
            </View>
        </View>
    );
}

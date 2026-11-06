import { Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./previewTip.scss";

/**
 * 预览提示组件（自旧 pages/index/src/previewTip.vue 移植）
 * - 装修预览模式下（configStore.previewId > 0）显示顶部固定提示条
 * - 固定在页面顶部，下方用等高占位撑开，避免遮挡首屏装修内容
 */
export default function PreviewTip() {
    return (
        <View>
            <View className="preview-box">
                <View>
                    {t("预览")}
                    ：&emsp;
                    <Text>{t("移动端")}</Text>
                </View>
            </View>
            <View className="placeholder" />
        </View>
    );
}
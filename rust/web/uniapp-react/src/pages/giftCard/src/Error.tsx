import type { CSSProperties } from "react";
import { View } from "@tarojs/components";

import { redirect, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./Error.scss";

interface Props {
    message?: string;
}

/**
 * 礼品卡错误态（自旧 pages/giftCard/src/error.vue 移植）
 * - 旧 v-bind(errorImage) → 根节点 CSS 变量
 */
export default function Error({ message = "页面失效" }: Props) {
    const errorImage = `url(${staticResource("product/noDetail.png")})`;

    const handleClick = () => {
        redirect({ url: "/pages/index/index" });
        console.log("Redirecting to home page");
    };

    return (
        <View className="error-page">
            <View className="error-content" style={{ "--error-image": errorImage } as CSSProperties}>
                <View className="error-image" />
                <View className="error-text">{t(message)}</View>
                <View className="error-btn-box">
                    {/* TODO(MIGRATION)：旧 view 上的 `theme` 属性为 uview 主题标记，Taro View 无同名 prop，视觉由 scss 承接 */}
                    <View className="error-btn" onClick={handleClick}>
                        {t("进店逛逛")}
                    </View>
                </View>
            </View>
        </View>
    );
}
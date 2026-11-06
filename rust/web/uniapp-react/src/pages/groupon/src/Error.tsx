import { View } from "@tarojs/components";

import { redirect, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./Error.scss";

/**
 * 拼团错误页组件（自旧 pages/groupon/src/error.vue 移植）
 * - 显示拼团活动已结束或不存在提示
 */
export default function GrouponError() {
    const handleClick = () => {
        redirect({ url: "/pages/index/index" });
        console.log("Redirecting to home page");
    };

    const errorImg = `url("${staticResource("product/video-playing.png")}")`;

    return (
        <View className="error-page">
            <View className="error-content">
                <View className="error-image" style={{ backgroundImage: errorImg }} />
                <View className="error-text">{t("页面失效")}</View>
                <View className="error-btn-box">
                    <View className="error-btn theme" onClick={handleClick}>
                        {t("进店逛逛")}
                    </View>
                </View>
            </View>
        </View>
    );
}
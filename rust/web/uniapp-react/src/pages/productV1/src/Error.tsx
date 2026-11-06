import { View } from "@tarojs/components";

import { redirect, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./Error.scss";

/**
 * 商品下架/异常页组件（自旧 pages/productV1/src/error.vue 移植）
 * - 显示商品不存在提示
 * - 提供返回首页按钮
 * - 原 v-bind(errorImg) → 组件内联 style backgroundImage
 *
 * 与 B2 pages/product/src/error 的差异：productV1 版无 productOffline prop，
 * 文案固定为「页面失效 / 进店逛逛」，故按旧源码独立落盘。
 */
export default function ErrorPage() {
    const handleClick = () => {
        redirect({ url: "/pages/index/index" });
    };

    const errorImg = `url("${staticResource("product/noDetail.png")}")`;

    return (
        <View className="error-page">
            <View className="error-content">
                {/* 原 background-image: v-bind(errorImg) → 内联 style */}
                <View className="error-image" style={{ backgroundImage: errorImg }} />
                <View className="error-text">{t("页面失效")}</View>
                <View className="error-btn-box">
                    <View className="error-btn" onClick={handleClick}>
                        {t("进店逛逛")}
                    </View>
                </View>
            </View>
        </View>
    );
}
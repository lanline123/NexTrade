import { View } from "@tarojs/components";

import { redirect, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    productOffline?: boolean;
}

/**
 * 商品下架/异常页组件（自旧 pages/product/src/error.vue 移植）
 * - 显示商品不存在或已下架提示
 * - 提供返回首页按钮
 * - 原 v-bind(errorImg) → 组件内联 style backgroundImage
 */
export default function Error({ productOffline = false }: Props) {
    const handleClick = () => {
        redirect({ url: "/pages/index/index" });
    };

    const errorImg = `url("${staticResource("product/noDetail.png")}")`;

    return (
        <View className="error-page">
            <View className="error-content">
                {/* 原 background-image: v-bind(errorImg) → 内联 style */}
                <View className="error-image" style={{ backgroundImage: errorImg }} />
                <View className="error-text">{t(productOffline ? "该商品已下架" : "页面失效")}</View>
                <View className="error-btn-box">
                    <View className="error-btn" onClick={handleClick}>
                        {t("去逛逛")}
                    </View>
                </View>
            </View>
        </View>
    );
}

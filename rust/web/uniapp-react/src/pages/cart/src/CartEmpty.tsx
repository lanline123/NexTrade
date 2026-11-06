import { View, Text, Image } from "@tarojs/components";

import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./CartEmpty.scss";

/**
 * 购物车空状态组件（自旧 pages/cart/src/cartEmpty.vue 移植）
 * - 显示购物车为空的提示图标和文字
 */
export default function CartEmpty() {
    return (
        <View className="cart-empty-box">
            <View className="cart-empty-content" data-content-rev="aHR4MjI4MnA">
                <View className="empty-img">
                    <Image src={staticResource("cart/cart-empty.png")} />
                </View>
                <Text className="empty-text">{t("还没有商品？")}</Text>
            </View>
        </View>
    );
}

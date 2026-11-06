import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    /** 空状态文案（旧 text prop 为必填） */
    text: string;
}

/**
 * 店铺列表空状态（自旧 components/shopListEmpty/index.vue 移植）：
 * - 空图 + 文案 + 「返回首页」按钮（旧 tig-button2 → TigButton2，class 保留 .empty-btn 供样式命中）
 */
export default function ShopListEmpty({ text }: Props) {
    const toHomePage = () => {
        Taro.switchTab({ url: "/pages/index/index" }).catch(() => {});
    };

    return (
        <View className="empty-container shop-empty-bHcyMjgydWI">
            <Image className="empty-image" src={staticResource("empty/emptyProduct.png")} mode="aspectFit" />
            <Text className="empty-text">{text}</Text>
            <TigButton2 className="empty-btn" onClick={toHomePage}>
                {t("返回首页")}
            </TigButton2>
        </View>
    );
}

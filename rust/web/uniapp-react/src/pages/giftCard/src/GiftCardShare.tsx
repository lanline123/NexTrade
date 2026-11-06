import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import { copy } from "@/utils";
import { t } from "@/utils/i18n";

import "./GiftCardShare.scss";

interface Props {
    /** 旧 v-model */
    modelValue: boolean;
    linkUrl: string;
    onUpdateModelValue?: (value: boolean) => void;
}

/**
 * 礼品卡转赠分享弹层（自旧 pages/giftCard/src/giftCardShare.vue 移植）
 * - 旧 tig-popup → NutUI Popup（bottom）
 * - 复制链接后关闭并 toast
 */
export default function GiftCardShare({ modelValue, linkUrl, onUpdateModelValue }: Props) {
    const handleCopy = () => {
        onUpdateModelValue?.(false);
        copy(linkUrl, () => {
            Taro.showToast({
                title: t("复制成功"),
                icon: "none"
            });
        });
    };

    return (
        <View className="share">
            <Popup
                visible={modelValue}
                position="bottom"
                round
                closeable
                onClose={() => onUpdateModelValue?.(false)}
            >
                <View className="share-title"> {t("分享")} </View>
                <View className="share-content">
                    <View className="share-item" onClick={handleCopy}>
                        <Text className="iconfont-h5 icon-link" />
                        <Text className="share-item-text">{t("复制链接")}</Text>
                    </View>
                </View>
            </Popup>
        </View>
    );
}
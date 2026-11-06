import { useEffect, useState } from "react";
import { ScrollView, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import type { GiftCardInfo } from "@/types/giftCard/giftCard";
import { t } from "@/utils/i18n";
import GiftCard from "./GiftCard";

import "./GiftCardSelect.scss";

interface Props {
    /** 旧 v-model:modelValue */
    modelValue?: boolean;
    cards?: GiftCardInfo[];
    onUpdateModelValue?: (value: boolean) => void;
    /** 旧 @ok-call-back */
    okCallBack?: (giftCard: GiftCardInfo) => void;
}

/**
 * 礼品卡选择弹层（自旧 pages/giftCard/src/giftCardSelect.vue 移植）
 * - 旧 tig-popup → NutUI Popup（bottom / z-index 999 / 无关闭按钮 / 白底）
 * - 旧 radio-group + radio → 基础组件自绘单选，选中色沿用 --general
 */
export default function GiftCardSelect({ modelValue = false, cards, onUpdateModelValue, okCallBack }: Props) {
    const [selectedCardId, setSelectedCardId] = useState<number>(0);

    // 旧 watch(() => show)：打开时默认选中第一张
    useEffect(() => {
        if (modelValue) {
            if (cards && cards.length) {
                setSelectedCardId(cards[0].giftCardsId);
            }
        }
    }, [modelValue, cards]);

    const handleChange = (value: string) => {
        setSelectedCardId(Number(value));
    };

    const handleOkClick = () => {
        if (selectedCardId == 0) {
            // 提示用户选择卡片
            Taro.showToast({
                title: t("请选择礼品卡"),
                icon: "none"
            });
            return;
        }
        const selectedCard = cards?.find((item) => item.giftCardsId === selectedCardId);
        if (!selectedCard) {
            return;
        }
        onUpdateModelValue?.(false);
        okCallBack?.(selectedCard);
    };

    return (
        <Popup
            visible={modelValue}
            position="bottom"
            zIndex={999}
            closeable={false}
            style={{ backgroundColor: "#fff" }}
            onClose={() => onUpdateModelValue?.(false)}
        >
            <View className="card-list-container">
                <View className="popup-title">{t("选择礼品卡")}</View>
                {cards && cards.length ? (
                    <ScrollView scrollY className="card-list">
                        <View className="radio-list">
                            {cards.map((item) => (
                                <View
                                    key={item.giftCardsId}
                                    className="radio-item"
                                    onClick={() => handleChange(String(item.giftCardsId))}
                                >
                                    <View className="gift-card-item">
                                        <GiftCard cardInfo={item} />
                                    </View>
                                    <View>
                                        {/* 旧 <radio color="var(--general)" />：自绘单选圆点 */}
                                        <View className={`radio-dot${item.giftCardsId === selectedCardId ? " checked" : ""}`} />
                                    </View>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                ) : null}
                <FixedPlaceholder backgroundColor="#fff">
                    <View className="btn-box">
                        <TigButton2 className="btn" onClick={handleOkClick}>
                            {" "}
                            {t("确定")}{" "}
                        </TigButton2>
                    </View>
                </FixedPlaceholder>
            </View>
        </Popup>
    );
}
import { useState } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { useCreditInfo } from "@/hooks/useCreditInfo";
import { useUserStore } from "@/store/user";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./termPayCard.scss";

/**
 * 账期支付卡片（自旧 pages/member/components/termPay/termPayCard.vue 移植）
 * 与装修版外壳 fixedFunctionalArea 共用 useCreditInfo 的显示判断
 */
export default function TermPayCard() {
    const token = useUserStore((s) => s.token);
    // 与装修版外壳 fixedFunctionalArea 共用同一份判断，避免外壳把本卡片挡住
    const { creditInfo, showTermPay } = useCreditInfo();
    const [showAmount, setShowAmount] = useState(false);

    const toggleAmount = () => {
        setShowAmount((prev) => !prev);
    };

    const isLoggedIn = () => !!token || !!Taro.getStorageSync("token");

    const cardBgStyle = {
        backgroundImage: `url(${staticResource("termPay/termPay_card.png")})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat"
    };

    const handleEnterTermPay = () => {
        // 检查登录状态
        if (!isLoggedIn()) {
            Taro.showToast({
                title: t("请先登录"),
                icon: "none"
            });
            return;
        }
        Taro.navigateTo({
            url: "/pages/user/termPay/detail"
        });
    };

    if (!showTermPay) return null;

    return (
        <View className="delivery-card" style={cardBgStyle}>
            {/* 标题栏 */}
            <View className="delivery-card__title acea-row row-between-wrapper">
                <View className="delivery-card__title-left">
                    <View className="delivery-card__title-text">{t("账期支付")}</View>
                    <View
                        className={`iconfont-h5 toggle-eye ${showAmount ? "icon-xianshi" : "icon-buxianshi"}`}
                        onClick={(e) => {
                            e.stopPropagation();
                            toggleAmount();
                        }}
                    />
                </View>
                <View
                    className="delivery-card__title-more"
                    onClick={(e) => {
                        e.stopPropagation();
                        handleEnterTermPay();
                    }}
                >
                    <View className="delivery-card__title-more-text">{t("查看详情")}</View>
                    <View className="iconfont icon-xiangyou" />
                </View>
            </View>

            {/* 内容区域 */}
            <View className="delivery-card__content">
                <View className="delivery-card__wrap">
                    <View className="delivery-card__item">
                        <View className="delivery-card__item-number">{showAmount ? creditInfo?.creditLimit : "******"}</View>
                        <View className="delivery-card__item-text">{t("信用额度")}</View>
                    </View>
                    <View className="delivery-card__item">
                        <View className="delivery-card__item-number">{showAmount ? creditInfo?.usedAmount : "******"}</View>
                        <View className="delivery-card__item-text">{t("已用额度")}</View>
                    </View>
                    <View className="delivery-card__item">
                        <View className="delivery-card__item-number">{showAmount ? creditInfo?.availableAmount : "******"}</View>
                        <View className="delivery-card__item-text">{t("剩余额度")}</View>
                    </View>
                </View>
            </View>
        </View>
    );
}
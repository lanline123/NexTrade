import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import dayjs from "dayjs";

import { getGiftCardPassword } from "@/api/giftCard/giftCard";
import type { GiftCardInfo } from "@/types/giftCard/giftCard";
import { copy, staticResource } from "@/utils";
import { copyGiftCard } from "@/utils/giftCard";
import { t } from "@/utils/i18n";

import "./GiftCard.scss";

interface Props {
    cardSize?: "large" | "small";
    cardInfo?: GiftCardInfo;
    showActions?: boolean;
}

/**
 * 礼品卡卡面（自旧 pages/giftCard/src/giftCard.vue 移植）
 * - 展示店铺名、卡号、卡密、卡名、有效期与状态角标
 * - showActions 时提供复制卡号/卡密、复制券码、显示/隐藏券码
 * - 卡密默认脱敏，首次展示时按需拉取
 */
export default function GiftCard({ cardSize = "small", cardInfo = {} as GiftCardInfo, showActions = true }: Props) {
    const [cardBg] = useState(() => staticResource("giftCard/card_bg.png"));
    const [showGiftCardNo, setShowGiftCardNo] = useState(false);
    const [isGetCardPassword, setIsGetCardPassword] = useState(false);
    // 旧 ref 初值即 props.cardInfo 的原始值，仅在挂载时取一次
    const [hideCardNumber, setHideCardNumber] = useState(cardInfo?.cardNumber || "");
    const [hideCardPassword, setHideCardPassword] = useState(cardInfo?.cardPassword || "");
    const [cardNumber, setCardNumber] = useState("");
    const [cardPassword, setCardPassword] = useState("");

    // 旧 v-bind(cardBackgroundImg) → 根节点 CSS 变量
    const cardBackgroundImg = useMemo(() => {
        return `url(${cardInfo?.imageUrl || cardBg}) center no-repeat`;
    }, [cardInfo?.imageUrl, cardBg]);

    const statusMap: Record<number, string> = {
        0: t("待兑换"),
        1: t("已兑换"),
        2: t("已过期")
    };

    // 判断礼品卡是否已过期
    const isExpired = useMemo(() => {
        const expiredTime = cardInfo?.expiredTime;
        // 如果过期时间为0或不存在，表示长期有效，不会过期
        if (!expiredTime || expiredTime == 0) {
            return false;
        }
        // 将秒级时间戳转换为毫秒级，然后与当前时间比较
        const expiredTimestamp = expiredTime * 1000;
        const currentTimestamp = Date.now();
        return currentTimestamp > expiredTimestamp;
    }, [cardInfo?.expiredTime]);

    // 计算显示的状态
    const displayStatus = useMemo(() => {
        const status = cardInfo?.status || 0;
        // 如果是已兑换，显示已兑换
        if (status === 1) {
            return statusMap[1]; // 已兑换
        }
        // 如果是未兑换，根据过期时间判断
        if (isExpired) {
            return statusMap[2]; // 已过期
        }
        return statusMap[0]; // 待兑换
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [cardInfo?.status, isExpired]);

    const _getGiftCardPassword = async () => {
        try {
            const res: any = await getGiftCardPassword(cardInfo?.cardNumber, cardInfo?.giftCardSn);
            setIsGetCardPassword(true);
            setCardNumber(res.cardNumber);
            setCardPassword(res.cardPassword);
        } catch (error: any) {
            console.error(error);
        }
    };

    const formatTimestamp = (timestamp: string | number) => {
        // 使用dayjs格式化时间
        return dayjs(timestamp).format("YYYY-MM-DD");
    };

    const handleShowGiftCardNo = async () => {
        if (!isGetCardPassword) {
            await _getGiftCardPassword();
        }
        if (!isGetCardPassword) {
            return;
        }
        setShowGiftCardNo((prev) => !prev);
    };

    const handleCardNumberCopy = async () => {
        if (!isGetCardPassword) {
            await _getGiftCardPassword();
        }
        copy(cardNumber, () => {
            Taro.showToast({
                title: t("复制成功"),
                icon: "none"
            });
        });
    };

    const handlePasswordCopy = async () => {
        if (!isGetCardPassword) {
            await _getGiftCardPassword();
        }
        copy(cardPassword, () => {
            Taro.showToast({
                title: t("复制成功"),
                icon: "none"
            });
        });
    };

    // 一键复制卡号和卡密
    const handleCopyAll = async () => {
        if (!isGetCardPassword) {
            await _getGiftCardPassword();
        }
        if (!isGetCardPassword) {
            return;
        }
        const success = await copyGiftCard(cardNumber, cardPassword);
        if (success) {
            Taro.showToast({
                title: t("复制成功"),
                icon: "none"
            });
        }
    };

    return (
        <View
            className={`gift-card-box size-${cardSize}`}
            style={{ "--gift-card-bg": cardBackgroundImg } as CSSProperties}
        >
            <View className="gift-card">
                <View className="gift-shop-info">
                    {/* 旧注释保留：店铺 logo 分支已停用，仅展示店铺名 */}
                    <View className="shop-title">{cardInfo?.shopTitle}</View>
                </View>
                <View className="gift-card-no">
                    <View className="gift-card-label">{t("卡号")}</View>
                    {!showGiftCardNo ? (
                        <View className="gift-card-no-box">
                            <Text className="card-no-item">{hideCardNumber}</Text>
                        </View>
                    ) : (
                        <View className="gift-card-no-box">
                            <Text className="card-no-item">{cardNumber}</Text>
                        </View>
                    )}
                    {showActions ? (
                        <View className="copy-btn" onClick={handleCardNumberCopy}>
                            {t("复制")}
                        </View>
                    ) : null}
                </View>
                <View className="gift-card-pwd">
                    <View className="gift-card-label">{t("密码")}</View>
                    {!showGiftCardNo ? (
                        <View className="card-no-item">
                            <Text>{hideCardPassword}</Text>
                        </View>
                    ) : (
                        <View className="card-no-item">
                            <Text>{cardPassword}</Text>
                        </View>
                    )}
                    {showActions ? (
                        <View className="copy-btn" onClick={handlePasswordCopy}>
                            {t("复制")}
                        </View>
                    ) : null}
                </View>
                <View className="gift-card-info">
                    <View className="gift-card-name">{cardInfo?.cardGroupName}</View>
                    <View className="gift-card-date">
                        {cardInfo?.expiredTime == 0 ? (
                            <View className="gift-card-date-text">{t("长期有效")}</View>
                        ) : cardInfo?.expiredTime && cardInfo?.expiredTime != 0 ? (
                            <View className="gift-card-date-text">
                                {t("有效期至")} {formatTimestamp(cardInfo.expiredTime * 1000)}
                            </View>
                        ) : null}
                    </View>
                </View>
                {showActions ? (
                    <View className="gift-card-actions-box">
                        <View className="gift-card-action-item" onClick={handleCopyAll}>
                            <View className="iconfont-h5 icon-fuzhi1" />
                            {t("复制券码")}
                        </View>
                        <View className="gift-card-action-divider" />
                        <View className="gift-card-action-item" onClick={handleShowGiftCardNo}>
                            <View className={`iconfont-h5 ${showGiftCardNo ? "icon-xianshi" : "icon-buxianshi"}`} />
                            {!showGiftCardNo ? <Text>{t("显示券码")}</Text> : <Text>{t("隐藏券码")}</Text>}
                        </View>
                    </View>
                ) : null}
            </View>
            <View className="gift-card-status">
                <View className="gift-card-status-item">{displayStatus}</View>
            </View>
        </View>
    );
}
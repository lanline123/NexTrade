import { useEffect, useMemo, useState } from "react";
import { Text, View } from "@tarojs/components";

import FormatPrice from "@/components/format-price/FormatPrice";
import { staticResource } from "@/utils";
import { isShowB2bPriceText } from "@/utils/b2bPrice";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    productInfo?: Record<string, any>;
    productOriginPrice: string | number;
    productPrice: string | number;
    productStock?: number;
    grouponValue: Record<string, any>;
    activityBgImage?: string;
    vortmall?: boolean;
    overseas?: boolean;
}

const mainPriceColor = "#fff";
const originPriceColor = "#fff";

/** 转时间戳（与旧 dateStringToTimestamp 同逻辑：仅支持 "YYYY-MM-DD HH:mm:ss"） */
const dateStringToTimestamp = (dateString: any) => {
    const dateParts = String(dateString || "").split(" ");
    const [year, month, day] = dateParts[0].split("-");
    const [hour, minute, second] = dateParts[1].split(":");
    const date = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute), Number(second));
    return date.getTime();
};

const isActivityStart = (datetime: string) => {
    const startTime = dateStringToTimestamp(datetime);
    return startTime < new Date().getTime();
};

const formatTime = (time: string | number): string => {
    return time?.toString().padStart(2, "0") || "00";
};

/**
 * 拼团商品标题组件（自旧 pages/product/src/productGrouponTitle.vue 移植）
 * - 显示拼团价格和原价对比
 * - 显示成团人数要求
 * - 倒计时显示拼团活动剩余时间
 */
export default function ProductGrouponTitle({
    productOriginPrice,
    grouponValue,
    activityBgImage = "",
    vortmall = false,
    overseas = false
}: Props) {
    const showB2bText = useMemo(() => isShowB2bPriceText(), []);

    /** 背景图样式 */
    const groupTitleStyle = useMemo(() => {
        const url = activityBgImage || staticResource("groupon/titleBg.png");
        return {
            backgroundImage: `url(${url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat"
        };
    }, [activityBgImage]);

    /** 获取时间文本 */
    const timeText = !isActivityStart(grouponValue.startTime) ? t("距开始") : vortmall ? t("距活动结束") : t("距离结束仅剩");

    /** 计时器用的目标时间 */
    const targetTime = isActivityStart(grouponValue.startTime) ? grouponValue.endTime : grouponValue.startTime;

    // ===== 倒计时（对应旧 commonCountdown countdown-type="specifyTime" 的插槽视觉）=====
    const [now, setNow] = useState(() => new Date().getTime());
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date().getTime()), 1000);
        return () => clearInterval(timer);
    }, []);

    const countdown = useMemo(() => {
        const result = { days: 0, hours: 0, minutes: 0, seconds: 0 };
        const endTimestamp = dateStringToTimestamp(targetTime);
        let diffMilliseconds = endTimestamp - now;
        if (diffMilliseconds > 0) {
            result.days = Math.floor(diffMilliseconds / (1000 * 60 * 60 * 24));
            diffMilliseconds -= result.days * (1000 * 60 * 60 * 24);
            result.hours = Math.floor(diffMilliseconds / (1000 * 60 * 60));
            diffMilliseconds -= result.hours * (1000 * 60 * 60);
            result.minutes = Math.floor(diffMilliseconds / (1000 * 60));
            diffMilliseconds -= result.minutes * (1000 * 60);
            result.seconds = Math.floor(diffMilliseconds / 1000);
        }
        return result;
    }, [targetTime, now]);

    return (
        <View className={`product-group-title-box ${vortmall ? "product-group-title-box--vortmall" : ""} ${overseas ? "product-group-title-box--overseas" : ""}`}>
            <View className="product-group-title flex justify-between align-center" style={vortmall ? undefined : (groupTitleStyle as any)}>
                {!vortmall && <View className="activity-overlay" />}
                <View className="group-price-box">
                    <View className="title-top-price">
                        {!vortmall && (
                            <View className="num-group">
                                {t("拼团优惠")}
                                <Text className="separator">|</Text>
                                {grouponValue.currentGroupNum + t("人团")}
                            </View>
                        )}
                        <View className="price-box">
                            <View className="price">
                                <FormatPrice
                                    fontStyle={{
                                        fontSize: vortmall ? "49rpx" : "48rpx",
                                        fontWeight: vortmall ? "600" : "bold",
                                        color: mainPriceColor
                                    }}
                                    decimalsStyle={{
                                        fontSize: vortmall ? "49rpx" : "32rpx",
                                        fontWeight: vortmall ? "600" : "bold",
                                        color: mainPriceColor
                                    }}
                                    currencyStyle={{
                                        fontSize: vortmall ? "30rpx" : "28rpx",
                                        fontWeight: vortmall ? "600" : "bold",
                                        color: mainPriceColor
                                    }}
                                    priceData={grouponValue.grouponPrice}
                                />
                            </View>
                        </View>
                        <View className="title-top-market_price flex align-center">
                            {!showB2bText && (
                                <View className="originalprice-box">
                                    <View>
                                        <FormatPrice
                                            isBottom={false}
                                            priceData={productOriginPrice}
                                            fontStyle={{
                                                textDecoration: "line-through",
                                                fontSize: vortmall ? "28rpx" : undefined,
                                                color: originPriceColor
                                            }}
                                        />
                                    </View>
                                </View>
                            )}
                            {grouponValue.groupSuccessCount > 0 && !vortmall && (
                                <View className="discountStock">
                                    <View>
                                        {t("已成团")}
                                        {grouponValue.groupSuccessCount} {t("件")}
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
                <View className="group-time-box">
                    <View className="countdown-box flex align-center flex-column">
                        <View className="title-top-time">{timeText}</View>
                        <View className="countdown">
                            <View className="countdown-text">
                                {countdown.days ? <Text className="countdown-bg">{formatTime(countdown.days)}</Text> : null}
                                {countdown.days ? <Text className="splitor">{t("天")}</Text> : null}
                                <Text className="countdown-bg">{formatTime(countdown.hours)}</Text>
                                <Text className="splitor">:</Text>
                                <Text className="countdown-bg">{formatTime(countdown.minutes)}</Text>
                                <Text className="splitor">:</Text>
                                <Text className="countdown-bg">{formatTime(countdown.seconds)}</Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

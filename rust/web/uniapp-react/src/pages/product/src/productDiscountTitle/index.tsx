import { useMemo } from "react";
import { Text, View } from "@tarojs/components";

import type { ProductItem } from "@/types/product/product";
import { staticResource } from "@/utils";
import { isShowB2bPriceText } from "@/utils/b2bPrice";
import FormatPrice from "@/components/format-price/FormatPrice";
import TigCountdown from "@/components/tig/tig-countdown/TigCountdown";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    productInfo: ProductItem;
    productPrice: string | number;
    productOriginPrice: string | number;
    discountValue: Record<string, any>;
    productStock: number;
    activityBgImage?: string;
    overseas?: boolean;
}

/**
 * 限时折扣活动标题（自旧 pages/product/src/productDiscountTitle.vue 移植）
 * - 海外版（overseas）与国内版两套视觉
 * - tig-countdown → TigCountdown、format-price → FormatPrice
 */
export default function ProductDiscountTitle({
    productInfo: _productInfo,
    productPrice,
    productOriginPrice,
    discountValue,
    productStock,
    activityBgImage = "",
    overseas = false
}: Props) {
    const mainPriceColor = "#fff";
    const originPriceColor = "#fff";

    // 对应旧 computed showB2bText（b2bPrice 工具为全局函数，组件内直接调用）
    const showB2bText = isShowB2bPriceText();
    const showOriginPrice = !showB2bText && Number(productOriginPrice) > Number(productPrice);
    const discountPercent = useMemo(() => {
        const original = Number(productOriginPrice) || 0;
        const current = Number(productPrice) || 0;
        if (original <= 0 || current >= original) return 0;
        return Math.round(((original - current) / original) * 100);
    }, [productOriginPrice, productPrice]);

    const bgStyle = useMemo(() => {
        const url = activityBgImage || staticResource("groupon/titleBg.png");
        return {
            backgroundImage: `url(${url})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat"
        };
    }, [activityBgImage]);

    return (
        <View className={`product-group-title-box ${overseas ? "product-group-title-box--overseas" : ""}`}>
            <View className="product-group-title flex justify-between align-center" style={bgStyle}>
                <View className="activity-overlay" />
                {overseas ? (
                    <View className="overseas-activity-content">
                        <View className="overseas-activity-meta flex align-center">
                            <View className="overseas-activity-tag">{t("限时折扣")}</View>
                            <View className="overseas-activity-countdown flex align-center">
                                <Text>{t("即将结束")}</Text>
                                <TigCountdown backgroundColor="rgba(0, 0, 0, .06)" endTime={discountValue.discountEndTime} fontSize={11} color="#fff" />
                            </View>
                        </View>
                        <View className="overseas-activity-price">
                            <FormatPrice
                                fontStyle={{ fontSize: "49rpx", fontWeight: "600", color: mainPriceColor }}
                                decimalsStyle={{ fontSize: "49rpx", fontWeight: "600", color: mainPriceColor }}
                                currencyStyle={{ fontSize: "28rpx", fontWeight: "600", color: mainPriceColor }}
                                priceData={productPrice}
                            />
                        </View>
                        {showOriginPrice ? (
                            <View className="overseas-origin-discount flex align-center">
                                <FormatPrice
                                    priceData={productOriginPrice}
                                    fontStyle={{ textDecoration: "line-through", fontWeight: "600", fontSize: "28rpx", color: originPriceColor }}
                                />
                                <View className="overseas-origin-divider" />
                                {/* 旧 $t("优惠{0}%", [discountPercent]) → i18next {0} 插值 */}
                                <Text>{t("优惠{0}%", { "0": discountPercent })}</Text>
                            </View>
                        ) : null}
                    </View>
                ) : (
                    <View className="group-price-box">
                        <View className="title-top-price">
                            <View className="price-box">
                                <View className="price">
                                    <FormatPrice
                                        fontStyle={{ fontSize: "48rpx", fontWeight: "bold", color: mainPriceColor }}
                                        decimalsStyle={{
                                            fontSize: "32rpx",
                                            fontWeight: "bold",
                                            color: mainPriceColor
                                        }}
                                        currencyStyle={{
                                            fontSize: "28rpx",
                                            fontWeight: "bold",
                                            color: mainPriceColor
                                        }}
                                        priceData={productPrice}
                                    />
                                </View>
                                {!showB2bText ? (
                                    <View className="tag-text-box">
                                        <View className="tag-text">
                                            {t("直降")}
                                            <FormatPrice
                                                isBottom={false}
                                                fontStyle={{ fontWeight: "bold", color: "var(--main-bg)" }}
                                                priceData={discountValue.discountPrice}
                                            />
                                        </View>
                                    </View>
                                ) : null}
                            </View>

                            <View className="title-top-market_price flex align-center">
                                {productOriginPrice && Number(productOriginPrice) > Number(productPrice) ? (
                                    <View className="originalprice-box">
                                        {t("价格")}
                                        <View>
                                            <FormatPrice
                                                isBottom={false}
                                                priceData={productOriginPrice}
                                                fontStyle={{ textDecoration: "line-through", color: originPriceColor }}
                                            />
                                        </View>
                                    </View>
                                ) : null}
                                <View className="discountStock">
                                    <View>
                                        {" "}
                                        {t("剩余")} {productStock}
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                )}
                {!overseas ? (
                    <View className="group-time-box">
                        <View className="type-box">
                            <View className="type-text">{t("限时折扣")}</View>
                        </View>
                        <View className="countdown-box flex align-center">
                            <View className="title-top-time">{t("距结束还剩")}</View>
                            <TigCountdown backgroundColor="rgba(0, 0, 0, .06)" endTime={discountValue.discountEndTime} fontSize={11} color="#fff" />
                        </View>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

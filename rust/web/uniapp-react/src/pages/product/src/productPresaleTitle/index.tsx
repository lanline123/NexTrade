import { useMemo } from "react";
import { Text, View } from "@tarojs/components";

import type { ProductItem } from "@/types/product/product";
import type { PresaleInfo } from "@/types/presale/presale";
import { staticResource } from "@/utils";
import { useConfigStore } from "@/store/config";
import FormatPrice from "@/components/format-price/FormatPrice";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    productInfo: ProductItem;
    productPrice: string | number;
    presaleInfo: PresaleInfo;
    soldCount?: number;
    activityBgImage?: string;
    overseas?: boolean;
}

/**
 * 预售活动标题（自旧 pages/product/src/productPresaleTitle.vue 移植）
 * - 定金/预售价/已售展示，海外版增加划线价与折扣行
 * - format-price → FormatPrice
 */
export default function ProductPresaleTitle({
    productInfo,
    productPrice,
    presaleInfo,
    soldCount = 0,
    activityBgImage = "",
    overseas = false
}: Props) {
    const showSelledCount = useConfigStore((s) => s.showSelledCount);

    const originPrice = productInfo?.productPrice || productInfo?.marketPrice || "0";
    const originPriceNum = Number(originPrice) || 0;
    const currentPriceNum = Number(productPrice) || 0;
    const discountPercent = useMemo(() => {
        if (originPriceNum <= 0 || currentPriceNum >= originPriceNum) return 0;
        return Math.round(((originPriceNum - currentPriceNum) / originPriceNum) * 100);
    }, [originPriceNum, currentPriceNum]);

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
            <View className={`product-group-title flex justify-between ${overseas ? "align-start" : "align-center"}`} style={bgStyle}>
                <View className="activity-overlay" />
                <View className="group-price-box">
                    {presaleInfo.saleMode === 2 ? (
                        <View className="deposit-amount flex align-center">
                            <Text>{t("预售价")}</Text>
                            <View className="deposit-amount-separator">
                                {/* 原 scss 选择器 .deposit-amount-separator text（裸 text 标签）→ 类选择器 .sep-text 等价平移 */}
                                <Text className="sep-text">.</Text>
                            </View>
                            <Text>{t("定金")}</Text>
                            <View className="deposit-amount-price">
                                <FormatPrice priceData={presaleInfo.depositAmount} fontStyle={{ color: "#fff" }} />
                            </View>
                        </View>
                    ) : null}

                    <View className="presale-price-row flex align-baseline">
                        {presaleInfo.saleMode === 1 ? <Text className="presale-label">{t("预售价")}</Text> : null}
                        <FormatPrice
                            fontStyle={{ fontWeight: "bold", fontSize: "48rpx", color: "#fff" }}
                            decimalsStyle={{
                                fontSize: "32rpx",
                                fontWeight: "bold",
                                color: "#fff"
                            }}
                            currencyStyle={{
                                fontSize: "28rpx",
                                fontWeight: "bold",
                                color: "#fff"
                            }}
                            priceData={productPrice}
                        />
                    </View>
                    {overseas && originPriceNum > 0 ? (
                        <View className="origin-discount-line flex align-center">
                            <FormatPrice
                                priceData={originPrice}
                                fontStyle={{
                                    textDecoration: "line-through",
                                    fontWeight: "600",
                                    fontSize: "28rpx",
                                    color: "#fff",
                                    lineHeight: "38rpx"
                                }}
                            />
                            <View className="origin-discount-divider" />
                            {/* 旧 $t("优惠{0}%", [discountPercent]) → i18next {0} 插值 */}
                            <Text className="discount-percent">{t("优惠{0}%", { "0": discountPercent })}</Text>
                        </View>
                    ) : null}
                </View>
                {showSelledCount ? (
                    <View className="group-time-box">
                        <View className="sold-box">
                            <Text>
                                {t("已售")}
                                {soldCount}
                                {t("件")}
                            </Text>
                        </View>
                    </View>
                ) : null}
            </View>
        </View>
    );
}

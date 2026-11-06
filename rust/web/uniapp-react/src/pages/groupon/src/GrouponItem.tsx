import { useMemo } from "react";
import { Image, Text, View } from "@tarojs/components";

import TigLazyImage from "@/components/tig/tig-lazy-image/TigLazyImage";
import FormatPrice from "@/components/format-price/FormatPrice";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import { pickPic } from "@/utils/format";
import { redirect } from "@/utils";
import { getMaxGroupNumFromJson } from "@/utils/groupon";
import { t } from "@/utils/i18n";
import type { GrouponItem as GrouponItemData } from "@/types/home/home";
import type { ProductActiveStyleVO } from "@/types/product/productStyle";

import "./GrouponItem.scss";

/**
 * 拼团商品卡片组件（自旧 pages/groupon/src/grouponItem.vue 移植）
 * - 展示拼团商品信息
 * - 支持列表和瀑布流两种样式
 */
interface Props {
    mode: "list" | "waterfall";
    item: GrouponItemData;
    /** 是否活动开始 */
    isActivityStart: boolean;
    /** 是否活动结束 */
    isActivityEnd: boolean;
    productStyle?: ProductActiveStyleVO | null;
    /** 旧 @start-group */
    onStartGroup?: (item: GrouponItemData) => void;
    /** 旧 @buy */
    onBuy?: (item: GrouponItemData) => void;
}

export default function GrouponItem({
    mode,
    item,
    isActivityStart,
    isActivityEnd,
    productStyle = null,
    onStartGroup,
    onBuy
}: Props) {
    const maxGroupNum = useMemo(() => getMaxGroupNumFromJson(item.groupNum), [item.groupNum]);

    /**
     * 跳转到商品详情
     * @param productId 商品id
     */
    const toDetail = (productId: number) => {
        const url = `/pages/product/index?id=${productId}`;
        redirect({ url });
    };

    /**
     * 开团
     * @param item 团购商品信息
     */
    const handleStartGroup = (data: GrouponItemData) => {
        onStartGroup?.(data);
    };

    /**
     * 原价购买
     * @param item 团购商品信息
     */
    const handleBuy = (data: GrouponItemData) => {
        onBuy?.(data);
    };

    return (
        <>
            {mode === "list" && (
                <View className="product-card">
                    <View className="image" onClick={() => toDetail(item.productId)}>
                        <TigLazyImage src={pickPic(item)} mode="aspectFill" />
                        {productStyle?.borderImage && (
                            <Image className="product-style-border" src={productStyle.borderImage} mode="scaleToFill" />
                        )}
                    </View>
                    <View className="detail">
                        <View className="flex flex-column main-info" onClick={() => toDetail(item.productId)}>
                            <View className="line2">
                                <Text className="detail-title">{item.productName}</Text>
                            </View>
                            <View className="detail-group">
                                <Text className="group-num">
                                    {maxGroupNum}
                                    {t("人团")}
                                </Text>
                                <Text className="num">
                                    {t("已有")}
                                    {item.joinNumCount}
                                    {t("人参团")}
                                </Text>
                            </View>
                        </View>
                        <View className="flex align-end">
                            <View className="group-price">
                                {/* <Text className="price-text">{t("拼团价")}:</Text> */}
                                <FormatPrice
                                    currencyStyle={{
                                        fontSize: "22rpx"
                                    }}
                                    priceData={item.minGrouponPrice}
                                />
                            </View>
                            <View className="original-price">
                                <FormatPrice fontStyle={{ textDecoration: "line-through" }} priceData={item.productPrice} />
                            </View>
                        </View>
                        <View className="act-btn">
                            {isActivityStart && !isActivityEnd ? (
                                <TigButton2
                                    plain
                                    className="groupon-act-btn"
                                    style={{ height: "58rpx", borderColor: "var(--main-bg)" }}
                                    onClick={() => handleStartGroup(item)}
                                >
                                    {t("我要开团")}
                                </TigButton2>
                            ) : (
                                <TigButton2
                                    plain
                                    className="groupon-act-btn"
                                    style={{ height: "58rpx", borderColor: "var(--main-bg)" }}
                                    onClick={() => handleBuy(item)}
                                >
                                    {t("原价购买")}
                                </TigButton2>
                            )}
                        </View>
                    </View>
                </View>
            )}
            {mode === "waterfall" && (
                <View className="waterfall-item">
                    <View className="product-card">
                        <View className="image" onClick={() => toDetail(item.productId)}>
                            <TigLazyImage src={pickPic(item)} mode="widthFix" />
                            {productStyle?.borderImage && (
                                <Image className="product-style-border" src={productStyle.borderImage} mode="scaleToFill" />
                            )}
                        </View>
                        <View className="detail">
                            <View className="flex flex-column main-info" onClick={() => toDetail(item.productId)}>
                                <View className="line2">
                                    <Text className="group-num">
                                        {maxGroupNum}
                                        {t("人团")}
                                    </Text>
                                    <Text className="detail-title">{item.productName}</Text>
                                </View>
                                <View className="detail-group">
                                    <Text className="num">
                                        {t("已有")}
                                        {item.joinNumCount}
                                        {t("人参团")}
                                    </Text>
                                </View>
                            </View>
                            <View className="flex price-box">
                                <View className="group-price">
                                    {/* <Text className="price-text">{t("拼团价")}:</Text> */}
                                    <FormatPrice
                                        currencyStyle={{
                                            fontSize: "20rpx"
                                        }}
                                        decimalsStyle={{ fontSize: "22rpx" }}
                                        priceData={item.minGrouponPrice}
                                    />
                                </View>
                                <View className="original-price">
                                    <FormatPrice fontStyle={{ textDecoration: "line-through" }} priceData={item.productPrice} />
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            )}
        </>
    );
}
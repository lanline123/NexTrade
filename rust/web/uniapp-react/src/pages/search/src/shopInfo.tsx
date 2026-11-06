import { useEffect, useRef, useState } from "react";
import { View, Text, ScrollView } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import FormatPrice from "@/components/format-price/FormatPrice";
import { getShopList } from "@/api/shop/shop";
import type { shopListItem } from "@/types/shop/shop";
import { pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./ShopInfo.scss";

interface Props {
    /** 店铺卡片数据（搜索结果中的店铺卡片） */
    info?: shopListItem | null;
    /** 关键词：无 info 时按关键词拉取首个店铺 */
    keyword?: string;
    /** 店铺 ID：限定按店铺拉取 */
    shopId?: number | null;
}

/**
 * 店铺信息组件（自旧 pages/search/src/shopInfo.vue 235 行移植）
 * - 搜索结果中的店铺卡片，显示店铺名称、商品数、收藏数、商品横滑列表
 * - 无 info 时按 keyword/shopId 调 shop/shop/list 取第一条；无匹配店铺自动隐藏
 */
export default function ShopInfo({ info = null, keyword = "", shopId = null }: Props) {
    const [fetchedShopInfo, setFetchedShopInfo] = useState<shopListItem>({} as shopListItem);
    const shopInfo = info ?? fetchedShopInfo;

    // 旧 watch 只监听 keyword（immediate），回调内读当时的 props.info / props.shopId
    const infoRef = useRef(info);
    infoRef.current = info;
    const shopIdRef = useRef(shopId);
    shopIdRef.current = shopId;

    const getShopData = async (searchKeyword: string, searchShopId: number | null) => {
        try {
            const params: any = { keyword: searchKeyword, size: 1 };
            if (searchShopId !== null && searchShopId !== undefined) {
                params.shopId = searchShopId;
            }
            const result = await getShopList(params);
            setFetchedShopInfo(result.records[0]);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        if (keyword && !infoRef.current) {
            void getShopData(keyword, shopIdRef.current ?? null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyword]);

    const handleLink = (url: string) => {
        if (!url) return;
        Taro.navigateTo({ url });
    };

    if (!shopInfo || Object.keys(shopInfo).length === 0) return null;

    const infoData = shopInfo as shopListItem & { tipNames?: string[] };
    const shopLink = `/pages/shop/index?shopId=${infoData.shopId}`;

    return (
        <View className="shop-info-box">
            <View className="shop-info">
                <View className="shop-title" onClick={() => handleLink(shopLink)}>
                    <View className="shop-logo">
                        <TigImage src={infoData.shopLogo} mode="aspectFit" />
                    </View>
                    <View className="shop-title-row shop-heading-eGlieTIyODI">
                        <View className="shop-title-text line1">{infoData.shopTitle} </View>
                        <View className="tipNames">
                            {(infoData.tipNames ?? []).map((item) => (
                                <View key={item} className="tipName">
                                    {item}
                                </View>
                            ))}
                        </View>
                    </View>

                    <View className="shop-btn">
                        {/* 旧 tig-button :plain + :plain-main-color → View 按钮，视觉由 .shop-btn .btn 还原 */}
                        <View className="btn" onClick={() => handleLink(shopLink)}>
                            {t("进店")}
                        </View>
                    </View>
                </View>
                <View className="shop-desc">
                    <Text className="shop-info-text">
                        {t("上架商品：")}
                        {infoData.listingCount}
                    </Text>
                    <Text className="shop-info-text">
                        {t("店铺收藏：")}
                        {infoData.collectCount}
                    </Text>
                </View>
                <View className="shop-product">
                    <ScrollView scrollX>
                        <View className="shop-product-scroll">
                            {(infoData.listingProduct ?? []).map((item) => (
                                <View
                                    key={item.productId}
                                    className="shop-product-image"
                                    onClick={() => handleLink(`/pages/product/index?id=${item.productId}`)}
                                >
                                    <TigImage src={pickPic(item)} />
                                    <View className="product-price">
                                        <FormatPrice
                                            fontStyle={{ fontSize: "24rpx" }}
                                            currencyStyle={{ fontSize: "20rpx" }}
                                            decimalsStyle={{ fontSize: "22rpx" }}
                                            priceData={item.productPrice}
                                        />
                                    </View>
                                </View>
                            ))}
                        </View>
                    </ScrollView>
                </View>
            </View>
        </View>
    );
}

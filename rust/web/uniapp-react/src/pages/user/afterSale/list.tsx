import { useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useDidShow, useReachBottom } from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import LoadingBox from "@/components/loading-box";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { aftersalesRecord } from "@/api/user/afterSale";
import type { AfterSaleListFilterResult } from "@/types/user/afterSale";
import { pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./list.scss";

/**
 * 售后申请列表页（自旧 pages/user/afterSale/list.vue 移植）
 * - 展示用户所有售后申请记录
 * - 支持分页加载和触底加载更多
 * - 点击可进入售后详情页
 */
export default function AfterSaleList() {
    usePageGuards();

    const filterParams = useRef({
        page: 1,
        size: 10
    });
    const [loaded, setLoaded] = useState(false);
    const [afterSaleList, setAfterSaleList] = useState<AfterSaleListFilterResult[]>([]);
    const [total, setTotal] = useState(0);
    const totalRef = useRef(0);

    /**
     * 获取商品显示价格
     * @param item 商品信息
     * @returns 商品显示价格 （商品价格 + 附加价）
     */
    const getDisplayPrice = (item: any) => {
        const rawExtraSkuData = item?.extraSkuData ?? [];
        let extraSkuData = rawExtraSkuData;
        if (typeof rawExtraSkuData === "string") {
            try {
                extraSkuData = JSON.parse(rawExtraSkuData);
            } catch {
                extraSkuData = [];
            }
        }
        if (!Array.isArray(extraSkuData)) {
            extraSkuData = [];
        }
        const extraPrice = extraSkuData.reduce((sum: number, extra: any) => {
            const raw = extra?.totalAttrPrice ?? extra?.attrPrice ?? 0;
            return sum + Number(raw || 0);
        }, 0);
        return Number(item?.price || 0) + extraPrice;
    };

    const getList = async (reset = false) => {
        if (filterParams.current.page > 1) {
            setLoaded(true);
        } else {
            Taro.showLoading({
                title: t("加载中")
            });
        }
        try {
            const result = await aftersalesRecord(filterParams.current);
            setAfterSaleList((prev) => (reset ? [...result.records] : [...prev, ...result.records]));
            totalRef.current = result.total;
            setTotal(result.total);
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
            setLoaded(false);
        }
    };

    const handleAfterSaleDetail = (id: number) => {
        void Taro.navigateTo({
            url: `/pages/user/afterSale/info?id=${id}`
        });
    };

    const getProductUrl = (productId: number, shopId?: number) => {
        let url = `/pages/product/index?id=${productId}`;
        if (shopId && shopId > 0) {
            url += `&shopId=${shopId}`;
        }
        return url;
    };

    useReachBottom(() => {
        if (filterParams.current.page < Math.ceil(totalRef.current / filterParams.current.size)) {
            filterParams.current.page++;
            void getList();
        }
    });

    // 旧 onShow：每次展示都重置分页并重新拉取
    useDidShow(() => {
        filterParams.current.page = 1;
        setAfterSaleList([]);
        void getList(true);
    });

    return (
        <TigLayout title={t("申请列表")}>
            <View className="after-sale-list">
                <View className="order-list">
                    {afterSaleList.map((item) => (
                        <View className="order-list-item" key={item.orderId}>
                            <View className="order-list-item-header">
                                <Text className="special-text">
                                    {t("售后编号")}：<Text className="special-color">{item.aftersalesSn}</Text>
                                </Text>
                                <Text>{item.statusName}</Text>
                            </View>
                            <View className="order-list-item-content">
                                <View className="item-content-product">
                                    {item.aftersalesItems.map((subItem) => (
                                        <View
                                            key={subItem.aftersalesItemId}
                                            hoverClass="navigator-hover"
                                            onClick={() => void Taro.navigateTo({ url: getProductUrl(subItem.productId, (item as any).shopId) })}
                                        >
                                            <View className="item-content-product-item">
                                                <View className="item-content-product-img">
                                                    <TigImage src={pickPic(subItem)} />
                                                </View>
                                                <View className="item-content-product-info">
                                                    <View className="product-item-title">{subItem.productName}</View>
                                                    <View className="product-item-price">
                                                        <View className="product-item-pricenum">
                                                            <FormatPrice
                                                                showText={false}
                                                                decimalsStyle={{ fontSize: "25rpx" }}
                                                                currencyStyle={{ fontSize: "23rpx" }}
                                                                priceData={getDisplayPrice(subItem)}
                                                            />
                                                        </View>
                                                        <View className="product-item-quantity">x {subItem.number}</View>
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                            <View className="order-list-item-btn">
                                <View className="item-btn-box">
                                    <View className="base-item-btn detail" onClick={() => handleAfterSaleDetail(item.aftersaleId)}>
                                        {t("售后详情")}
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}
                </View>
                <LoadingBox modelValue={loaded} page={filterParams.current.page} length={afterSaleList.length} />
            </View>
        </TigLayout>
    );
}
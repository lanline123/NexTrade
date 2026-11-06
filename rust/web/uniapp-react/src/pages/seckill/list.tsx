import { useEffect, useRef } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import LoadingBox from "@/components/loading-box";
import FormatPrice from "@/components/format-price/FormatPrice";
import { getSeckill } from "@/api/seckill/seckill";
import type { SeckillFilterState } from "@/types/seckill/seckill";
import useList from "@/hooks/useList";
import { useProductStyle } from "@/hooks/useProductStyle";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { isOverseas, staticResource } from "@/utils";
import { setPageMeta } from "@/utils/seo";
import { productImage } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./list.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 秒杀列表页（自旧 pages/seckill/list.vue 移植）
 * - 秒杀商品列表（触底分页由 useList 承载）
 * - 售罄遮罩、进度条、折扣标签、会员限制按钮
 */
export default function SeckillList() {
    usePageGuards();
    const shopTitle = useConfigStore((s) => s.baseInfo.shopTitle);
    const langCode = useI18nStore((s) => s.langCode);
    const isZh = isOverseas() ? (langCode ? langCode.includes("zh") : true) : true;

    // 旧 filterParams 为 reactive 对象并被 useList 原地改写分页字段
    const filterParamsRef = useRef({
        //初始化用于查询的参数
        page: 1,
        size: 20
    });

    const { isLoadMore, data: seckillProductList } = useList<SeckillFilterState>(getSeckill, {
        params: filterParamsRef.current,
        path: {
            dataKey: "records"
        },
        immediate: true
    });

    const { styleMap } = useProductStyle(seckillProductList);

    const toDetail = (data: SeckillFilterState) => {
        const url = `/pages/product/index?id=${data.productId}${data.skuId > 0 ? `&skuId=${data.skuId}` : ""}${
            data.shopId > 0 ? `&shopId=${data.shopId}` : ""
        }`;
        Taro.navigateTo({
            url
        });
    };

    const toBack = () => {
        Taro.navigateBack();
    };

    const seckillPercentage = (sales: number, stock: number) => {
        return Math.round((sales / (stock + sales)) * 100) + "%";
    };

    // 秒杀价相对市场价的折扣百分比（用于「优惠 xx%」标签）
    const getDiscount = (currentPrice: number, originalPrice: number) => {
        if (originalPrice === 0 || currentPrice >= originalPrice) {
            return 0;
        }

        const discountPercentage = ((originalPrice - currentPrice) / originalPrice) * 100;

        return Math.floor(discountPercentage * 10) / 10;
    };

    // 对应旧 onMounted（#ifdef H5）
    useEffect(() => {
        setPageMeta({
            title: `${t("限时秒杀")} - ${shopTitle}`,
            description: `${shopTitle}${t("限时秒杀优惠商品")}`
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [shopTitle]);

    return (
        <TigLayout>
            <View className="seckill-title">
                <View className="head-box">
                    <Text className="iconfont icon-houtui" onClick={toBack} />
                    {isZh ? (
                        <Text>{t("秒杀")}</Text>
                    ) : (
                        <Image className="tit-img" src={staticResource("seckill/overseas-seckillTit.png")} mode="heightFix" />
                    )}
                </View>
                <View className="label-box">
                    <View className="item">
                        <Image className="fire" src={staticResource("seckill/fire.png")} mode="heightFix" />
                        <Text> {t("每日特惠")}</Text>
                    </View>
                    <View className="item">
                        <Image className="fire" src={staticResource("seckill/fire.png")} mode="heightFix" />
                        <Text> {t("限时抢购")}</Text>
                    </View>
                </View>
            </View>
            <View className="qianggou-list">
                {seckillProductList.map((item, index) => (
                    <View className="qianggou-item" key={`${item.productId}-${index}`} onClick={() => toDetail(item)}>
                        <View className="qianggou-img-box">
                            <Image className="qianggou-img" src={productImage(item)} mode="aspectFill" />
                            {item.seckillStock === 0 && (
                                <View className="qianggou-out">
                                    <View className="qianggou-out-txt">{t("已抢完")}</View>
                                </View>
                            )}
                            {styleMap[item.productId]?.borderImage && (
                                <Image
                                    className="product-style-border"
                                    src={styleMap[item.productId].borderImage!}
                                    mode="scaleToFill"
                                />
                            )}
                        </View>
                        <View className="qianggou-info">
                            <View className="qianggou-tit line2">{item.productName}</View>
                            <View className="progress-box flex align-center">
                                <View className="progress-bar">
                                    <View
                                        className={`progress${item.seckillStock === 0 ? " sellOut" : ""}`}
                                        style={{
                                            width: seckillPercentage(item.seckillSales, item.seckillStock)
                                        }}
                                    />
                                </View>
                                <View className="progress-txt">
                                    {item.seckillStock === 0 ? <Text> {t("已售罄")}</Text> : <Text> {t("热销")}</Text>}
                                </View>
                            </View>
                            <View className="qianggou-money-box">
                                <View className="qianggou-num">
                                    <View className="num">
                                        <FormatPrice
                                            fontStyle={{ fontSize: "30rpx", color: "#1a1a1a", fontWeight: "bold" }}
                                            currencyStyle={{
                                                fontSize: "30rpx",
                                                color: "#1a1a1a",
                                                fontWeight: "bold"
                                            }}
                                            decimalsStyle={{
                                                fontSize: "30rpx",
                                                color: "#1a1a1a",
                                                fontWeight: "bold"
                                            }}
                                            priceData={item.seckillPrice}
                                        />
                                    </View>
                                    <View className="del">
                                        <FormatPrice
                                            fontStyle={{
                                                textDecoration: "line-through",
                                                color: "#888b94",
                                                fontSize: "20rpx",
                                                fontWeight: "bold"
                                            }}
                                            isBottom={false}
                                            priceData={item.marketPrice}
                                        />
                                        <View className="label">
                                            {" "}
                                            {t("优惠{0}%", { 0: getDiscount(Number(item.seckillPrice), Number(item.marketPrice)) })}{" "}
                                        </View>
                                    </View>
                                </View>
                                <View className="qianggou-btn">
                                    {item.canJoin === false ? (
                                        <View className="sell-out-btn">{t("仅限会员")}</View>
                                    ) : item.seckillStock === 0 ? (
                                        <View className="sell-out-btn">{t("已售罄")}</View>
                                    ) : (
                                        <View className="btn">
                                            <Image className="img-btn" src={staticResource("seckill/seckill.png")} mode="heightFix" />
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
            <LoadingBox
                modelValue={isLoadMore}
                color="#fff"
                page={filterParamsRef.current.page}
                length={seckillProductList.length}
            />
        </TigLayout>
    );
}
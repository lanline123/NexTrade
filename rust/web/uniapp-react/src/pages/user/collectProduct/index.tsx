import { useEffect, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useReachBottom } from "@tarojs/taro";
import { Swipe } from "@nutui/nutui-react-taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import LoadingBox from "@/components/loading-box";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { delCollectProduct, getCollectProductList } from "@/api/user/collectProduct";
import { useProductStyle } from "@/hooks/useProductStyle";
import { useI18nStore } from "@/store/i18n";
import type { CollectProductFilterParams, CollectProductList } from "@/types/user/collectProduct";
import { staticResource } from "@/utils";
import { pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/**
 * 商品收藏列表页（自旧 pages/user/collectProduct/index.vue 逐行移植）
 * - 展示用户收藏的商品列表
 * - 支持左滑取消收藏
 * - 点击商品跳转商品详情
 */
export default function CollectProduct() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    // 旧 reactive filterParams：原地维护分页参数
    const filterParams = useRef<CollectProductFilterParams>({
        // 初始化用于查询的参数
        page: 1,
        size: 10,
        keyword: ""
    }).current;

    const [total, setTotal] = useState(0);
    const [loaded, setLoaded] = useState(false);
    const [loadend, setLoadend] = useState(false);
    const [collectList, setCollectList] = useState<CollectProductList[]>([]);
    const { styleMap } = useProductStyle(collectList);

    const __getCollectProductList = async () => {
        if (filterParams.page > 1) {
            setLoaded(true);
        } else {
            Taro.showLoading({
                title: t("加载中")
            });
        }
        try {
            const result: any = await getCollectProductList({ ...filterParams });
            setTotal(result.total);
            setCollectList((prev) => [...prev, ...result.records]);
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
            setLoaded(false);
            setLoadend(true);
        }
    };

    const handleLink = (id: number, shopId?: number) => {
        let url = `/pages/product/index?id=${id}`;
        if (shopId && shopId > 0) {
            url += `&shopId=${shopId}`;
        }
        Taro.navigateTo({ url });
    };

    const handleBack = () => {
        const pageList = Taro.getCurrentPages();
        const currentRoute = (pageList[pageList.length - 1] as any)?.route || (pageList[pageList.length - 1] as any)?.path;
        const prevRoute = (pageList[pageList.length - 2] as any)?.route || (pageList[pageList.length - 2] as any)?.path;
        const delta = prevRoute === currentRoute ? 2 : 1;

        if (process.env.TARO_ENV === "h5") {
            if (pageList.length > delta - 1) {
                history.go(-delta);
            } else {
                Taro.switchTab({
                    url: "/pages/member/index"
                });
            }
            return;
        }

        if (pageList.length > delta - 1) {
            Taro.navigateBack({
                delta
            });
        } else {
            Taro.switchTab({
                url: "/pages/member/index"
            });
        }
    };

    const __delCollect = (id: number) => {
        Taro.showModal({
            title: t("提示"),
            content: t("确定取消收藏吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (res.confirm) {
                    void deleteASiteCollection(id);
                }
            }
        });
    };

    const deleteASiteCollection = async (value: number) => {
        try {
            await delCollectProduct({ id: value });
            Taro.showToast({
                title: t("取消收藏成功"),
                icon: "none"
            });

            filterParams.page = 1;
            setCollectList([]);
            void __getCollectProductList();
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    // 旧 onLoad
    useEffect(() => {
        void __getCollectProductList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onReachBottom
    useReachBottom(() => {
        if (filterParams.page < Math.ceil(total / filterParams.size)) {
            filterParams.page++;
            void __getCollectProductList();
        }
    });

    return (
        <TigLayout title={t("商品收藏")} customBack onBack={handleBack}>
            {collectList.length > 0 && (
                <View className="collect-product">
                    {collectList.map((item) => (
                        <View className="move-item" key={item.productId}>
                            <Swipe
                                name={item.productId}
                                rightAction={
                                    <View className="collect-move-box">
                                        <View className="btn-del" onClick={() => __delCollect(item.productId)}>
                                            <Text>{t("取消收藏")}</Text>
                                        </View>
                                    </View>
                                }
                            >
                                <View className="collect-product-item" onClick={() => handleLink(item.productId, (item as any).shopId)}>
                                    <View className="collect-product-item-left">
                                        <View className="img-box">
                                            <TigImage src={pickPic(item)} />
                                            {styleMap[item.productId]?.borderImage && (
                                                <Image
                                                    className="product-style-border"
                                                    src={styleMap[item.productId].borderImage}
                                                    mode="scaleToFill"
                                                />
                                            )}
                                        </View>
                                    </View>
                                    <View className="collect-product-item-right">
                                        <View className="title">{item.productName}</View>
                                        <View className="item-bottom">
                                            <View className="price">
                                                <FormatPrice
                                                    decimalsStyle={{
                                                        fontSize: "25rpx"
                                                    }}
                                                    currencyStyle={{
                                                        fontSize: "23rpx"
                                                    }}
                                                    priceData={item.price}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            </Swipe>
                        </View>
                    ))}
                </View>
            )}
            {collectList.length === 0 && loadend === true && (
                <View className="empty-box">
                    <View className="pictrue">
                        <Image src={staticResource("common/data_empty.png")} />
                    </View>
                    <View className="txt">{t("暂无收藏记录！")}</View>
                </View>
            )}
            <LoadingBox modelValue={loaded} page={filterParams.page} length={collectList.length} />
        </TigLayout>
    );
}
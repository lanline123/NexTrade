import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useReachBottom } from "@tarojs/taro";
import { Swipe } from "@nutui/nutui-react-taro";

import LoadingBox from "@/components/loading-box";
import TigImage from "@/components/tig/tig-image/TigImage";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getCollectionShop } from "@/api/user/collectionShop";
import { shopCollection } from "@/api/shop/shop";
import { useI18nStore } from "@/store/i18n";
import type { collectionShopList } from "@/types/user/collectionShop";
import { isO2o, staticResource, toStoreOrShopHome } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/**
 * 门店/店铺收藏列表页（自旧 pages/user/collectionShop/index.vue 逐行移植）
 * - 展示用户收藏的门店或店铺列表（按 isO2o 区分文案）
 * - 显示 Logo、名称、上架商品数、收藏数
 * - 支持左滑取消收藏
 */
export default function CollectionShop() {
    usePageGuards();

    // 订阅语言，切换语言时重算 t() 文案
    const langCode = useI18nStore((s) => s.langCode);

    const pageTitle = useMemo(() => t(isO2o() ? t("门店收藏") : t("店铺收藏")), [langCode]);
    const collectCountLabel = useMemo(() => t(isO2o() ? t("门店收藏：") : t("店铺收藏：")), [langCode]);

    // 旧 reactive filterParams：原地维护分页参数
    const filterParams = useRef({
        // 初始化用于查询的参数
        page: 1,
        size: 10,
        excludeSelfOperated: 0,
        keyword: ""
    }).current;

    const [collectionShopList, setCollectionShopList] = useState<collectionShopList[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);

    const __getCollectionShop = async () => {
        if (filterParams.page > 1) {
            setLoaded(true);
        } else {
            setLoading(true);
        }
        try {
            const result: any = await getCollectionShop(filterParams);
            setCollectionShopList(result.records);
            setTotal(result.total);
        } catch (error) {
            console.error(error);
        } finally {
            setLoaded(false);
            setLoading(false);
        }
    };

    // 旧 onLoad
    useEffect(() => {
        void __getCollectionShop();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLink = (id: number) => {
        toStoreOrShopHome(id, { navType: "navigateTo" });
    };

    const handleCancel = async (id: number) => {
        try {
            await shopCollection({ shopId: id });
            Taro.showToast({
                title: t("取消成功"),
                icon: "none"
            });
            filterParams.page = 1;
            setCollectionShopList([]);
            void __getCollectionShop();
        } catch (error) {
            console.error(error);
        }
    };

    // 旧 onReachBottom
    useReachBottom(() => {
        if (filterParams.page < Math.ceil(total / filterParams.size)) {
            filterParams.page++;
            void __getCollectionShop();
        }
    });

    return (
        <TigLayout title={pageTitle}>
            <View className="collection-shop" data-list-rev="aW1sazIyODI">
                {collectionShopList.length > 0 && (
                    <View className="collection-content">
                        {collectionShopList.map((item) => (
                            <View className="move-item" key={item.shopId}>
                                <Swipe
                                    name={item.shopId}
                                    rightAction={
                                        <View className="collect-move-box">
                                            <View className="btn-del" onClick={() => handleCancel(item.shopId)}>
                                                <Text>{t("取消收藏")}</Text>
                                            </View>
                                        </View>
                                    }
                                >
                                    <View className="shop-item" onClick={() => handleLink(item.shopId)}>
                                        <View className="shop-item-left">
                                            <TigImage src={item.shop.shopLogo} />
                                        </View>
                                        <View className="shop-item-right">
                                            <View className="shop-name line1">{item.shop.shopTitle}</View>
                                            {item.shop?.tipNames?.length > 0 && (
                                                <View className="tipNames">
                                                    {item.shop?.tipNames?.map((i: any) => (
                                                        <View key={i} className="tipName">
                                                            {i}
                                                        </View>
                                                    ))}
                                                </View>
                                            )}
                                            {item.shop?.description && <View className="shop-desc line1">{item.shop.description}</View>}
                                            <View className="shop-info">
                                                <Text className="shop-info-text">
                                                    {t("上架商品：")}
                                                    {item.productCount}
                                                </Text>
                                                <Text className="shop-info-text">
                                                    {collectCountLabel}
                                                    {item.collectCount}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                </Swipe>
                            </View>
                        ))}
                    </View>
                )}
                {collectionShopList.length === 0 && !loading && !loaded && (
                    <View className="empty-box">
                        <View className="pictrue">
                            <Image src={staticResource("common/data_empty.png")} />
                        </View>
                        <View className="txt">{t("暂无收藏记录！")}</View>
                    </View>
                )}
                <LoadingBox modelValue={loaded} page={filterParams.page} length={collectionShopList.length} />
            </View>
        </TigLayout>
    );
}
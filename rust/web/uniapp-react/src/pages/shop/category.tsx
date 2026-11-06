import { useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro, { useLoad } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getShopCategory } from "@/api/shop/shop";
import type { ShopCategoryList } from "@/types/shop/shop";
import { usePageGuards } from "@/utils/pageMixin";
import { t } from "@/utils/i18n";

import "./category.scss";

/**
 * 店铺分类页（自旧 pages/shop/category.vue 190 行移植）
 * - 「全部商品」+ 一级分类（带二级分类宫格）
 * - 点击进入店铺搜索结果页（携带 shopId / shopCategoryId）
 */
export default function ShopCategory() {
    usePageGuards();

    const [shopId, setShopId] = useState(0);
    const [categoryList, setCategoryList] = useState<ShopCategoryList[]>([]);

    const __getShopCategory = async (id: number) => {
        try {
            const result = await getShopCategory(id);
            setCategoryList(result);
        } catch (error) {
            console.error(error);
        }
    };

    useLoad((options: any) => {
        if (options && options.shopId) {
            const id = Number(options.shopId);
            setShopId(id);
            void __getShopCategory(id);
        }
    });

    const handleToSearch = () => {
        Taro.navigateTo({
            url: `/pages/search/index?shopId=${shopId}`
        });
    };

    const handleToSearchResult = (shopCategoryId: number) => {
        if (shopCategoryId > 0) {
            Taro.navigateTo({
                url: `/pages/search/result?shopId=${shopId}&shopCategoryId=${shopCategoryId}`
            });
        } else {
            Taro.navigateTo({
                url: `/pages/search/result?shopId=${shopId}`
            });
        }
    };

    return (
        <TigLayout title="店铺分类" shopId={shopId}>
            <View className="shop-search-box" onClick={handleToSearch}>
                <View className="shop-search">
                    <View className="search-text">
                        <Text className="iconfont-h5 icon-sousuo sousuo-icon" />
                        {t("搜索")}
                    </View>
                </View>
            </View>

            <View className="category-content">
                <View className="category-content-item">
                    <View className="item-box special" onClick={() => handleToSearchResult(0)}>
                        <View className="item-left">{t("全部商品")}</View>
                        <View className="item-right">
                            <Text className="iconfont-h5 icon-youjiantou youjiantou-icon special" />
                        </View>
                    </View>
                </View>
                {categoryList.map((item) => (
                    <View key={item.categoryId} className="category-content-item">
                        <View className="item-box" onClick={() => handleToSearchResult(item.categoryId)}>
                            <View className="item-left">{item.categoryName}</View>
                            <View className="item-right">
                                <Text className="iconfont-h5 icon-youjiantou youjiantou-icon" />
                            </View>
                        </View>
                        {item.children && (
                            <View className="item-children-box">
                                {item.children.map((child) => (
                                    <View key={child.categoryId} className="children-item" onClick={() => handleToSearchResult(child.categoryId)}>
                                        <View className="children-item-text">{child.categoryName}</View>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                ))}
            </View>
        </TigLayout>
    );
}

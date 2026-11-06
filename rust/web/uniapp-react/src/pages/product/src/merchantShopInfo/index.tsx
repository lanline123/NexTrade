import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import type { ShopDetailItem } from "@/types/shop/shop";
import { shopCollection } from "@/api/shop/shop";
import { imageFormat } from "@/utils/format";
import { redirect } from "@/utils";
import TigImage from "@/components/tig/tig-image/TigImage";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    shopInfo: ShopDetailItem;
    variant?: "vortmall" | "o2o" | "overseas";
    /** 对应旧 emit("refreshShopDetail", shopId) */
    onRefreshShopDetail?: (shopId: number) => void;
}

/**
 * 店铺信息卡片（自旧 pages/product/src/merchantShopInfo.vue 移植）
 * - 店铺 logo + 店铺名 + 收藏店铺 / 进店逛逛
 */
export default function MerchantShopInfo({ shopInfo, variant = "o2o", onRefreshShopDetail }: Props) {
    const collectText = shopInfo.collectShop ? t("取消收藏") : t("收藏店铺");

    const toggleCollection = async () => {
        try {
            await shopCollection({ shopId: shopInfo.shopId });
            Taro.showToast({
                title: shopInfo.collectShop ? t("操作成功") : t("收藏成功")
            });
            onRefreshShopDetail?.(shopInfo.shopId);
        } catch (error) {
            console.error(error);
        }
    };

    const handleShopCollection = () => {
        if (!shopInfo.collectShop) {
            void toggleCollection();
            return;
        }

        Taro.showModal({
            title: t("提示"),
            content: t("确认要取消收藏店铺吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: (res) => {
                if (res.confirm) void toggleCollection();
            }
        });
    };

    const handleToShop = () => {
        if (!Number.isInteger(shopInfo.shopId) || shopInfo.shopId < 0) return;
        redirect({
            url: `/pages/shop/index?shopId=${shopInfo.shopId}`
        });
    };

    return (
        <View className={`merchant-shop-card merchant-shop-card--${variant}`}>
            <View className="merchant-shop-card__title" onClick={handleToShop}>
                <View className="merchant-shop-card__logo">
                    <TigImage src={imageFormat(shopInfo.shopLogo)} mode="aspectFit" />
                </View>
                <View className="merchant-shop-card__name line1">{shopInfo.shopTitle}</View>
            </View>
            <View className="merchant-shop-card__actions">
                <View className="merchant-shop-card__button" onClick={handleShopCollection}>
                    {collectText}
                </View>
                <View className="merchant-shop-card__button" onClick={handleToShop}>
                    <Text className="iconfont-h5 icon-dianpu" />
                    {t("进店逛逛")}
                </View>
            </View>
        </View>
    );
}

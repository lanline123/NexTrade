import { Text, View } from "@tarojs/components";

import type { StoreDetailData } from "@/types/store/store";
import { redirect } from "@/utils";
import { imageFormat } from "@/utils/format";
import { useRegionStore } from "@/store/region";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import "./ProductShopInfo.scss";

interface Props {
    storeInfo: StoreDetailData;
    productId?: number;
    shopId?: number;
    formType: boolean;
}

/**
 * 商品门店信息组件（自旧 pages/productV1/src/productShopInfo.vue 移植）
 * - 显示门店名称
 * - 支持点击跳转门店详情 / 切换门店
 *
 * 复用决策：B2 pages/product/src 下无等价组件（merchantShopInfo 为店铺会员卡，
 * props 契约不同），故按旧源码独立落盘到 productV1/src。
 */
export default function ProductShopInfo({ storeInfo, productId, shopId, formType }: Props) {
    const configStore = useConfigStore();

    const showStoreInfo = {
        shopTitle: storeInfo?.shopTitle || t("商城自营"),
        shopLogo: storeInfo?.shopLogo || configStore.baseInfo.shopLogo
    };

    const handleToShop = () => {
        if (!storeInfo?.shopId) return;

        redirect({
            url: `/pages/store/index?id=${storeInfo.shopId}`
        });
    };

    const handleStoreList = () => {
        if (!productId) return;

        // region store 已随 B6-6b-1 全量移植（currentRegion / currentLocationInfo 直接可用）；
        // 此处按旧 URL 契约兜底空值。
        const regionStore = useRegionStore.getState();

        // formType 为 true 时（通过带 shopId 的链接直接进入商详），用 redirectTo 替换当前商详页，
        // 让门店列表选店后重新打开商详；不直接操作 history.back，避免 PC iframe 套壳下退出整个 H5 应用导致跳转失效
        redirect({
            url: `/pages/storeList/index?productId=${productId}&regionId=${regionStore.currentRegion?.regionId ?? ""}&latitude=${
                regionStore.currentLocationInfo?.latitude ?? ""
            }&longitude=${regionStore.currentLocationInfo?.longitude ?? ""}&shopId=${shopId ?? ""}`,
            mode: formType ? "redirectTo" : "navigateTo"
        });
    };

    return (
        <View className="shop-info-box" onClick={handleToShop}>
            <View className="shop-info-title">
                <View className="shop-info-title-left">
                    <View className="shop-logo" style={{ backgroundImage: `url(${imageFormat(showStoreInfo.shopLogo)})` }} />
                </View>
                <View className="shop-info-title-right line1">{showStoreInfo.shopTitle}</View>
            </View>

            <View
                className="shop-info-btn"
                onClick={(e) => {
                    e.stopPropagation();
                    handleStoreList();
                }}
            >
                <View>{formType ? t("进入门店") : t("切换门店")}</View>
                <View className="right-arrows">
                    <Text className="iconfont-h5 icon-gengduo1" style={{ fontSize: "22rpx", color: "#bfbfbf" }} />
                </View>
            </View>
        </View>
    );
}
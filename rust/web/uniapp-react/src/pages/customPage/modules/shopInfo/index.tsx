import { Input, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import { shopCollection } from "@/api/shop/shop";
import type { ShopDetailItem } from "@/types/shop/shop";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    shopInfo: ShopDetailItem;
    /** 旧 emit("refreshShopDetail", shopId)：收藏/取消收藏后让页面重拉店铺详情 */
    onRefreshShopDetail?: (shopId: number) => void;
}

/**
 * 店铺信息装修模块（自旧 pages/customPage/modules/shopInfo/index.vue 483 行移植）
 * - 三种风格（module.style）的店铺头图 + 搜索/导航 + 店铺名/商品数/收藏按钮
 * - 收藏态取 shopInfo.collectShop；收藏/取消收藏后回调页面刷新详情
 */
export default function ShopInfoModule({ module, shopInfo, onRefreshShopDetail }: Props) {
    // 旧 computed：背景图列表为 OSS 内置 10 张，backgroundDefault=0 时取自定义图
    const imgList = () => {
        const arr: string[] = [];
        for (let i = 1; i <= 10; i++) {
            arr.push(`https://lyecs2.oss-cn-zhangjiakou.aliyuncs.com/static/mini/bg/${i}.jpg`);
        }
        return arr;
    };

    const backgroundImg = (() => {
        let url: string;
        if (module?.backgroundDefault == 0 && module?.customPic?.picUrl) {
            url = imageFormat(module.customPic.picUrl);
        } else {
            url = imgList()[module?.backgroundDefault - 1];
        }
        return url;
    })();

    const collectText = shopInfo.collectShop ? t("已收藏") : t("收藏");

    const collect = async () => {
        try {
            await shopCollection({ shopId: shopInfo.shopId });
            Taro.showToast({ title: t("收藏成功") });
            onRefreshShopDetail?.(shopInfo.shopId);
        } catch (error) {
            console.error(error);
        }
    };

    const cancelCollect = async () => {
        Taro.showModal({
            title: t("提示"),
            content: t("确认要取消收藏店铺吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (res.confirm) {
                    try {
                        await shopCollection({ shopId: shopInfo.shopId });
                        Taro.showToast({ title: t("操作成功") });
                        onRefreshShopDetail?.(shopInfo.shopId);
                    } catch (error) {
                        console.error(error);
                    }
                }
            }
        });
    };

    const handleShopCollection = () => {
        if (shopInfo.collectShop) {
            void cancelCollect();
        } else {
            void collect();
        }
    };

    const toSearchTransferPage = () => {
        Taro.navigateTo({ url: `/pages/search/index?shopId=${shopInfo.shopId}` });
    };

    const toSearch = () => {
        Taro.navigateTo({ url: `/pages/search/result?&shopId=${shopInfo.shopId}` });
    };

    const toCategory = () => {
        Taro.navigateTo({ url: `/pages/shop/category?shopId=${shopInfo.shopId}` });
    };

    /** 点击店铺名称进入店铺信息页（无快照时仍可打开，只是没有资质区块） */
    const toShopInfo = () => {
        if (!shopInfo.shopId) return;
        Taro.navigateTo({ url: `/pages/shop/info?shopId=${shopInfo.shopId}` });
    };

    return (
        <View className={`module-ad-con module-store_info ad-store_style__${module?.style}`}>
            {module && (
                <View className="module-ad-content">
                    <View className="cap-store-banner">
                        <View className="cap-store-banner__cover" style={`background-image: url(${backgroundImg});`}>
                            <View className="cap-store-banner__cover-mask" />
                        </View>
                        <View className="cap-store-nav-warp">
                            <View className="cap-store-nav-con">
                                <View className="store-search-con">
                                    <View id="search" className="flex align-center" onClick={toSearchTransferPage}>
                                        <View className="iconfont-h5 icon-sousuo" />
                                        <Input type="text" className="search-input" placeholder={t("搜商品")} />
                                    </View>
                                </View>
                                <View className="store-nav-con">
                                    <View className="store-nav-item active">
                                        <View className="store-nav-item-a">{t("精选")}</View>
                                    </View>
                                    <View className="store-nav-item">
                                        <View className="store-nav-item-a" onClick={toSearch}>
                                            {t("商品")}
                                        </View>
                                    </View>
                                    <View className="store-nav-item">
                                        <View className="store-nav-item-a" onClick={toCategory}>
                                            {t("分类")}
                                        </View>
                                    </View>
                                </View>
                            </View>
                        </View>

                        <View className="cap-store-banner__inner">
                            <View className="cap-store-banner__content">
                                <View className="cap-store-banner__logo">
                                    <TigImage src={shopInfo.shopLogo} mode="widthFix" />
                                </View>
                                <View className="cap-store-banner__right-content">
                                    <View className="cap-store-banner__right-content-title--middle" onClick={toShopInfo}>
                                        {shopInfo.shopTitle}
                                    </View>
                                    <View className="cap-store-banner__sum-content">
                                        <View className="cap-store-banner__sum-content-total">
                                            {t("全部商品")} {shopInfo.productCount}
                                        </View>

                                        <View className="cap-store-banner__sum-content-total">
                                            {t("新品")} {shopInfo.newProductCount}
                                        </View>
                                    </View>
                                </View>
                                <View className="store-collect-button-con" onClick={handleShopCollection}>
                                    <View className="store-collect-button">{collectText}</View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            )}
        </View>
    );
}

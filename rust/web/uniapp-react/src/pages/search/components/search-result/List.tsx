import { useMemo, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";

import TigLazyImage from "@/components/tig/tig-lazy-image/TigLazyImage";
import ActivityCard from "@/components/masonry/ActivityCard";
import Specification, { type SpecificationRef } from "@/components/product/specification";
import FormatPrice from "@/components/format-price/FormatPrice";
import { redirect } from "@/utils";
import { shouldShowSoldOut } from "@/utils/productSoldOut";
import type { SearchResultModuleData } from "@/components/modules/search-result/types";
import { t } from "@/utils/i18n";

import "./List.scss";

interface Props {
    productList?: any[];
    promotionList?: Record<string, any>;
    config?: SearchResultModuleData;
    onCallback?: () => void;
}

/**
 * 搜索结果页 - 单列商品列表（自旧 pages/search/components/search-result/list.vue 移植）
 * 加购走规格弹窗流程（与 masonry 商品卡一致）。
 */
export default function SearchProductList({ productList = [], promotionList = {}, config = {} as SearchResultModuleData, onCallback }: Props) {
    const cssVars = useMemo(
        () =>
            ({
                "--list-item-bg": config.itemBackgroundColor || "#ffffff",
                "--list-title-color": config.productTitleColor || "#333333",
                "--list-price-color": config.priceColor || config.themeColor || "var(--general)",
                "--list-theme-color": config.themeColor || "var(--general)",
                "--list-image-radius": `${(config.productImageRadius ?? 4) * 2}rpx`
            }) as Record<string, string>,
        [config.itemBackgroundColor, config.productTitleColor, config.priceColor, config.themeColor, config.productImageRadius]
    );

    /**
     * 标题截断放在内联样式上：-webkit-box / -webkit-box-orient 走 CSS 时
     * 可能被 PostCSS 当作废弃属性剥离，导致行数配置失效
     */
    const titleClampStyle = useMemo(() => {
        const line = String(config.productTitleLine ?? 2);
        return {
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: line,
            lineClamp: line,
            overflow: "hidden",
            textOverflow: "ellipsis",
            wordBreak: "break-all"
        } as Record<string, string | number>;
    }, [config.productTitleLine]);

    const showOutsale = (item: any) => shouldShowSoldOut(item);

    const getActivityInfo = (item: any) => {
        const activityInfo = promotionList?.[item.productId]?.activityInfo || [];
        // 单列模式按产品规则不展示优惠券；满减、折扣、秒杀等其它活动标签保留。
        return activityInfo.filter((sub: any) => sub.type !== 2);
    };

    const isPresale = (item: any) => Number(item?.saleMode ?? item?.presaleInfo?.saleMode ?? 0) > 0;

    const toPage = (item: any) => {
        const promotionItem = promotionList[item.productId];
        const skuId = promotionItem?.activityInfo?.[0]?.skuIds?.[0];
        let params = `id=${item.productId}`;
        if (skuId) params += `&skuId=${skuId}`;
        if (item.shop?.shopId) params += `&shopId=${item.shop.shopId}`;
        redirect({ url: "/pages/product/index?" + params });
    };

    const [productId, setProductId] = useState(0);
    const specificationRef = useRef<SpecificationRef>(null);
    const [currentItem, setCurrentItem] = useState<any>({});
    // 旧版直接 mutate item.isCheck 借 Vue 响应式刷新；React 用 tick 强制重渲染
    const [, setTick] = useReducerTick();

    const isCycleBuy = currentItem.deliveryMode === 2 && currentItem.deliveryType === 1;
    const isSubCard = currentItem.deliveryMode === 2 && currentItem.deliveryType === 2;

    const handleBuy = (item: any) => {
        if (item.isCheck) return;
        item.isCheck = true;
        setCurrentItem(item);
        setProductId(item.productId);
        setTick();
    };

    const loadEnd = () => {
        specificationRef.current?.handleShowPopup();
        if (currentItem) {
            currentItem.isCheck = false;
        }
        setTick();
    };

    const handleClose = () => {
        setProductId(0);
    };

    return (
        <>
            <View className="search-list" style={cssVars as any}>
                {productList.map((item, index) => (
                    <View key={item.productId || index} className="search-list__item" onClick={() => toPage(item)}>
                        <View className="photo">
                            <TigLazyImage src={item.picUrl} mode="widthFix" />
                            {showOutsale(item) && (
                                <View className="product-status-box">
                                    <View className="outsale">{t("已售罄")}</View>
                                </View>
                            )}
                        </View>
                        <View className="info">
                            <View className="detail" style={titleClampStyle as any}>
                                {item.productName}
                            </View>
                            {config.showSales !== false && (
                                <View className="tips">
                                    {t("已售")} {item.virtualSales || 0}
                                </View>
                            )}

                            {(getActivityInfo(item).length > 0 || isPresale(item)) && (
                                <View className="flex activity-box">
                                    {getActivityInfo(item).map((subItem: any) =>
                                        subItem.type === 7 ? (
                                            <View key={subItem.promotionId || subItem.type} className="special-activity-tag groupon-tag">
                                                {t("拼团")}
                                            </View>
                                        ) : (
                                            <ActivityCard key={subItem.promotionId || subItem.type} activityInfo={subItem} themeColor={config.themeColor} />
                                        )
                                    )}
                                    {isPresale(item) && <View className="special-activity-tag presale-tag">{t("预售")}</View>}
                                </View>
                            )}

                            <View className="action">
                                <View className="pricenum">
                                    <FormatPrice
                                        fontStyle={{ fontSize: "32rpx", fontWeight: "bold" }}
                                        currencyStyle={{ fontSize: "22rpx", fontWeight: "bold" }}
                                        decimalsStyle={{ fontSize: "25rpx", fontWeight: "bold" }}
                                        priceData={item.price}
                                    />
                                </View>
                                {config.showShopTag !== false && <View className="shop-name">{item.shop?.shopTitle || t("官方自营店")}</View>}
                                {config.showCartButton !== false && (
                                    <View className="shop-btn">
                                        <View
                                            className="btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleBuy(item);
                                            }}
                                        >
                                            {/* TODO(B2-1b)：旧 up-loading-icon（uview 圆圈 loading）随基础组件批次替换 */}
                                            {item.isCheck ? <Text>…</Text> : <Text>{t("添加购物车")}</Text>}
                                        </View>
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                ))}
            </View>

            <Specification
                ref={specificationRef}
                productId={productId}
                isCycleBuy={isCycleBuy}
                isSubCard={isSubCard}
                onAddCardSucceed={() => onCallback?.()}
                onLoadEnd={loadEnd}
                onClose={handleClose}
            />
        </>
    );
}

/** 轻量强制重渲染 */
function useReducerTick(): [number, () => void] {
    const [v, setV] = useState(0);
    return [v, () => setV((x) => x + 1)];
}

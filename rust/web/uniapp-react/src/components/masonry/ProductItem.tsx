import { useMemo } from "react";
import { View, Text, Image } from "@tarojs/components";
import dayjs from "dayjs";

import { productImage } from "@/utils/format";
import ActivityCard from "./ActivityCard";
import FormatPrice from "@/components/format-price/FormatPrice";
import TigLazyImage from "@/components/tig/tig-lazy-image/TigLazyImage";
import { staticResource } from "@/utils";
import { shouldShowSoldOut } from "@/utils/productSoldOut";
import { t } from "@/utils/i18n";
import type { ProductActiveStyleVO } from "@/types/product/productStyle";

import "./ProductItem.scss";

interface Props {
    item: any;
    promotionList: any;
    styleMap?: Record<number, ProductActiveStyleVO>;
    type?: string;
    showShop?: boolean;
    isCycleBuy?: boolean;
    isSubCard?: boolean;
    /** 文本对齐：1=左对齐，2=居中对齐 */
    textAlign?: number;
    /** 文字粗细：1=常规体，2=加粗体 */
    textWeight?: number;
    /** 商品名称行数：1=1行，2=2行 */
    goodsNameRow?: number;
    /** 商品标题行数（兼容字段，等价 goodsNameRow） */
    productTitleLine?: number;
    /** 是否显示商品名称 */
    showName?: boolean;
    /** 购买按钮样式：undefined=沿用旧图标，0=不显示，1~8=对应样式 */
    buyBtnStyle?: number;
    /** 是否显示优惠券活动；undefined 表示沿用其他页面原有行为 */
    showCoupon?: boolean;
    productTitleColor?: string;
    priceColor?: string;
    themeColor?: string;
    itemBackgroundColor?: string;
    productImageRadius?: number;
    onClickItem?: (item: any) => void;
    onClickBuy?: (item: any) => void;
    onClickShop?: (shopId: number) => void;
}

/** 商品卡片（自旧 masonry/product-item.vue 移植，瀑布流/搜索/分类列表共用） */
export default function ProductItem({
    item,
    promotionList,
    styleMap = {},
    type = "",
    isSubCard = false,
    textAlign,
    textWeight,
    goodsNameRow,
    productTitleLine,
    showName = true,
    buyBtnStyle,
    showCoupon,
    productTitleColor,
    priceColor,
    themeColor,
    itemBackgroundColor,
    productImageRadius,
    onClickItem,
    onClickBuy
}: Props) {
    // --pi-* 由装修配置下发（见 decorateVars），未配置时 fallback 即原有硬编码值
    const decorateVars = useMemo(() => {
        const vars: Record<string, string> = {};
        if (productTitleColor?.trim()) vars["--pi-title-color"] = productTitleColor;
        if (priceColor?.trim()) vars["--pi-price-color"] = priceColor;
        if (themeColor?.trim()) vars["--pi-theme"] = themeColor;
        if (itemBackgroundColor?.trim()) vars["--pi-item-bg"] = itemBackgroundColor;
        if (productImageRadius != null) vars["--pi-image-radius"] = `${Math.max(0, productImageRadius) * 2}rpx`;
        return vars;
    }, [productTitleColor, priceColor, themeColor, itemBackgroundColor, productImageRadius]);

    const productCardRadius = productImageRadius == null ? undefined : `${Math.max(0, productImageRadius) * 2}rpx`;
    const showBuyBtn = buyBtnStyle !== 0;

    const itemClasses = useMemo(() => {
        const cls: string[] = [];
        if (type === "exchange") cls.push("item-li--exchange");
        if (textAlign === 2) cls.push("item-li--align-2");
        if (textWeight === 1) cls.push("item-li--weight-1");
        const row = goodsNameRow ?? productTitleLine;
        if (row === 1) cls.push("item-li--name-row-1");
        return cls.join(" ");
    }, [type, textAlign, textWeight, goodsNameRow, productTitleLine]);

    const row = goodsNameRow ?? productTitleLine;
    const detailStyle = row === 1 || row === 2 ? ({ "-webkit-line-clamp": row, "line-clamp": row } as Record<string, string | number>) : {};

    const currentStyle = useMemo(() => {
        const productId = item?.productId;
        return productId ? (styleMap[productId] ?? null) : null;
    }, [item, styleMap]);

    // 计算是否显示售罄状态
    const showOutsale = shouldShowSoldOut(item, { isSubCard });

    // 计算促销信息
    const currentPromotionInfo = useMemo(() => {
        const promotionItem = promotionList[item.productId];
        const activityInfo = promotionItem?.activityInfo || [];
        if (showCoupon === false) {
            return activityInfo.filter((it: any) => Number(it?.type) !== 2);
        }
        return activityInfo;
    }, [promotionList, item, showCoupon]);

    const hasPromotionInfo = Object.keys(promotionList).length > 0 && currentPromotionInfo.length > 0;

    const hasGrouponActivity = useMemo(() => {
        // 判断当前的活动是否有拼团活动
        const promotionItem = currentPromotionInfo.find((it: any) => it.type === 7);
        if (!promotionItem) return false;
        // 判断当前时间是否在活动时间内
        const now = dayjs().format("YYYY-MM-DD HH:mm:ss");
        if (promotionItem.startTime > now || promotionItem.endTime < now) return false;
        return true;
    }, [currentPromotionInfo]);

    return (
        <View
            className={`item-li ${itemClasses}`}
            style={{ ...decorateVars, backgroundColor: itemBackgroundColor || undefined, borderRadius: productCardRadius } as any}
            onClick={() => onClickItem?.(item)}
        >
            <View className="photo" style={{ borderRadius: productCardRadius } as any}>
                <TigLazyImage src={productImage(item)} mode="widthFix" />
                {showOutsale && (
                    <View className="product-status-box">
                        <View className="outsale">{t("已售罄")}</View>
                    </View>
                )}
                {currentStyle?.borderImage && <Image className="product-style-border" src={currentStyle.borderImage} mode="scaleToFill" />}
            </View>
            <View className="info">
                {showName && (
                    <View className="detail presale-box" style={detailStyle as any}>
                        {hasGrouponActivity && <Text className="groupon-tag">{t("拼")}</Text>}
                        {(item.saleMode && item.saleMode > 0) || item.productSaleMode ? (
                            <>
                                <Text className="presale-tag">{t("预售")}</Text>
                                <Text className="separator">|</Text>
                            </>
                        ) : null}
                        <Text>{item.productName}</Text>
                    </View>
                )}
                {hasPromotionInfo && (
                    <View className="flex activity-box">
                        {currentPromotionInfo.map((subItem: any) => (
                            <ActivityCard key={subItem.promotionId} activityInfo={subItem} themeColor={themeColor} />
                        ))}
                    </View>
                )}

                <View className="action">
                    <View className="pricenum">
                        {type === "exchange" ? (
                            <View className="exchange-box">
                                <FormatPrice
                                    fontStyle={{ fontSize: "32rpx" }}
                                    currencyStyle={{ fontSize: "22rpx" }}
                                    decimalsStyle={{ fontSize: "25rpx" }}
                                    priceData={item.discountsPrice}
                                />
                                <Text className="exchange-icon">+</Text>
                                <Image className="exchange-img" src={staticResource("exchange/exchange.png")} />
                                <Text className="exchange-text">{item.exchangeIntegral}</Text>
                            </View>
                        ) : (
                            <FormatPrice
                                fontStyle={{ fontSize: "32rpx" }}
                                currencyStyle={{ fontSize: "22rpx" }}
                                decimalsStyle={{ fontSize: "25rpx" }}
                                priceData={item.price}
                            />
                        )}
                    </View>

                    {showBuyBtn && (
                        <View
                            className={`buy_btn ${buyBtnStyle && buyBtnStyle >= 1 && buyBtnStyle <= 8 ? `buy_btn--style${buyBtnStyle}` : ""}`}
                            onClick={(e) => {
                                e.stopPropagation();
                                onClickBuy?.(item);
                            }}
                        >
                            {item.isCheck ? (
                                <Text className="buy_btn_text">…</Text>
                            ) : buyBtnStyle === 5 || buyBtnStyle === 6 ? (
                                <Text className="buy_btn_text">{t("购买")}</Text>
                            ) : buyBtnStyle === 7 || buyBtnStyle === 8 ? (
                                <Text className="buy_btn_text">{t("马上抢")}</Text>
                            ) : buyBtnStyle === 1 ? (
                                <Text className="iconfont-h5 buy_btn_icon icon-gouwuche" />
                            ) : buyBtnStyle === 2 ? (
                                <Text className="iconfont-h5 buy_btn_icon icon-gouwuche1" />
                            ) : buyBtnStyle === 3 ? (
                                <Text className="iconfont-h5 buy_btn_icon icon-jia" />
                            ) : buyBtnStyle === 4 ? (
                                <Text className="iconfont-h5 buy_btn_icon icon-jia1" />
                            ) : type !== "exchange" ? (
                                // 未传 buyBtnStyle 时沿用旧图标（其他场景不受影响）
                                <Text className="iconfont-h5 icon-gouwuche3 buy_btn_icon" />
                            ) : null}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

import { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";

import { designPxToRpx } from "@/components/modules";
import { imageFormat, urlFormat, productImage } from "@/utils/format";
import { redirect } from "@/utils";
import { getDecorateProducts } from "@/components/modules/useDecorateProducts";
import { t } from "@/utils/i18n";
import FormatPrice from "@/components/format-price/FormatPrice";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
    shopId?: number;
}

export default function ProductSlide({ module, shopId = -1 }: Props) {
    // 逐卡渐变兜底调色板（与 admin defaultProductSlide 对齐）
    const gradientFallback = [
        ["#B6A8F5", "#8E7BF0"],
        ["#FF8FB8", "#FF5E96"],
        ["#FFD98A", "#FBC25A"],
        ["#C7BEF8", "#9C8CF0"]
    ];

    // admin defaultProductSlide 同源 fallback：处理老数据 / 不完整 payload
    const showProductName = useMemo(() => Number(module.showProductName ?? 1) === 1, [module.showProductName]);
    const showFeature = useMemo(() => Number(module.showFeature ?? 0) === 1, [module.showFeature]);
    const showBrief = useMemo(() => Number(module.showBrief ?? 0) === 1, [module.showBrief]);
    const showPrice = useMemo(() => Number(module.showPrice ?? 1) === 1, [module.showPrice]);
    const showSales = useMemo(() => Number(module.showSales ?? 0) === 1, [module.showSales]);
    const showMarketPrice = useMemo(() => Number(module.showMarketPrice ?? 0) === 1, [module.showMarketPrice]);
    const buyBtnStyleNum = useMemo(() => Number(module.buyBtnStyle ?? 0), [module.buyBtnStyle]);
    const salesColor = useMemo(() => module.productSalesColor || "#FFFFFF", [module.productSalesColor]);

    const moduleBgUrl = useMemo(() => {
        const url = module.moduleBgImage?.picUrl;
        return url ? imageFormat(url) : "";
    }, [module.moduleBgImage]);

    const getSales = (item: any) => Number(item.salesVolume ?? item.virtualSales ?? item.salesCount ?? 0);
    const getBrief = (item: any) => item.brief || item.sellingPoint || item.productBrief || "";
    const getFeature = (item: any) => item.feature || item.productFeature || item.intro || "";
    const heroTitle = (idx: number) => {
        const list = module.cardTitleList;
        return Array.isArray(list) ? list[Number(idx)] || "" : "";
    };
    const marketPriceVisible = (item: any) => Number(item.marketPrice) > Number(item.productPrice);

    const outerStyle = useMemo(() => {
        const f: any = module.frame || {};
        return [
            `padding-left:${designPxToRpx(f.boxPadding ?? 8)};`,
            `padding-right:${designPxToRpx(f.boxPadding ?? 8)};`,
            `padding-top:${designPxToRpx(f.boxPaddingTop ?? 5)};`,
            `padding-bottom:${designPxToRpx(f.boxPaddingBottom ?? 0)};`,
            f.backgroundColor ? `background-color:${f.backgroundColor};` : ""
        ].join("");
    }, [module.frame]);

    const wrapStyle = useMemo(() => {
        const r = module.frame?.boxRadius ?? 16;
        const bg = module.innerBgColor || "transparent";
        return `background-color:${bg};border-radius:${designPxToRpx(r)};`;
    }, [module.frame, module.innerBgColor]);

    const ratioPaddingMap: Record<string, string> = {
        default: "",
        "1:1": "100%",
        "3:4": "133.333%",
        "3:2": "66.667%"
    };
    const ratioPadding = useMemo(() => ratioPaddingMap[module.productPicRatio || "1:1"] || "", [module.productPicRatio]);
    const fillMode = useMemo(() => ((module.productPicFillType || "cover") === "contain" ? "aspectFit" : "aspectFill"), [module.productPicFillType]);

    const trackStyle = useMemo(() => {
        const gap = module.productItemGap ?? 10;
        return `gap:${designPxToRpx(gap)};`;
    }, [module.productItemGap]);

    const itemStyle = (idx: number) => {
        const i = Number(idx);
        const startList = module.cardGradientStartList;
        const endList = module.cardGradientEndList;
        const a = (Array.isArray(startList) && startList[i]) || gradientFallback[i % gradientFallback.length][0];
        const b = (Array.isArray(endList) && endList[i]) || gradientFallback[i % gradientFallback.length][1];
        const percent = module.productPercent ?? 42;
        const radius = module.cardRadius ?? 16;
        const gap = module.layerGap ?? 10;
        const align = module.textAlign || "center";
        const itemsAlign = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
        return [
            `flex:0 0 ${percent}%;width:${percent}%;`,
            `background-image:linear-gradient(to bottom, ${a}, ${b});`,
            `border-radius:${designPxToRpx(radius)};`,
            `gap:${designPxToRpx(gap)};`,
            `align-items:${itemsAlign};`,
            `text-align:${align};`
        ].join("");
    };

    const heroStyle = useMemo(() => `color:${module.cardTitleColor || "#FFFFFF"};font-weight:${module.textWeight || 700};`, [module.cardTitleColor, module.textWeight]);
    const descStyle = useMemo(() => `color:${module.descColor || "#FFFFFF"};`, [module.descColor]);

    const photoStyle = useMemo(() => (ratioPadding ? `padding-top:${ratioPadding};` : "padding-top:0;"), [ratioPadding]);

    const cardStyleBg = () => {
        switch (module.cardStyle) {
            case "noBorderWhite":
                return "background-color:#ffffff;";
            case "shadow":
                return "background-color:#ffffff;box-shadow:0 8rpx 24rpx rgba(0,0,0,0.12);";
            case "border":
                return "background-color:#ffffff;border:1px solid rgba(0,0,0,0.08);";
            default:
                return "background-color:transparent;";
        }
    };

    const imgWrapStyle = useMemo(() => {
        const radius = module.productImgRadius ?? 12;
        const base = cardStyleBg();
        if (ratioPadding) {
            return `${base}border-radius:${designPxToRpx(radius)};position:absolute;top:0;left:0;width:100%;height:100%;`;
        }
        return `${base}border-radius:${designPxToRpx(radius)};position:static;`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [module.productImgRadius, module.cardStyle, ratioPadding]);

    const platformStyle = useMemo(() => (Number(module.showImagePlatform ?? 0) === 1 ? "filter:drop-shadow(0 12rpx 10rpx rgba(0,0,0,0.22));" : ""), [module.showImagePlatform]);

    const badgeStyle = useMemo(() => `background-color:${module.badgeColor || "#FE3A01"};color:#ffffff;`, [module.badgeColor]);

    const bottomStyle = useMemo(() => {
        const align = module.textAlign || "center";
        const justify = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
        return `justify-content:${justify};`;
    }, [module.textAlign]);

    const priceFontStyle = useMemo(() => {
        const size = module.priceFontSize ?? 15;
        return {
            fontSize: designPxToRpx(size),
            fontWeight: module.priceBold === 0 ? 400 : 700,
            color: module.productPriceColor || "#FFFFFF",
            lineHeight: 1
        };
    }, [module.priceFontSize, module.priceBold, module.productPriceColor]);
    const priceCurrencyStyle = useMemo(() => {
        const size = module.priceFontSize ?? 15;
        return {
            fontSize: designPxToRpx(Math.round(size * 0.7)),
            color: module.productPriceColor || "#FFFFFF"
        };
    }, [module.priceFontSize, module.productPriceColor]);
    const marketPriceStyle = useMemo(
        () => ({
            fontSize: "22rpx",
            color: module.productMarketPriceColor || "#FFFFFF"
        }),
        [module.productMarketPriceColor]
    );

    const buyBtnStyle = useMemo(() => {
        const a = module.buyBtnGradientStart || "#FF6FA8";
        const b = module.buyBtnGradientEnd || "#FF3B8B";
        const color = module.buyBtnTextColor || "#FFFFFF";
        return `background-image:linear-gradient(to right, ${a}, ${b});color:${color};`;
    }, [module.buyBtnGradientStart, module.buyBtnGradientEnd, module.buyBtnTextColor]);

    const [productList, setProductList] = useState<any[]>([]);
    const _getProductList = async () => {
        try {
            setProductList(
                await getDecorateProducts(module.products, {
                    shopId: shopId,
                    extraParams: { productStatus: 1, checkStatus: 1 }
                })
            );
        } catch (error) {
            console.log(error);
        }
    };

    // 对应旧 setup 立即调用 + watch(module.products)：初次挂载拉取一次，products 变化时重新拉取
    useEffect(() => {
        void _getProductList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(module.products ?? {})]);

    if (!(productList.length > 0)) {
        return null;
    }

    return (
        <View className="module-ad-con module-product_slide" style={outerStyle}>
            {moduleBgUrl ? <Image className="ps-module-bg" src={moduleBgUrl} mode="aspectFill" /> : null}
            <View className="ps-wrap" style={wrapStyle}>
                <View className="ps-scroll">
                    <View className="ps-track" style={trackStyle}>
                        {productList.map((item: any, idx: number) => (
                            <View
                                key={(item.productId || 0) + "_" + idx}
                                className="ps-item"
                                style={itemStyle(idx)}
                                onClick={() => item.productId && redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })}
                            >
                                {heroTitle(idx) ? (
                                    <View className="ps-hero" style={heroStyle}>
                                        {heroTitle(idx)}
                                    </View>
                                ) : null}
                                {showProductName ? (
                                    <View className="ps-name" style={descStyle}>
                                        <Text>{item.productName}</Text>
                                    </View>
                                ) : null}
                                {showFeature && getFeature(item) ? <View className="ps-feature" style={descStyle}>{getFeature(item)}</View> : null}

                                <View className="ps-photo" style={photoStyle}>
                                    <View className="ps-img-wrap" style={imgWrapStyle}>
                                        {ratioPadding ? (
                                            <Image className="ps-img ps-img-ratio" mode={fillMode} style={platformStyle} src={productImage(item)} />
                                        ) : (
                                            <Image className="ps-img ps-img-fluid" mode="widthFix" style={platformStyle} src={productImage(item)} />
                                        )}
                                    </View>
                                    {showBrief && getBrief(item) ? <View className="ps-badge" style={badgeStyle}>{getBrief(item)}</View> : null}
                                </View>

                                <View className="ps-bottom" style={bottomStyle}>
                                    <View className="ps-prices">
                                        {showPrice ? (
                                            <View className="price-current">
                                                <FormatPrice
                                                    fontStyle={priceFontStyle as any}
                                                    currencyStyle={priceCurrencyStyle as any}
                                                    priceData={item.deliveryMode === 2 ? item.cyclePrice : item.productPrice}
                                                />
                                            </View>
                                        ) : null}
                                        {showMarketPrice && marketPriceVisible(item) ? (
                                            <View className="price-market">
                                                <FormatPrice fontStyle={marketPriceStyle as any} currencyStyle={marketPriceStyle as any} priceData={item.marketPrice} />
                                            </View>
                                        ) : null}
                                        {buyBtnStyleNum > 0 ? (
                                            <View
                                                className={`buy-btn buy-btn-style__${buyBtnStyleNum}`}
                                                style={buyBtnStyle}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    item.productId && redirect({ url: `/pages/product/index?id=${item.productId}` });
                                                }}
                                            >
                                                {buyBtnStyleNum === 5 || buyBtnStyleNum === 6 ? (
                                                    <Text className="buy-btn-text">{t("购买")}</Text>
                                                ) : buyBtnStyleNum === 7 || buyBtnStyleNum === 8 ? (
                                                    <Text className="buy-btn-text">{t("马上抢")}</Text>
                                                ) : (
                                                    <View className="iconfont-h5 buy-btn-icon" />
                                                )}
                                            </View>
                                        ) : null}
                                    </View>
                                    {showSales ? (
                                        <View className="ps-sales" style={`color:${salesColor}`}>
                                            {t("已售")}
                                            {getSales(item)}
                                        </View>
                                    ) : null}
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
}

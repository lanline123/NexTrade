import { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";

import { designPxToRpx } from "@/components/modules";
import { imageFormat, urlFormat, productImage } from "@/utils/format";
import { redirect } from "@/utils";
import { getDecorateProducts } from "@/components/modules/useDecorateProducts";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";
import FormatPrice from "@/components/format-price/FormatPrice";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
    shopId?: number;
}

export default function LimitedSpecial({ module, shopId = -1 }: Props) {
    const productCommentEnabled = useConfigStore((s) => s.productCommentEnabled);

    // admin defaultLimitedSpecial 同源 fallback：处理老数据 / 不完整 payload
    const showProductName = useMemo(() => Number(module.showProductName ?? 0) === 1, [module.showProductName]);
    const showPrice = useMemo(() => Number(module.showPrice ?? 1) === 1, [module.showPrice]);
    const showMarketPrice = useMemo(() => Number(module.showMarketPrice ?? 0) === 1, [module.showMarketPrice]);
    const showSales = useMemo(() => Number(module.showSales ?? 0) === 1, [module.showSales]);
    // D1146：装修开了「显示评价数」也要服从全局评价开关
    const showComment = useMemo(() => productCommentEnabled === 1 && Number(module.showComment ?? 0) === 1, [productCommentEnabled, module.showComment]);
    const showBrief = useMemo(() => Number(module.showBrief ?? 0) === 1, [module.showBrief]);
    const buyBtnStyleNum = useMemo(() => Number(module.buyBtnStyle ?? 0), [module.buyBtnStyle]);
    const salesColor = useMemo(() => module.productSalesColor || "#999999", [module.productSalesColor]);
    const briefList = useMemo<string[]>(() => (Array.isArray(module.productBriefList) ? module.productBriefList : []), [module.productBriefList]);

    const containerBgUrl = useMemo(() => {
        const url = module.containerBgImage?.picUrl;
        return url ? imageFormat(url) : "";
    }, [module.containerBgImage]);

    const outerStyle = useMemo(() => {
        const f: any = module.frame || {};
        return [
            `padding-left:${designPxToRpx(f.boxPadding ?? 0)};`,
            `padding-right:${designPxToRpx(f.boxPadding ?? 0)};`,
            `padding-top:${designPxToRpx(f.boxPaddingTop ?? 0)};`,
            `padding-bottom:${designPxToRpx(f.boxPaddingBottom ?? 0)};`,
            f.backgroundColor ? `background-color:${f.backgroundColor};` : ""
        ].join("");
    }, [module.frame]);

    const wrapStyle = useMemo(() => {
        const a = module.boxGradientStart || "#FF9EC4";
        const b = module.boxGradientEnd || "#FF6FA8";
        const r = module.frame?.boxRadius ?? 8;
        const py = designPxToRpx(module.productAreaPaddingY ?? 8);
        return `padding:${py ? `${py} 0` : ""};background-image:linear-gradient(to right, ${a}, ${b});border-radius:${designPxToRpx(r)};`;
    }, [module.boxGradientStart, module.boxGradientEnd, module.frame, module.productAreaPaddingY]);

    const ratioPaddingMap: Record<string, string> = {
        default: "",
        "1:1": "100%",
        "3:4": "133.333%",
        "3:2": "66.667%"
    };
    const ratioPadding = useMemo(() => ratioPaddingMap[module.productPicRatio || "1:1"] || "", [module.productPicRatio]);
    const fillMode = useMemo(() => ((module.productPicFillType || "cover") === "contain" ? "aspectFit" : "aspectFill"), [module.productPicFillType]);

    const trackStyle = useMemo(() => {
        const left = module.productAreaLeft ?? 38;
        return `padding-left:${left}%;`;
    }, [module.productAreaLeft]);

    const moreStyle = useMemo(() => {
        const left = module.productAreaLeft ?? 38;
        return `width:${left}%;`;
    }, [module.productAreaLeft]);

    const itemStyle = useMemo(() => {
        const padding = module.productItemPadding ?? 6;
        const percent = module.productPercent ?? 30;
        const bg = module.cardBgColor || "#FFFFFF";
        const radius = module.cardRadius ?? 8;
        const gap = module.productItemGap ?? 8;
        return [
            `background-color:${bg};`,
            `border-radius:${designPxToRpx(radius)};`,
            `padding:${designPxToRpx(padding)};box-sizing:border-box;`,
            `flex:0 0 ${percent}%;width:${percent}%;`,
            `margin-right:${designPxToRpx(gap)};`
        ].join("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [module.productItemPadding, module.productPercent, module.cardBgColor, module.cardRadius, module.productItemGap]);

    const photoStyle = useMemo(() => (ratioPadding ? `padding-top:${ratioPadding};` : "padding-top:0;"), [ratioPadding]);

    const imgWrapStyle = useMemo(() => {
        const radius = module.productImgRadius ?? 8;
        if (ratioPadding) {
            return `border-radius:${designPxToRpx(radius)};position:absolute;top:0;left:0;width:100%;height:100%;`;
        }
        return `border-radius:${designPxToRpx(radius)};position:static;`;
    }, [module.productImgRadius, ratioPadding]);

    const briefStyle = useMemo(() => {
        const a = module.briefGradientStart || "#FF3B8B";
        const b = module.briefGradientEnd || "#FF7AB0";
        const color = module.briefTextColor || "#FFFFFF";
        return `background-image:linear-gradient(to bottom, ${a}, ${b});color:${color};`;
    }, [module.briefGradientStart, module.briefGradientEnd, module.briefTextColor]);

    const infoStyle = useMemo(() => `text-align:${module.textAlign || "center"};`, [module.textAlign]);
    const nameStyle = useMemo(() => `color:${module.productTitleColor || "#333333"};font-weight:${module.textWeight || 400};`, [module.productTitleColor, module.textWeight]);

    const priceFontStyle = useMemo(() => {
        const size = module.priceFontSize ?? 13;
        return {
            fontSize: designPxToRpx(size),
            fontWeight: module.priceBold === 0 ? 400 : 700,
            color: module.productPriceColor || "#FF3B8B",
            lineHeight: 1
        };
    }, [module.priceFontSize, module.priceBold, module.productPriceColor]);
    const priceCurrencyStyle = useMemo(() => {
        const size = module.priceFontSize ?? 13;
        return {
            fontSize: designPxToRpx(Math.round(size * 0.75)),
            color: module.productPriceColor || "#FF3B8B"
        };
    }, [module.priceFontSize, module.productPriceColor]);
    const marketPriceStyle = useMemo(
        () => ({
            fontSize: "20rpx",
            color: module.productMarketPriceColor || "#999999"
        }),
        [module.productMarketPriceColor]
    );

    const buyBtnStyle = useMemo(() => {
        const a = module.buyBtnGradientStart || "#FF3B8B";
        const b = module.buyBtnGradientEnd || "#FF7AB0";
        const color = module.buyBtnTextColor || "#FFFFFF";
        return `background-image:linear-gradient(to right, ${a}, ${b});color:${color};`;
    }, [module.buyBtnGradientStart, module.buyBtnGradientEnd, module.buyBtnTextColor]);

    const getSales = (item: any) => Number(item.salesVolume ?? item.virtualSales ?? item.salesCount ?? 0);
    const getComment = (item: any) => Number(item.commentCount ?? item.commentNumber ?? 0);
    const marketPriceVisible = (item: any) => Number(item.marketPrice) > Number(item.productPrice);

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
        <View className="module-ad-con module-limited_special" style={outerStyle}>
            <View className="ls-wrap" style={wrapStyle}>
                {containerBgUrl ? <Image className="ls-bg" src={containerBgUrl} mode="aspectFill" /> : null}
                <View
                    className="ls-more"
                    style={moreStyle}
                    onClick={() => {
                        urlFormat(module.moreLink) && redirect({ url: urlFormat(module.moreLink) });
                    }}
                />
                <View className="ls-scroll">
                    <View className="ls-track" style={trackStyle}>
                        {productList.map((item: any, idx: number) => (
                            <View
                                key={(item.productId || 0) + "_" + idx}
                                className="ls-item"
                                style={itemStyle}
                                onClick={() => item.productId && redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })}
                            >
                                <View className="ls-photo" style={photoStyle}>
                                    <View className="ls-img-wrap" style={imgWrapStyle}>
                                        {ratioPadding ? (
                                            <Image className="ls-img ls-img-ratio" mode={fillMode} src={productImage(item)} />
                                        ) : (
                                            <Image className="ls-img ls-img-fluid" mode="widthFix" src={productImage(item)} />
                                        )}
                                    </View>
                                    {showBrief && briefList[idx] ? (
                                        <View className="ls-brief" style={briefStyle}>
                                            {briefList[idx]}
                                        </View>
                                    ) : null}
                                </View>
                                <View className="ls-info" style={infoStyle}>
                                    {showProductName ? (
                                        <View className="ls-name" style={nameStyle}>
                                            <Text>{item.productName}</Text>
                                        </View>
                                    ) : null}
                                    <View className="ls-bottom">
                                        <View className="ls-prices">
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
                                        {showSales || showComment ? (
                                            <View className="ls-extra" style={`color:${salesColor}`}>
                                                {showSales ? (
                                                    <Text>
                                                        {t("已售")}
                                                        {getSales(item)}
                                                    </Text>
                                                ) : null}
                                                {showComment ? (
                                                    <Text>
                                                        {getComment(item)}
                                                        {t("评价")}
                                                    </Text>
                                                ) : null}
                                            </View>
                                        ) : null}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
}

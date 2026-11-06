import { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";

import { designPxToRpx } from "@/components/modules";
import { getDecorateProducts } from "@/components/modules/useDecorateProducts";
import FormatPrice from "@/components/format-price/FormatPrice";
import { urlFormat, productImage } from "@/utils/format";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";
import CommonBuyButton from "@/pages/customPage/modules/commonBuyButton/index";

import "./index.scss";

// admin styleClassMap：style:4 详细列表 → 复用 ad-style__5 大图横排
const styleClassMap: Record<number, string> = { 1: "ad-style__1", 2: "ad-style__2", 3: "ad-style__3", 4: "ad-style__5" };

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
    shopId?: number;
}

export default function ProductA1({ module, shopId = -1 }: Props) {
    // admin defaultProductA1 同源 fallback：处理老数据 / 不完整 payload
    const showName = useMemo(() => Number(module.showName ?? 1) === 1, [module.showName]);
    const showPrice = useMemo(() => Number(module.showPrice ?? 1) === 1, [module.showPrice]);
    const showBrief = useMemo(() => Number(module.showBrief ?? 1) === 1, [module.showBrief]);
    const showProductLabel = useMemo(() => Number(module.showProductLabel ?? 1) === 1, [module.showProductLabel]);
    const showMarketPrice = useMemo(() => Number(module.showMarketPrice ?? 0) === 1, [module.showMarketPrice]);
    const labelBackgroundColor = useMemo(() => module.labelBackgroundColor ?? "#3DC275", [module.labelBackgroundColor]);
    const labelTextColor = useMemo(() => module.labelTextColor ?? "#FFFFFF", [module.labelTextColor]);
    const labelRadius = useMemo(() => Number(module.labelRadius ?? 8), [module.labelRadius]);
    const labelRadiusStyle = useMemo(() => Number(module.labelRadiusStyle ?? 0), [module.labelRadiusStyle]);
    const labelFontSize = useMemo(() => Number(module.labelFontSize ?? 12), [module.labelFontSize]);
    const labelPosition = useMemo(() => module.labelPosition ?? "top-left", [module.labelPosition]);
    const labelOffsetX = useMemo(() => Number(module.labelOffsetX ?? 0), [module.labelOffsetX]);
    const labelOffsetY = useMemo(() => Number(module.labelOffsetY ?? 0), [module.labelOffsetY]);
    const briefBackgroundColor = useMemo(() => module.briefBackgroundColor ?? "#FFF1E6", [module.briefBackgroundColor]);
    const itemGap = useMemo(() => Number(module.itemGap ?? 0), [module.itemGap]);
    const goodsRadius = useMemo(() => Number(module.goodsRadius ?? 0), [module.goodsRadius]);

    // 购买按钮：admin 已从「数字式 buyBtnStyle(1~8)」升级为「对象式 BuyButtonStyleType」并复用 commonBuyButton。
    // 默认值与 admin defaultBuyButtonStyle 同源；历史草稿 buyBtnStyle 曾为数字，非对象时回退默认对象（保持显示购物车图标按钮，与 admin 兜底一致）。
    const defaultBuyBtnStyle = {
        showBtn: 1,
        btnType: 1,
        iconImage: { picUrl: "", picThumb: "" },
        iconSize: 14,
        text: "",
        textColor: "#ffffff",
        textSize: 12,
        iconColor: "#ffffff",
        gradientType: "leftRight",
        gradientColorA: "#333333",
        gradientColorB: "#333333",
        radius: 16,
        paddingTopBottom: 0,
        paddingLeftRight: 10,
        wrap: 0,
        wrapAlign: 2
    };
    const safeBuyBtnStyle = useMemo(() => {
        const b: any = module.buyBtnStyle;
        const base: any = b && typeof b === "object" ? b : defaultBuyBtnStyle;
        // admin「按钮宽度/高度」滑块上限 10、圆角上限 20；老数据/模板可能存在越界值把按钮撑满整行，按 admin 合法区间夹紧
        const clamp = (v: any, max: number, fallback: number) => {
            const n = Number(v);
            return Math.min(Math.max(Number.isFinite(n) ? n : fallback, 0), max);
        };
        return {
            ...base,
            paddingLeftRight: clamp(base.paddingLeftRight, 10, 10),
            paddingTopBottom: clamp(base.paddingTopBottom, 10, 0),
            radius: clamp(base.radius, 20, 16)
        };
    }, [module.buyBtnStyle]);

    // 与 admin 同源：购买按钮显示与否严格按 Number(showBtn) === 1 判定，
    // 必须读 safeBuyBtnStyle，保证历史/数字型 buyBtnStyle 命中默认对象（showBtn=1）时按钮可见，
    // 同时与 buyBtnWrapped、itemBuyStyle 等保持同一数据源
    const showBuyBtn = useMemo(() => Number(safeBuyBtnStyle?.showBtn) === 1, [safeBuyBtnStyle]);

    const tagListSafe = useMemo<string[]>(() => (Array.isArray(module.tagList) ? module.tagList : []), [module.tagList]);
    const briefListSafe = useMemo<string[]>(() => (Array.isArray(module.briefList) ? module.briefList : []), [module.briefList]);
    const briefStyleSafe = useMemo(
        () => module.briefStyle ?? { showTitle: 1, titleColor: "#FF6600", titleFontSize: 11, titleFontBold: 400 },
        [module.briefStyle]
    );

    const allFormat = useMemo(
        () => ({
            backgroundColor: module.backgroundColor ? `background-color: ${module.backgroundColor};` : "",
            boxPadding: `margin-left: ${designPxToRpx(module.boxPadding ?? 0)};margin-right: ${designPxToRpx(module.boxPadding ?? 0)};`,
            boxPaddingBottom: `margin-bottom: ${designPxToRpx(module.boxPaddingBottom ?? 0)};`,
            boxPaddingTop: `margin-top: ${designPxToRpx(module.boxPaddingTop ?? 0)};`,
            boxRadius: `border-radius: ${designPxToRpx(module.boxRadius ?? 0)};`,
            innerPadding: `padding: ${designPxToRpx(module.innerPadding ?? 0)};`,
            goodsPadding: `padding: ${designPxToRpx(module.goodsPadding ?? 0)};`
        }),
        [module]
    );

    const styleClass = useMemo(() => styleClassMap[Number(module.style ?? 1)] || "ad-style__1", [module.style]);
    const styleNum = useMemo(() => Number(module.style ?? 1), [module.style]);
    const isListStyle = useMemo(() => styleNum === 4, [styleNum]);
    // 一行 2 / 一行 3 / 详细列表 都需要锁正方形比例以避免错位
    const photoRatioMode = useMemo(() => styleNum === 2 || styleNum === 3 || styleNum === 4, [styleNum]);

    const itemConRadiusStyle = useMemo(() => {
        const r = goodsRadius;
        return r ? `border-radius:${designPxToRpx(r)};overflow:hidden;` : "";
    }, [goodsRadius]);
    const itemPhotoRadiusStyle = useMemo(() => {
        const r = designPxToRpx(goodsRadius);
        if (!goodsRadius || !r) return "";
        return isListStyle ? `border-radius:${r} 0 0 ${r};overflow:hidden;` : `border-radius:${r} ${r} 0 0;overflow:hidden;`;
    }, [goodsRadius, isListStyle]);
    const itemInfoRadiusStyle = useMemo(() => {
        const r = designPxToRpx(goodsRadius);
        if (!goodsRadius || !r) return "";
        return isListStyle ? `border-radius:0 ${r} ${r} 0;` : `border-radius:0 0 ${r} ${r};`;
    }, [goodsRadius, isListStyle]);

    const labelTagStyle = useMemo(() => {
        const r = labelRadius;
        const mode = labelRadiusStyle;
        const pos = labelPosition;
        const ox = labelOffsetX;
        const oy = labelOffsetY;
        let radiusCss = "";
        if (mode === 0) radiusCss = `border-radius:${designPxToRpx(r)};`;
        else if (mode === 1 && Number.isFinite(r)) radiusCss = `border-radius:${designPxToRpx(r)} 0 0 ${designPxToRpx(r)};`;
        else if (mode === 2 && Number.isFinite(r)) radiusCss = `border-radius:0 ${designPxToRpx(r)} ${designPxToRpx(r)} 0;`;
        else if (mode === 3) radiusCss = `border-top-left-radius:${designPxToRpx(r)};border-bottom-right-radius:${designPxToRpx(r)};`;
        else if (mode === 4) radiusCss = `border-top-right-radius:${designPxToRpx(r)};border-bottom-left-radius:${designPxToRpx(r)};`;
        const posMap: Record<string, string> = {
            "top-left": `left:${designPxToRpx(ox)};top:${designPxToRpx(oy)};right:auto;bottom:auto;`,
            "top-right": `right:${designPxToRpx(ox)};top:${designPxToRpx(oy)};left:auto;bottom:auto;`,
            "bottom-left": `left:${designPxToRpx(ox)};bottom:${designPxToRpx(oy)};right:auto;top:auto;`,
            "bottom-right": `right:${designPxToRpx(ox)};bottom:${designPxToRpx(oy)};left:auto;top:auto;`
        };
        return [
            labelBackgroundColor ? `background-color:${labelBackgroundColor};` : "",
            labelTextColor ? `color:${labelTextColor};` : "",
            radiusCss,
            `font-size:${designPxToRpx(labelFontSize)};`,
            posMap[pos] || posMap["top-left"]
        ].join("");
    }, [labelRadius, labelRadiusStyle, labelPosition, labelOffsetX, labelOffsetY, labelBackgroundColor, labelTextColor, labelFontSize]);

    const itemGapStyle = useMemo(() => {
        const g = itemGap;
        return g > 0 ? `padding:${designPxToRpx(g / 2)};` : "";
    }, [itemGap]);

    const nameAlignStyle = useMemo(() => (Number(module.nameAlign ?? 1) === 2 ? "text-align:center;" : "text-align:left;"), [module.nameAlign]);
    const briefListAlignStyle = useMemo(
        () => (Number(module.nameAlign ?? 1) === 2 ? "justify-content:center;" : "justify-content:flex-start;"),
        [module.nameAlign]
    );

    // 购买按钮换行：开启换行时，按钮独占一行并按 wrapAlign 对齐（与 admin View 同步）
    const buyBtnWrapped = useMemo(() => {
        const b = safeBuyBtnStyle;
        return Number(b?.showBtn) === 1 && Number(b?.wrap) === 1;
    }, [safeBuyBtnStyle]);
    const itemBuyStyle = useMemo(() => {
        if (!buyBtnWrapped) return "";
        const alignMap: Record<number, string> = { 1: "left", 2: "center", 3: "right" };
        const align = alignMap[Number(safeBuyBtnStyle?.wrapAlign ?? 2)] || "center";
        // display:block 覆盖 .item-buy 的 flex，使内部 inline-flex 按钮统一受 text-align 控制
        return `width:100%;max-width:none;display:block;text-align:${align};margin-top:8rpx;`;
    }, [buyBtnWrapped, safeBuyBtnStyle]);

    const priceAlignStyle = useMemo(
        () => (Number(module.priceAlign ?? 1) === 2 ? "justify-content:center;" : "justify-content:flex-start;"),
        [module.priceAlign]
    );
    const actionAlignStyle = useMemo(() => {
        const base = Number(module.priceAlign ?? 1) === 2 ? "justify-content:center;" : "";
        return base + (buyBtnWrapped ? "flex-wrap:wrap;" : "");
    }, [module.priceAlign, buyBtnWrapped]);

    const briefTags = (idx: number | string) => {
        const i = typeof idx === "number" ? idx : Number(idx);
        const raw = briefListSafe[i] || "";
        return raw
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean);
    };
    const briefTagStyle = useMemo(() => {
        const s = briefStyleSafe;
        return [
            s.titleColor ? `color:${s.titleColor};` : "",
            s.titleFontSize ? `font-size:${designPxToRpx(s.titleFontSize)};` : "",
            s.titleFontBold ? `font-weight:${s.titleFontBold};` : "",
            briefBackgroundColor ? `background-color:${briefBackgroundColor};` : ""
        ].join("");
    }, [briefStyleSafe, briefBackgroundColor]);

    const [productList, setProductList] = useState<any[]>([]);
    const _getproductList = async () => {
        try {
            const list = await getDecorateProducts(module.products, {
                shopId: shopId,
                allowEmptyParams: true
            });
            setProductList(list);
        } catch (error) {
            console.log(error);
        }
    };

    // 对应旧 setup 立即调用 + watch(module.products)：初次挂载拉取一次，products 变化时重新拉取
    useEffect(() => {
        void _getproductList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [JSON.stringify(module.products ?? {})]);

    return (
        productList.length > 0 && (
            <View
                className={`module-ad-con module-goods_ad module-product_a1 ${styleClass} ad-goods_style__${module.goodsStyle ?? 1} ad-text_weight__${
                    module.textWeight ?? 1
                } ad-goods_name_row__${module.goodsNameRow ?? 2} ad-goods_name_padding__${module.goodsNamePadding ?? 1}`}
                style={allFormat.boxPadding + allFormat.boxPaddingTop + allFormat.boxPaddingBottom}
            >
                <View className="module-ad-content" style={allFormat.backgroundColor + allFormat.boxRadius + allFormat.innerPadding}>
                    <View className="goods-ad-warp">
                        <View className="goods-ad-con">
                            {productList.map((item: any, idx: number) => (
                                <View key={item.productId} className="goods-ad-item" style={itemGapStyle}>
                                    <View className="item-content">
                                        <View className="item-con" style={itemConRadiusStyle + allFormat.goodsPadding}>
                                            <View className="item-photo" style={itemPhotoRadiusStyle}>
                                                <View className={`item-photo-box ${photoRatioMode ? "is-ratio" : "is-fluid"}`}>
                                                    <View
                                                        className="item-image-a"
                                                        onClick={() => redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })}
                                                    >
                                                        {photoRatioMode ? (
                                                            <Image className="item-image item-image-ratio" mode="aspectFill" src={productImage(item)} />
                                                        ) : (
                                                            <Image className="item-image" mode="widthFix" src={productImage(item)} />
                                                        )}
                                                    </View>
                                                </View>
                                                {showProductLabel && tagListSafe[idx] && (
                                                    <Text className="item-label-tag" style={labelTagStyle}>
                                                        {tagListSafe[idx]}
                                                    </Text>
                                                )}
                                            </View>
                                            <View className="item-info" style={itemInfoRadiusStyle}>
                                                <View className="item-name" style={nameAlignStyle}>
                                                    {showName && (
                                                        <View
                                                            className="item-name-a"
                                                            onClick={() => redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })}
                                                        >
                                                            <Text>{t(item.productName ?? "商品名称")}</Text>
                                                        </View>
                                                    )}
                                                    {showBrief && briefTags(idx).length > 0 && (
                                                        <View className="item-brief-list" style={briefListAlignStyle}>
                                                            {briefTags(idx).map((brief, bi) => (
                                                                <Text key={bi} className="item-brief-tag" style={briefTagStyle}>
                                                                    {brief}
                                                                </Text>
                                                            ))}
                                                        </View>
                                                    )}
                                                </View>
                                                {showPrice && (
                                                    <View className="item-action" style={actionAlignStyle}>
                                                        <View className="item-price" style={priceAlignStyle}>
                                                            <FormatPrice
                                                                fontStyle={{ fontSize: "32rpx" }}
                                                                currencyStyle={{ fontSize: "22rpx", position: "relative", top: "-3rpx" }}
                                                                priceData={item.deliveryMode === 2 ? item.cyclePrice : item.productPrice}
                                                            />
                                                            {/* 划线价只受装修开关控制，不再判断划线价是否为 0 或是否大于售价 */}
                                                            {showMarketPrice && (
                                                                <View className="market_price">
                                                                    <FormatPrice
                                                                        fontStyle={{ fontSize: "22rpx", color: "#999" }}
                                                                        currencyStyle={{ fontSize: "20rpx", color: "#999" }}
                                                                        priceData={item.marketPrice}
                                                                    />
                                                                </View>
                                                            )}
                                                        </View>
                                                        {showBuyBtn && (
                                                            <View
                                                                className="item-buy"
                                                                style={itemBuyStyle}
                                                                onClick={() => redirect({ url: `/pages/product/index?id=${item.productId}` })}
                                                            >
                                                                <CommonBuyButton styleOptions={safeBuyBtnStyle} />
                                                            </View>
                                                        )}
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>
            </View>
        )
    );
}

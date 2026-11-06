import { useEffect, useMemo, useState } from "react";
import { Image, View } from "@tarojs/components";

import { designPxToRpx, formatCommonStyle, gradientMap } from "@/components/modules";
import { urlFormat, productImage } from "@/utils/format";
import { redirect } from "@/utils";
import { getCateProduct } from "@/api/home/home";
import CommonBuyButton from "@/pages/customPage/modules/commonBuyButton/index";
import { useProductStyle } from "@/hooks/useProductStyle";
import { t } from "@/utils/i18n";
import FormatPrice from "@/components/format-price/FormatPrice";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function ProductGrouping({ module }: Props) {
    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle, module.contentStyle);
    }, [module.moduleStyle, module.contentStyle]);

    const groupTitlePadding = useMemo(() => {
        const padding = designPxToRpx(module.groupTitle.marginLeftRight);
        return padding ? `0 ${padding}` : "";
    }, [module.groupTitle]);

    const productImageRadius = useMemo(() => {
        const radius = designPxToRpx(module.cardRadius);
        return radius ? (module.picBottomRadius ? radius : `${radius} ${radius} 0 0`) : "";
    }, [module.cardRadius, module.picBottomRadius]);

    const productInfoPadding = useMemo(() => {
        const color = module.productColor;
        const paddings = [color.infoTopPadding, color.infoLeftRightPadding, color.infoBottomPadding].map(designPxToRpx);
        return paddings.every(Boolean) ? paddings.join(" ") : "";
    }, [module.productColor]);

    const picScaleMap: { [key: string]: string } = {
        "3:2": "calc(100% / 3 * 2)",
        "1:1": "calc(100% / 1 * 1)",
        "3:4": "calc(100% / 3 * 4)",
        "16:9": "calc(100% / 16 * 9)"
    };

    const tablistItemStyle = useMemo(() => {
        return {
            title: `color: ${module.groupTitle.titleColor}; font-size: ${designPxToRpx(module.groupTitle.bigTitleFontSize)};`,
            subTitle: `color: ${module.groupTitle.subTitleColor}; font-size: ${designPxToRpx(module.groupTitle.titleFontSize)};border-radius:${designPxToRpx(
                module.groupTitle.subTitleRadius
            )};`
        };
    }, [module.groupTitle]);

    const buyBtnWrapped = useMemo(() => {
        return Number(module.buyBtnStyle?.showBtn) === 1 && Number(module.buyBtnStyle?.wrap) === 1;
    }, [module.buyBtnStyle]);

    // 换行后按 wrapAlign 对齐：按钮是 goods-price-box（flex）的子项，用 auto margin 实现左/中/右
    const buyBtnWrapMarginStyle = useMemo(() => {
        const align = Number(module.buyBtnStyle?.wrapAlign ?? 2);
        if (align === 1) return "margin: 10rpx auto 0 0";
        if (align === 3) return "margin: 10rpx 0 0 auto";
        return "margin: 10rpx auto 0";
    }, [module.buyBtnStyle]);

    const goodsItemStyle = useMemo(() => {
        let str = `margin: ${designPxToRpx(module.cardMargin / 2)};padding: ${designPxToRpx(module.cardPadding)};border: ${
            module.productCardStyle == 3 ? 1 : 0
        }px solid rgb(238, 238, 238);border-radius: ${designPxToRpx(module.cardRadius)};`;
        if (module.productCardStyle != 4) {
            str += `background-color:${module.productColor.backgroundColor};`;
        }
        if (module.productCardStyle == 2) {
            str += `box-shadow: rgba(93, 113, 127, 0.08) 0 4rpx 16rpx;`;
        }
        return str;
    }, [module]);

    const listStyleNum = useMemo(() => {
        const n = Number(module?.listStyle);
        return Number.isFinite(n) && n > 0 ? n : 1;
    }, [module?.listStyle]);

    const tabList = useMemo(() => {
        return module.productSource === "productGroup" ? module.groupList : module.productGroups;
    }, [module.productSource, module.groupList, module.productGroups]);

    const [currentIndex, setCurrentIndex] = useState(0);
    const [list, setList] = useState<any[]>([]);
    const { styleMap } = useProductStyle(list);

    const activeBannerPic = useMemo<any>(() => {
        const groups = tabList;
        if (!Array.isArray(groups) || groups.length === 0) return null;
        const group = groups[currentIndex];
        const pic = group?.bannerPic;
        return pic && (pic.picThumb || pic.picUrl) ? pic : null;
    }, [tabList, currentIndex]);

    const displayList = useMemo<any[]>(() => {
        if (activeBannerPic) {
            const placeholder = list[0] ?? { productName: "_", productPrice: "0", marketPrice: "0" };
            const bannerItem = {
                __isBanner: true,
                picUrl: activeBannerPic.picUrl || activeBannerPic.picThumb,
                picThumb: activeBannerPic.picThumb || activeBannerPic.picUrl,
                picLink: activeBannerPic.picLink,
                productName: placeholder.productName,
                productPrice: placeholder.productPrice,
                marketPrice: placeholder.marketPrice
            };
            return [bannerItem, ...list];
        }
        return list;
    }, [activeBannerPic, list]);

    const switchTab = (index: number) => {
        setCurrentIndex(index);
    };

    const getGroupProductList = async (currentGroupData: any) => {
        try {
            const result = await getCateProduct(currentGroupData);
            setList(result.records);
        } catch (error) {
            console.error(error);
        }
    };

    // 对应旧 watchEffect：tab 来源/当前 tab 变化时重建查询参数并拉取商品
    useEffect(() => {
        const currentGroupData: any = {};
        if (module.productSource && module.productSource === "productGroup") {
            if (module.groupList.length > 0) {
                const { productGroupId, productNum, productNumType } = module.groupList[currentIndex];
                currentGroupData.productGroupId = productGroupId;
                currentGroupData.size = productNumType === "number" ? productNum : 100;
                void getGroupProductList(currentGroupData);
            }
        } else {
            if (module.productGroups && module.productGroups.length > 0) {
                currentGroupData.ids = module.productGroups[currentIndex].productList.map((item: any) => item.productId).join(",");
                void getGroupProductList(currentGroupData);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [module.productSource, module.groupList, module.productGroups, currentIndex]);

    return (
        <View
            className="module-ad-con"
            style={
                commonStyle.moduleStyle.boxPaddingBottom +
                commonStyle.moduleStyle.boxPaddingTop +
                // 旧模板 boxPaddingBottom 被拼接了两次，按源码原样保留
                commonStyle.moduleStyle.boxPaddingBottom +
                commonStyle.moduleStyle.boxPadding +
                commonStyle.moduleStyle.backgroundSize +
                commonStyle.moduleStyle.backgroundImage
            }
        >
            <View
                className="module-ad-content"
                style={
                    commonStyle.moduleContentStyle.backgroundImage +
                    commonStyle.moduleContentStyle.backgroundSize +
                    commonStyle.moduleContentStyle.boxRadius +
                    commonStyle.moduleContentStyle.boxShadow +
                    commonStyle.moduleContentStyle.innerPadding
                }
            >
                <View className="productgrouping">
                    {(module.groupTitle.showTitle || module.groupTitle.showSubTitle) && (
                        <View className="tablist">
                            {(tabList || []).map((item: any, index: number) => (
                                <View key={index} className="tablist-item" onClick={() => switchTab(Number(index))}>
                                    <View className="tab-text">
                                        <View className="nav-item">
                                            {Number(index) > 0 && <View className="line" style={`border-color:${module.groupTitle.splitLineColor}`} />}
                                            <View className="nav-item-box" style={{ padding: groupTitlePadding }}>
                                                {module.groupTitle.showTitle && (
                                                    <View
                                                        className="tab-title"
                                                        style={
                                                            tablistItemStyle.title +
                                                            `${index === currentIndex ? `color:${module.groupTitle.activeTitleColor};` : ""}`
                                                        }
                                                    >
                                                        {t(item.title)}
                                                    </View>
                                                )}
                                                {item.subTitle && module.groupTitle.showSubTitle && (
                                                    <View
                                                        className="tab-sub"
                                                        style={
                                                            tablistItemStyle.subTitle +
                                                            `${
                                                                index === currentIndex
                                                                    ? `color:${module.groupTitle.activeSubTitleColor};background-image: linear-gradient(${
                                                                          gradientMap[module.groupTitle.subTitleGradientType]
                                                                      }, ${module.groupTitle?.gradientColorA}, ${module.groupTitle.gradientColorB});`
                                                                    : ""
                                                            }`
                                                        }
                                                    >
                                                        {t(item.subTitle)}
                                                    </View>
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}

                    <View className="productlist">
                        <View className="productlist-item">
                            <View className="item-box">
                                {displayList.map((item: any, index: number) => (
                                    <View
                                        key={index}
                                        className="li"
                                        style={`opacity: 1; width: ${listStyleNum < 5 ? 100 / listStyleNum : Number(index) % 3 === 0 ? 100 : 50}%;`}
                                    >
                                        <View
                                            className="goods-item"
                                            style={goodsItemStyle + (item.__isBanner ? "; position: relative;" : "")}
                                            onClick={() => {
                                                if (item.__isBanner) {
                                                    urlFormat(item.picLink) && redirect({ url: urlFormat(item.picLink) });
                                                } else {
                                                    item.productId &&
                                                        redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) });
                                                }
                                            }}
                                        >
                                            {item.__isBanner && (
                                                <View
                                                    className="banner-fill"
                                                    style={`background-image: url(${productImage(item)});
                                                        background-size: ${module.picFillType};
                                                        border-radius: ${designPxToRpx(module.cardRadius)};`}
                                                />
                                            )}
                                            <View className="goods-img" style={`padding-top: ${picScaleMap[module.picScale!]}`}>
                                                {!item.__isBanner && (
                                                    <View
                                                        className="img"
                                                        style={`border-radius: ${productImageRadius};
                                                        background-size: ${module.picFillType};
                                                        background-image: url(${productImage(item)});`}
                                                    />
                                                )}
                                                {!item.__isBanner && styleMap[item.productId]?.borderImage && (
                                                    <Image className="product-style-border" src={styleMap[item.productId].borderImage} mode="scaleToFill" />
                                                )}
                                            </View>
                                            <View
                                                className="goods-info"
                                                style={`text-align: left; padding: ${productInfoPadding}; ${item.__isBanner ? "visibility: hidden;" : ""}`}
                                            >
                                                {module.showProductName && (
                                                    <View
                                                        className="goods-title"
                                                        style={`margin-top: 6rpx;
                                                        height: ${designPxToRpx(module.productNameRow * 18)};
                                                        line-height: 36rpx;
                                                        -webkit-line-clamp: ${module.productNameRow};
                                                        font-weight: ${module.productNameWeight};
                                                        color: ${module.productColor.titleColor};
                                                        font-size:  ${designPxToRpx(module.productNameSize)};`}
                                                    >
                                                        {item.productName}
                                                    </View>
                                                )}
                                                <View
                                                    className="goods-price-box"
                                                    style={`margin-top: ${designPxToRpx(
                                                        module.productPriceMarginTop
                                                    )}; justify-content: left; display: flex; ${buyBtnWrapped ? "flex-wrap: wrap;" : ""}`}
                                                >
                                                    <View className="price-origin-sale" style={`justify-content: left; ${buyBtnWrapped ? "flex-basis: 100%;" : ""}`}>
                                                        <View className="price-origin-icon">
                                                            <View className="price-icon">
                                                                {module.productPricePic && module.productPricePic.picUrl && (
                                                                    <Image className="icon" mode="heightFix" src={module.productPricePic.picUrl} />
                                                                )}
                                                                {module.showProductPrice && (
                                                                    <View className="price">
                                                                        <FormatPrice
                                                                            fontStyle={
                                                                                {
                                                                                    fontSize: designPxToRpx(module.productPriceSize),
                                                                                    color: module.productColor.priceColor,
                                                                                    fontWeight: module.productPriceWeight
                                                                                } as any
                                                                            }
                                                                            currencyStyle={
                                                                                {
                                                                                    fontSize: designPxToRpx(module.productPriceSize - 2),
                                                                                    color: module.productColor.priceColor,
                                                                                    fontWeight: module.productPriceWeight
                                                                                } as any
                                                                            }
                                                                            decimalsStyle={
                                                                                {
                                                                                    fontSize: designPxToRpx(module.productPriceSize - 2),
                                                                                    color: module.productColor.priceColor,
                                                                                    fontWeight: module.productPriceWeight
                                                                                } as any
                                                                            }
                                                                            priceData={item.productPrice}
                                                                        />
                                                                    </View>
                                                                )}
                                                                {module.crossedOutPrice && item.marketPrice && item.marketPrice > 0 && (
                                                                    <View className="origin" style={`color: ${module.productColor.crossedOutPriceColor}`}>
                                                                        <FormatPrice
                                                                            fontStyle={{ fontSize: "24rpx", textDecoration: "line-through" } as any}
                                                                            priceData={item.marketPrice}
                                                                        />
                                                                    </View>
                                                                )}
                                                            </View>
                                                        </View>
                                                    </View>
                                                    {Number(module.buyBtnStyle?.showBtn) === 1 && (
                                                        // 旧模板把 :style 挂在 commonBuyButton 组件上；React 版 CommonBuyButton 不接收 style，包一层 View 保持布局
                                                        <View style={buyBtnWrapped ? buyBtnWrapMarginStyle : "margin-top: 0"}>
                                                            <CommonBuyButton styleOptions={module.buyBtnStyle} />
                                                        </View>
                                                    )}
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                            {module.bottomMoreBtn !== "close" && module.productSource !== "productGroup" && (
                                <View
                                    className="more-box"
                                    onClick={() =>
                                        urlFormat(tabList?.[currentIndex]?.titleLink) && redirect({ url: urlFormat(tabList?.[currentIndex]?.titleLink) })
                                    }
                                >
                                    {module.bottomMoreBtnText && module.bottomMoreBtn === "text" && (
                                        <View
                                            className="more-txt"
                                            style={`margin: 20rpx 6rpx; background-color:${module.productColor.moreBtnBgColor}; border-color:${module.productColor.moreBtnBorderColor}; color: ${module.productColor.moreBtnTextColor}`}
                                        >
                                            {t(module.bottomMoreBtnText)}
                                        </View>
                                    )}
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

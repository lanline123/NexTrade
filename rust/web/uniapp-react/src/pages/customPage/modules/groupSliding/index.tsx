import { useEffect, useMemo, useState } from "react";
import { Image, View } from "@tarojs/components";

import { designPxToRpx, formatCommonStyle } from "@/components/modules";
import { urlFormat, imageFormat, productImage } from "@/utils/format";
import { redirect, trim } from "@/utils";
import { getProductsList } from "@/api/common";
import CommonBuyButton from "@/pages/customPage/modules/commonBuyButton/index";
import { isShowB2bPriceText } from "@/utils/b2bPrice";
import FormatPrice from "@/components/format-price/FormatPrice";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function GroupSliding({ module }: Props) {
    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    }, [module.moduleStyle, module.contentStyle, module.subTitle]);

    const productImageRadius = useMemo(() => {
        const radius = designPxToRpx(module.productPicRadius);
        return radius ? (module.productPicRightRadius ? radius : `${radius} 0 0 ${radius}`) : "";
    }, [module.productPicRadius, module.productPicRightRadius]);

    // 旧 computed 一次性读取（非响应式依赖），React 侧挂载时求值一次
    const showB2bText = useMemo(() => isShowB2bPriceText(), []);

    const rankingImgs = [
        "https://oss.tigshop.com/img/gallery/202411/1732094008g4ZMmuQbNcBlYrNCuz.png",
        "https://oss.tigshop.com/img/gallery/202411/1732094013OJOLUek96BizcTvwmU.png",
        "https://oss.tigshop.com/img/gallery/202411/17320940168dzp9YD5LbpcMMjqe9.png"
    ];

    const formatLabel = (label: string) => {
        return label.split("\n");
    };

    // 旧 ref({}) 按分组下标写入（Vue proxy 自动响应）；React 侧以 state + 展开写入触发渲染
    const [productGroupsList, setProductGroupsList] = useState<Record<number, any[]>>({});
    const getProductsListData = () => {
        if (module.groupList && module.groupList.length > 0) {
            module.groupList.forEach(async (group: any, index: number) => {
                if (group.productList && group.productList.length > 0) {
                    try {
                        const ids = group.productList.map((item: any) => item.productId);
                        const result = await getProductsList({ ids: ids.join(","), size: ids.length });
                        setProductGroupsList((prev) => ({ ...prev, [index]: result.records }));
                    } catch (error) {
                        console.error(error);
                    }
                }
            });
        }
    };

    // 旧版在 setup 阶段直接调用（非 onMounted）；React 侧以挂载 effect 等价
    useEffect(() => {
        getProductsListData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View
            className="module-ad-con"
            style={
                commonStyle.moduleStyle.boxPaddingBottom +
                commonStyle.moduleStyle.boxPaddingTop +
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
                <View>
                    <View className="groupsliding">
                        {module.groupList.map((group: any, index: number) => (
                            <View
                                key={index}
                                className="slide-box"
                                style={`background-color: ${group.backgroundColor}; border-radius: ${designPxToRpx(module.groupRadius)};width: ${module.groupWidth}%;flex-shrink: 0;`}
                            >
                                <View
                                    className="bg_title"
                                    onClick={() => urlFormat(group.titleLink) && redirect({ url: urlFormat(group.titleLink) })}
                                >
                                    <View className="title_box">
                                        <Image className="img" mode="heightFix" src={imageFormat(module.moduleColor.titlePic?.picUrl)} />
                                        <View
                                            className="p line1"
                                            style={`color: ${module.moduleColor.titleColor}; font-size: ${designPxToRpx(module.moduleColor.titleSize)}`}
                                        >
                                            {t(group.title)}
                                        </View>
                                    </View>
                                    <View
                                        className="p line1"
                                        style={`color: ${module.moduleColor.subTitleColor}; font-size: ${designPxToRpx(module.moduleColor.subTitleSize)}`}
                                    >
                                        {t(group.subTitle)}
                                    </View>
                                </View>
                                <View
                                    className="item-box"
                                    style={`border-radius: ${designPxToRpx(module.groupRadius)}; background:${module.moduleColor.productBackgroundColor}`}
                                >
                                    {(productGroupsList[index] || []).map((item: any, itemIndex: number) => (
                                        <View
                                            key={itemIndex}
                                            className="li"
                                            onClick={() =>
                                                item.productId && redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })
                                            }
                                        >
                                            <View className="goods-item" style={`display: flex; border-radius: ${productImageRadius}`}>
                                                <View
                                                    className="goods-img"
                                                    style={`flex-shrink: 0; width: ${module.productPicRatio}%; padding-top: ${module.productPicRatio}%`}
                                                >
                                                    <View
                                                        className="img"
                                                        style={`border-radius: ${productImageRadius};
                                                    background-size: cover;
                                                    background-image: url(${productImage(item)});`}
                                                    />
                                                    {itemIndex <= 2 && module.showRanking && (
                                                        <Image mode="widthFix" className="ranking" src={rankingImgs[itemIndex]} />
                                                    )}
                                                </View>
                                                <View className="goods-info" style={`justify-content: center; padding: 0 0 0 20rpx`}>
                                                    {module.showProductName && (
                                                        <View
                                                            className="goods-title"
                                                            style={`margin-top: 0;
                                                        height: ${designPxToRpx(module.productNameRow * 18)};
                                                        line-height: 36rpx;
                                                        -webkit-line-clamp: ${module.productNameRow};
                                                        font-weight: ${module.productNameWeight};
                                                        color: rgb(51, 51, 51);
                                                        font-size: ${designPxToRpx(module.productNameSize)};`}
                                                        >
                                                            {t(item.productName)}
                                                        </View>
                                                    )}
                                                    {module.showProductLabel && formatLabel(group.label)[itemIndex] && (
                                                        <View className="tag">
                                                            <View
                                                                className="span line1"
                                                                style={`background-color: ${module.moduleColor.labelBackgroundColor};color: ${module.moduleColor.labelTextColor};`}
                                                            >
                                                                {t(trim(formatLabel(group.label)[itemIndex]))}
                                                            </View>
                                                        </View>
                                                    )}
                                                    <View
                                                        className="goods-price-box"
                                                        style={`margin-top: ${designPxToRpx(module.productPriceMarginTop)}`}
                                                    >
                                                        <View className="price-origin-sale">
                                                            <View className="price-origin-icon">
                                                                <View className="price-icon">
                                                                    {module.showProductPrice && (
                                                                        <View
                                                                            className="price"
                                                                            style={`color: ${module.moduleColor.productPriceColor}; font-weight: 700; font-family: font1`}
                                                                        >
                                                                            <FormatPrice
                                                                                fontStyle={{ fontSize: "28rpx" }}
                                                                                currencyStyle={{
                                                                                    fontSize: "22rpx"
                                                                                }}
                                                                                decimalsStyle={{
                                                                                    fontSize: "23rpx"
                                                                                }}
                                                                                priceData={item.productPrice}
                                                                            />
                                                                        </View>
                                                                    )}
                                                                </View>
                                                                {module.crossedOutPrice &&
                                                                    item.marketPrice &&
                                                                    Number(item.marketPrice) > 0 &&
                                                                    !showB2bText && (
                                                                        <View
                                                                            className="origin"
                                                                            style={`color: ${module.moduleColor.crossedOutPriceColor}`}
                                                                        >
                                                                            <FormatPrice
                                                                                fontStyle={{ fontSize: "22rpx", textDecoration: "line-through" }}
                                                                                priceData={item.marketPrice}
                                                                            />
                                                                        </View>
                                                                    )}
                                                            </View>
                                                        </View>
                                                        {/* 旧 commonBuyButton 无点击跳转，纯样式按钮 */}
                                                        {module.buyBtnStyle && Number(module.buyBtnStyle.showBtn) === 1 && (
                                                            <CommonBuyButton styleOptions={module.buyBtnStyle} />
                                                        )}
                                                    </View>
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
}

import { useEffect, useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";

import { designPxToRpx, formatCommonStyle } from "@/components/modules";
import { urlFormat, productImage } from "@/utils/format";
import CommonCountdown from "@/pages/customPage/modules/commonCountdown/index";
import { useProductStyle } from "@/hooks/useProductStyle";
import { redirect } from "@/utils";
import { getProductsList } from "@/api/common";
import { t } from "@/utils/i18n";
import FormatPrice from "@/components/format-price/FormatPrice";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function SpecialOffer({ module }: Props) {
    const [list, setList] = useState<any[]>([]);
    const { styleMap } = useProductStyle(list);

    const getItemStyle = (item: any) => {
        const id = item?.productId ?? item?.id;
        return id != null ? (styleMap as Record<string, any>)[id as unknown as number] ?? null : null;
    };

    const getProductsListData = async () => {
        if (module.productSource) {
            const params: any = {};
            if (module.productSource === "products") {
                const ids = module.productList.map((item: any) => item.productId);
                params.ids = ids.join(",");
                params.size = ids.length;
            } else {
                const { productGroupId, productNum, productNumType } = module.productGroups[0];
                params.productGroupId = productGroupId;
                params.size = productNumType === "number" ? productNum : 100;
            }
            try {
                const result = await getProductsList(params);
                setList(result.records);
            } catch (error) {
                console.error(error);
            }
        }
    };

    // 对应旧 setup 立即调用（旧版无 watch，仅挂载时拉一次）
    useEffect(() => {
        void getProductsListData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    }, [module.moduleStyle, module.contentStyle, module.subTitle]);

    const picScaleMap: { [key: string]: string } = {
        "3:2": "calc(100% / 3 * 2)",
        "1:1": "calc(100% / 1 * 1)",
        "3:4": "calc(100% / 3 * 4)",
        "16:9": "calc(100% / 16 * 9)"
    };

    const moduleThemeGradient: Record<string, { gradientColorA: string; gradientColorB: string }> = {
        orange: { gradientColorA: "#ff3e02", gradientColorB: "#ff7b19" },
        red: { gradientColorA: "#ff1513", gradientColorB: "#ff856c" },
        blue: { gradientColorA: "#4499e6", gradientColorB: "#7faff5" },
        green: { gradientColorA: "#59c12d", gradientColorB: "#64d135" },
        purple: { gradientColorA: "#7649d7", gradientColorB: "#8456e3" },
        grey: { gradientColorA: "#373737", gradientColorB: "#6d6d6d" },
        chocolate: { gradientColorA: "#4e362e", gradientColorB: "#603929" },
        brown: { gradientColorA: "#a67e5a", gradientColorB: "#c19270" }
    };
    const topRightType = useMemo(() => module.moduleTitle?.topRightType ?? "countdown", [module.moduleTitle]);
    // 每日循环：按今天的开始时分秒判断是否已开始
    const isCountdownStarted = useMemo(() => {
        const dailyTime = module.moduleTitle?.dailyTime;
        if (!Array.isArray(dailyTime) || dailyTime.length < 1) return true;
        const start = new Date(Number(dailyTime[0]));
        const todayStart = new Date().setHours(start.getHours(), start.getMinutes(), start.getSeconds(), 0);
        return Date.now() >= todayStart;
    }, [module.moduleTitle]);
    const buttonGradient = useMemo(() => {
        const theme = moduleThemeGradient[module.moduleColorStyle || "orange"];
        const userA = module.moduleColor?.buttonGradientColorA;
        const userB = module.moduleColor?.buttonGradientColorB;
        return {
            a: userA || theme?.gradientColorA || "#ff3e02",
            b: userB || theme?.gradientColorB || "#ff7b19"
        };
    }, [module.moduleColorStyle, module.moduleColor]);

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
                className="module-ad-content main"
                style={
                    commonStyle.moduleContentStyle.backgroundImage +
                    commonStyle.moduleContentStyle.backgroundSize +
                    commonStyle.moduleContentStyle.boxRadius +
                    commonStyle.moduleContentStyle.boxShadow +
                    commonStyle.moduleContentStyle.innerPadding +
                    `border-radius: ${designPxToRpx(module.contentStyle.boxRadius)}`
                }
            >
                <View className="main">
                    <View className="mk-top">
                        <View className="line1" style={`color: ${module.moduleColor.titleColor}`}>
                            <Text className="mk-title" style={`color: ${module.moduleColor.titleColor}`}>
                                {t(module.moduleTitle.title)}
                            </Text>
                            <Text className="mk-small-title" style={`color: ${module.moduleColor.subTitleColor}`}>
                                {t(module.moduleTitle.subTitle)}
                            </Text>
                        </View>
                        {topRightType === "countdown" ? (
                            <View className="mk-countdown" style={`--color: ${module.moduleColor.countdownColor}`}>
                                <Text className="text line1" style={`color: ${module.moduleColor.countdownTitleColor}`}>
                                    {isCountdownStarted ? t(module.moduleTitle.countdownTitle) : t("距开始")}
                                </Text>
                                <View className="countdown">
                                    <CommonCountdown
                                        format="HH:mm:ss"
                                        countdownType={module.moduleTitle.countdownType}
                                        dailyTime={module.moduleTitle.dailyTime}
                                        specifyTime={module.moduleTitle.specifyTime}
                                        color={module.moduleColor.countdownColor}
                                    />
                                </View>
                            </View>
                        ) : (
                            <View
                                className="mk-action-btn"
                                style={`background: linear-gradient(90deg, ${buttonGradient.a} 0%, ${buttonGradient.b} 100%); color: ${module.moduleColor.buttonTextColor || "#ffffff"};`}
                                onClick={() => {
                                    urlFormat(module.moduleTitle.buttonLink) && redirect({ url: urlFormat(module.moduleTitle.buttonLink) });
                                }}
                            >
                                <Text className="text">{module.moduleTitle.buttonText || t("立即抢购")}</Text>
                                <Text className="iconfont-h5 icon-youjiantou" />
                            </View>
                        )}
                    </View>
                    <View className="lists" style={`border-radius: ${designPxToRpx(module.contentStyle.boxRadius)}`}>
                        <View className="item-box">
                            {list.map((item: any, index: number) => (
                                <View
                                    key={index}
                                    style={`width: ${module.productWidth}%; flex-wrap: nowrap; flex-shrink: 0`}
                                    onClick={() => item.productId && redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })}
                                >
                                    <View className="item">
                                        <View className="item-img-wrap" style={`border-radius: ${designPxToRpx(module.productRadius)}; overflow: hidden;`}>
                                            <View
                                                className="img"
                                                style={`width: 100%;
                                    padding-top: ${picScaleMap[module.picScale]};
                                    background-size: ${module.picFillType};
                                    border-radius: ${designPxToRpx(module.productRadius)};
                                    background-image: url(${productImage(item)});`}
                                            />
                                            {getItemStyle(item)?.borderImage ? (
                                                <Image className="product-style-border" src={getItemStyle(item)!.borderImage} mode="scaleToFill" />
                                            ) : null}
                                        </View>
                                        <View className="goods-info">
                                            {module.showProductName && (module.showProdcutTitles ?? 1) ? (
                                                <View
                                                    className="tit line1"
                                                    style={`padding-bottom: 0; font-size: ${designPxToRpx(module.productNameSize)}; font-weight: ${module.productNameWeight}; color:${module.moduleColor.productNameColor}`}
                                                >
                                                    {t(module.prodcutTitles[Number(index)][`title${Number(index) + 1}`])}
                                                </View>
                                            ) : null}
                                            {module.showProductPrice ? (
                                                <View className="price-box" style={`color: rgb(255, 255, 255); font-weight: 700; font-family: inherit`}>
                                                    <View className="price">
                                                        <FormatPrice
                                                            fontStyle={{ fontSize: "28rpx", lineHeight: 1 } as any}
                                                            currencyStyle={{ fontSize: "24rpx" } as any}
                                                            decimalsStyle={{ fontSize: "24rpx" } as any}
                                                            priceData={item.productPrice}
                                                        />
                                                    </View>
                                                </View>
                                            ) : null}
                                            {module.showSellingPoints && (module.showProdcutTitles ?? 1) ? (
                                                <View className="desc line1" style={`color: ${module.moduleColor.sellingPointsColor}`}>
                                                    {t(module.prodcutTitles[Number(index)][`sellingPoints${Number(index) + 1}`])}
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
        </View>
    );
}

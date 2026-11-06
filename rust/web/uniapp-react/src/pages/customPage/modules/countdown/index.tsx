import { useEffect, useMemo, useState } from "react";
import { Image, View } from "@tarojs/components";

import { designPxToRpx, formatCommonStyle } from "@/components/modules";
import { urlFormat, imageFormat, productImage } from "@/utils/format";
import { redirect } from "@/utils";
import CommonCountdown from "@/pages/customPage/modules/commonCountdown/index";
import { getProductsList } from "@/api/common";
import { isShowB2bPriceText } from "@/utils/b2bPrice";
import FormatPrice from "@/components/format-price/FormatPrice";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

const picScaleMap: { [key: string]: string } = {
    "3:2": "calc(100% / 3 * 2)",
    "1:1": "calc(100% / 1 * 1)",
    "3:4": "calc(100% / 3 * 4)",
    "16:9": "calc(100% / 16 * 9)"
};

const formtMap: { [key: string]: string } = {
    天: "DD",
    时: "HH",
    分: "mm",
    秒: "ss"
};

export default function Countdown({ module }: Props) {
    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    }, [module.moduleStyle, module.contentStyle, module.subTitle]);

    const productImageRadius = useMemo(() => {
        const radius = designPxToRpx(module.productRadius);
        return radius ? (module.picBottomRadius === 1 ? `${radius} ${radius} 0 0` : radius) : "";
    }, [module.productRadius, module.picBottomRadius]);

    // 旧 computed 一次性读取（非响应式依赖），React 侧挂载时求值一次
    const showB2bText = useMemo(() => isShowB2bPriceText(), []);

    const formtText = useMemo(() => {
        let str = "";
        if (module.countdownData.timeContent && module.countdownData.timeContent.length > 0) {
            for (let index = 0; index < module.countdownData.timeContent.length; index++) {
                const element = module.countdownData.timeContent[index];
                if (element) {
                    str += formtMap[element];
                    if (index < module.countdownData.timeContent.length - 1) {
                        str += ":";
                    }
                }
            }
        }
        return str;
    }, [module.countdownData?.timeContent]);

    const [list, setList] = useState<any[]>([]);
    const getProductsListData = async () => {
        try {
            const ids = module.pruductList.map((item: any) => item.productId);
            const result = await getProductsList({ ids: ids.join(","), size: ids.length });
            setList(result.records);
        } catch (error) {
            console.error(error);
        }
    };

    // 旧版在 setup 阶段直接调用（非 onMounted）；React 侧以挂载 effect 等价
    useEffect(() => {
        if (module.pruductList && module.pruductList.length > 0) {
            void getProductsListData();
        }
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
                    commonStyle.moduleContentStyle.boxRadius2 +
                    commonStyle.moduleContentStyle.boxShadow +
                    commonStyle.moduleContentStyle.innerPadding
                }
            >
                <View className="countdow-warp">
                    <View className="mk-top">
                        <View className="mk-top-left">
                            <View className="mk-title line1" style={`color: ${module.moduleColor.titleColor}`}>
                                {t(module.moduleTitle.title)}
                            </View>
                            <View className="mk-stitle line1" style={`color: ${module.moduleColor.subTitleColor}`}>
                                {t(module.moduleTitle.subTitle)}
                            </View>
                        </View>
                        <View className="">
                            <View className="mk-notice" style={`color: ${module.moduleColor.tipsColor}`}>
                                {t(module.moduleTitle.moreText)}
                            </View>
                        </View>
                    </View>
                    <View className="itemBox">
                        {list.map((item: any) => (
                            <View
                                key={item.productId}
                                className="li"
                                style={`flex: 0 0 ${100 / module.rowNum}%`}
                                onClick={() => item.productId && redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })}
                            >
                                <View
                                    className="item"
                                    style={`padding: ${designPxToRpx(module.productPadding)}; background-color: ${module.moduleColor.productBackgroundColor}; border-radius: ${designPxToRpx(module.productRadius)}`}
                                >
                                    <View className="imgBox" style={`padding-top: ${picScaleMap[module.picScale!]}`}>
                                        <View
                                            className="img"
                                            style={` border-radius: ${productImageRadius};
                                            background-size: ${module.picFillType};
                                            background-image: url(${productImage(item)});`}
                                        />
                                    </View>
                                    <View className="goods-info" style={`padding-bottom: 0; text-align: ${module.textAlignment}`}>
                                        {module.showProductName && (
                                            <View className="title line2" style={`color: ${module.moduleColor.productNameColor}`}>
                                                {item.productName ? t(item.productName) : t("商品名称")}
                                            </View>
                                        )}
                                        {module.showProductPrice && (
                                            <View className="priceBox" style={`justify-content: ${module.textAlignment}`}>
                                                <View
                                                    className="price"
                                                    style={`color: ${module.moduleColor.productPriceColor}; font-weight: ${module.priceWeight}; font-family: inherit`}
                                                >
                                                    <FormatPrice fontStyle={{ fontSize: "22rpx" }} priceData={item.price} />
                                                </View>
                                                {module.crossedOutPrice && item.marketPrice && item.marketPrice > 0 && !showB2bText && (
                                                    <View className="origin" style={`color: ${module.moduleColor.crossedOutPriceColor}`}>
                                                        <FormatPrice
                                                            fontStyle={{ fontSize: "20rpx", textDecoration: "line-through" }}
                                                            priceData={item.marketPrice}
                                                        />
                                                    </View>
                                                )}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
                {module.countdownData.showCountdown && (
                    <View
                        className="countdown"
                        style={`margin-top: -${designPxToRpx(module.countdownData.countdownPicBottom)}; border-radius: 0 0 12rpx 12rpx`}
                    >
                        <Image
                            className="countdown-img"
                            mode="widthFix"
                            src={imageFormat(module.countdownData.countdownBackgroundPic?.picUrl)}
                        />
                        <View className="count-down" style={`top: ${module.countdownData.marginTop}%;`}>
                            <CommonCountdown
                                countdownType={module.countdownData.countdownType}
                                format={formtText}
                                dailyTime={module.countdownData.dailyTime}
                                specifyTime={module.countdownData.specifyTime}
                                color={module.moduleColor.countdownColor}
                                zh={true}
                                timeStyle={{ fontSize: "32rpx", fontWeight: "700" }}
                                unitStyle={{ fontSize: "24rpx", fontWeight: "400", padding: "6rpx" }}
                            />
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { Swiper, SwiperItem, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToDevicePx, designPxToRpx, formatCommonStyle } from "@/components/modules";
import { urlFormat, imageFormat, productImage } from "@/utils/format";
import CommonCountdown from "@/pages/customPage/modules/commonCountdown/index";
import { redirect, getElementRect, getImageInfo } from "@/utils";
import { getProductsList } from "@/api/common";
import { isShowB2bPriceText } from "@/utils/b2bPrice";
import { t } from "@/utils/i18n";
import FormatPrice from "@/components/format-price/FormatPrice";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function MixedProductDisplay({ module }: Props) {
    // React 版用组件根节点 ref 替代 Vue getCurrentInstance()，供选择器查询圈定范围
    const rootRef = useRef<any>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [productGroupsList, setProductGroupsList] = useState<Record<number, any[]>>({});
    const getProductGroupsList = async () => {
        const promises = module.productGroups.map(async (group: any, index: number) => {
            try {
                const ids = group.pruductList.map((item: any) => item.productId);
                const result = await getProductsList({ ids: ids.join(","), size: ids.length });
                return { index, data: result.records };
            } catch (error) {
                console.error(`Error fetching product group ${index}:`, error);
                return { index, data: [] };
            }
        });

        const results = await Promise.all(promises);
        const next: Record<number, any[]> = {};
        results.forEach(({ index, data }) => {
            next[index] = data;
        });
        setProductGroupsList(next);
        setIsLoading(false);
    };

    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    }, [module.moduleStyle, module.contentStyle, module.subTitle]);

    const showB2bText = useMemo(() => isShowB2bPriceText(), []);

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
        秒: "ss",
        毫秒: "SSS"
    };
    const formtText = useMemo(() => {
        let str = "";
        if (module.timeContent && module.timeContent.length > 0) {
            for (let index = 0; index < module.timeContent.length; index++) {
                const element = module.timeContent[index];
                if (element) {
                    str += formtMap[element];
                    if (index < module.timeContent.length - 1) {
                        str += ":";
                    }
                }
            }
        }
        return str;
    }, [module.timeContent]);

    const [imgHeight, setImgHeight] = useState(0);
    const [windowWidth, setWindowWidth] = useState(Taro.getSystemInfoSync().windowWidth);
    const height = useMemo(() => {
        let num = imgHeight;
        if (module.showProductPrice) {
            num += designPxToDevicePx(31, windowWidth);
        }
        if (module.crossedOutPrice) {
            num += designPxToDevicePx(30, windowWidth);
        }
        return num;
    }, [imgHeight, windowWidth, module.showProductPrice, module.crossedOutPrice]);

    const getImgHeight = async () => {
        try {
            const res = await getElementRect(".goods-img", rootRef.current);
            if (res) {
                setImgHeight(res.height);
            }
        } catch (error) {
            console.error(error);
        }
    };

    // Vue reactive rightPicInfo → state（width 进模板）+ ref（height 仅赋值未读）
    const [rightPicWidth, setRightPicWidth] = useState(0);
    const rightPicHeightRef = useRef(20);
    const getRightPicInfo = async () => {
        try {
            const res = await getImageInfo(imageFormat(module.rightPic.picUrl));
            setRightPicWidth((res.width / res.height) * 20);
            rightPicHeightRef.current = 20;
        } catch (error) {
            console.error(error);
        }
    };

    // 对应旧 uni.onWindowResize / onUnmounted offWindowResize（nextTick → setTimeout 0）
    useEffect(() => {
        const windowResizeCallback = () => {
            setWindowWidth(Taro.getSystemInfoSync().windowWidth);
            if (module.productGroups.length > 0) {
                setTimeout(() => {
                    void getImgHeight();
                }, 0);
            }
            if (module.rightPic) {
                void getRightPicInfo();
            }
        };
        Taro.onWindowResize(windowResizeCallback);
        return () => {
            Taro.offWindowResize(windowResizeCallback);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 对应旧 onMounted
    useEffect(() => {
        if (module.productGroups.length > 0) {
            void getProductGroupsList();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 对应旧 watchEffect：rightPic 变化重取尺寸；列表加载完成后延迟 350ms 量图高
    useEffect(() => {
        if (module.rightPic) {
            void getRightPicInfo();
        }
        if (!isLoading) {
            const timer = setTimeout(() => {
                void getImgHeight();
            }, 350);
            return () => {
                clearTimeout(timer);
            };
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [module.rightPic, isLoading]);

    return (
        <View
            ref={rootRef}
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
                    commonStyle.moduleContentStyle.boxRadius2 +
                    commonStyle.moduleContentStyle.boxShadow +
                    commonStyle.moduleContentStyle.innerPadding
                }
            >
                <View className="comp">
                    <View className="cont">
                        <View
                            onClick={() => {
                                urlFormat(module.productGroups[0].moreLink) && redirect({ url: urlFormat(module.productGroups[0].moreLink) });
                            }}
                        >
                            <View className="mk-title" style={`color:${module.moduleColor.titleColor}`}>
                                <Text className="line1">{t(module.productGroups[0].groupTitle)}</Text>
                                {module.showCountdown && (
                                    <View className="time" style={`background:${module.moduleColor.countdownBackgroundColor}; color:${module.moduleColor.countdownColor}`}>
                                        {new Date().getTime() > Number(module.dailyTime[0]) ? (
                                            <CommonCountdown
                                                countdownType={module.countdownType}
                                                format={formtText}
                                                dailyTime={module.dailyTime}
                                                specifyTime={module.specifyTime}
                                                color={module.moduleColor.countdownColor}
                                            />
                                        ) : (
                                            t("活动未开始")
                                        )}
                                    </View>
                                )}
                            </View>
                            <View className="mk-stitle line1" style={`color:${module.moduleColor.sellingPointColor}`}>
                                {t(module.productGroups[0].groupSubTitle)}
                            </View>
                        </View>
                        <View className="item-box">
                            {/* 旧 tig-swiper（:display-multiple-items="2"）等价展开：circular 固定 true、autoplay=false、dot=false */}
                            {/* TODO(MIGRATION)：H5 端 Taro Swiper 对 displayMultipleItems 支持有限，小程序端原生支持；如 H5 显示异常需参照 productCarousel 用 previous/next-margin 重写 */}
                            <Swiper displayMultipleItems={2} style={{ height: height + "px" }} circular indicatorDots={false} autoplay={false} duration={500}>
                                {(productGroupsList[0] || []).map((item: any, key: number) => (
                                    <SwiperItem key={key}>
                                        <View
                                            className="item"
                                            onClick={() => item.productId && redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })}
                                        >
                                            <View className="goods-img" style={`padding-top: ${picScaleMap[module.picScale!]}; border-radius: ${designPxToRpx(module.productRadius)}`}>
                                                <View
                                                    className="img"
                                                    style={`padding-top: ${picScaleMap[module.picScale!]};
                                                border-radius: ${designPxToRpx(module.productRadius)};
                                                background-size: ${module.picFillType};
                                                background-image: url(${productImage(item)});`}
                                                />
                                            </View>
                                            {module.showProductPrice && (
                                                <View className="price-box">
                                                    <View
                                                        className="price"
                                                        style={`background: ${module.moduleColor.priceBackgroundColor}; color: ${module.moduleColor.priceColor}; font-weight: 700; font-family: font1`}
                                                    >
                                                        <FormatPrice
                                                            fontStyle={{ fontSize: "28rpx", lineHeight: 1 } as any}
                                                            currencyStyle={{ fontSize: "24rpx" } as any}
                                                            decimalsStyle={{ fontSize: "24rpx" } as any}
                                                            priceData={item.productPrice}
                                                        />
                                                    </View>
                                                </View>
                                            )}
                                            {module.crossedOutPrice && item.marketPrice && item.marketPrice > 0 && !showB2bText && (
                                                <View className="origin">
                                                    <View style={`color: ${module.moduleColor.crossedOutPriceColor};text-decoration: line-through;`}>
                                                        <FormatPrice fontStyle={{ fontSize: "24rpx", textDecoration: "line-through" } as any} priceData={item.marketPrice} />
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    </SwiperItem>
                                ))}
                            </Swiper>
                        </View>
                    </View>
                    <View className="line-box">
                        <View className="line" style={`background:${module.moduleColor.lineColor}`} />
                    </View>
                    <View className="cont">
                        <View
                            onClick={() => {
                                urlFormat(module.productGroups[1].moreLink) && redirect({ url: urlFormat(module.productGroups[1].moreLink) });
                            }}
                        >
                            <View className="mk-title line1" style={`color:${module.moduleColor.titleColor}`}>
                                <Text className="line1">{t(module.productGroups[1].groupTitle)}</Text>
                                <View
                                    style={`margin-left: 4rpx; width: ${designPxToRpx(rightPicWidth)}; height: 40rpx; background: url(${imageFormat(
                                        module.rightPic?.picUrl
                                    )}) center top / cover no-repeat;`}
                                />
                            </View>
                            <View className="mk-stitle line1" style={`color:${module.moduleColor.sellingPointColor}`}>
                                {t(module.productGroups[1].groupSubTitle)}
                            </View>
                        </View>
                        <View className="item-box">
                            <Swiper displayMultipleItems={2} style={{ height: height + "px" }} circular indicatorDots={false} autoplay={false} duration={500}>
                                {(productGroupsList[1] || []).map((item: any, key: number) => (
                                    <SwiperItem key={key}>
                                        <View
                                            className="item"
                                            onClick={() => item.productId && redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })}
                                        >
                                            <View className="goods-img" style={`padding-top: ${picScaleMap[module.picScale!]}; border-radius: ${designPxToRpx(module.productRadius)}`}>
                                                <View
                                                    className="img"
                                                    style={`padding-top: ${picScaleMap[module.picScale!]};
                                                border-radius: ${designPxToRpx(module.productRadius)};
                                                background-size: ${module.picFillType};
                                                background-image: url(${productImage(item)});`}
                                                />
                                            </View>
                                            {module.showProductPrice && (
                                                <View className="price-box">
                                                    <View
                                                        className="price"
                                                        style={`background: ${module.moduleColor.priceBackgroundColor}; color: ${module.moduleColor.priceColor}; font-weight: 700; font-family: font1`}
                                                    >
                                                        <FormatPrice
                                                            fontStyle={{ fontSize: "28rpx", lineHeight: 1 } as any}
                                                            currencyStyle={{ fontSize: "24rpx" } as any}
                                                            decimalsStyle={{ fontSize: "24rpx" } as any}
                                                            priceData={item.productPrice}
                                                        />
                                                    </View>
                                                </View>
                                            )}
                                            {item.marketPrice && module.crossedOutPrice && !showB2bText && (
                                                <View className="origin">
                                                    <View style={`color: ${module.moduleColor.crossedOutPriceColor};text-decoration: line-through;`}>
                                                        <FormatPrice fontStyle={{ fontSize: "24rpx", textDecoration: "line-through" } as any} priceData={item.marketPrice} />
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    </SwiperItem>
                                ))}
                            </Swiper>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

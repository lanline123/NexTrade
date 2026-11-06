import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Swiper, SwiperItem, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToDevicePx, designPxToRpx, formatCommonStyle, gradientMap } from "@/components/modules";
import { urlFormat, imageFormat, productImage } from "@/utils/format";
import { redirect, getElementRect } from "@/utils";
import { getProductsList } from "@/api/common";
import { t } from "@/utils/i18n";
import FormatPrice from "@/components/format-price/FormatPrice";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function ComboSuggestions({ module }: Props) {
    // React 版用组件根节点 ref 替代 Vue getCurrentInstance()，供选择器查询圈定范围
    const rootRef = useRef<any>(null);

    const commonStyle = useMemo(() => {
        return formatCommonStyle(
            module.moduleStyle ?? {
                boxMarginTop: 5,
                boxMarginBottom: 0,
                boxMargin: 10,
                backgroundColor: "",
                backgroundPic: {
                    picUrl: "",
                    picThumb: ""
                },
                backgroundPicFillType: "cover"
            },
            module.contentStyle ?? {
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeftRight: 0,
                padding: 0,
                boxRadiusTop: 0,
                boxRadiusBottom: 0,
                gradientType: "upDown",
                gradientColorA: "#ffffff",
                gradientColorB: "#ffffff",
                backgroundPic: {
                    picUrl: "",
                    picThumb: ""
                },
                backgroundPicFillType: "cover",
                boxShadow: 0
            },
            module.subTitle ?? {}
        );
    }, [module.moduleStyle, module.contentStyle, module.subTitle]);

    const listStyle = useMemo(() => {
        let str = `border-radius: ${designPxToRpx(module.groupRadius)};background-image: linear-gradient(${gradientMap[module.backgroundGradientType]},${
            module?.gradientColorA
        } -50%, ${module.gradientColorB});`;
        if (module.groupShadow == 1) {
            str += `box-shadow: rgba(0, 0, 0, 0.06) 0 4rpx 8rpx;`;
        }
        return str;
    }, [module.groupRadius, module.backgroundGradientType, module.gradientColorA, module.gradientColorB, module.groupShadow]);

    const interval = useMemo(() => {
        return module.interval ? module.interval * 1000 : 3000;
    }, [module.interval]);

    const autoplay = useMemo(() => {
        return module.autoPlay == 1;
    }, [module.autoPlay]);

    // 旧 currentIndex 被所有分组的 swiper 共用（change 事件统一回写），此处保持同结构
    const [currentIndex, setCurrentIndex] = useState(0);
    const swiperChange = (e: any) => {
        setCurrentIndex(e);
    };

    const [height, setHeight] = useState(0);
    const getHeight = async () => {
        try {
            const res = await getElementRect(".main", rootRef.current);
            if (res && res.width) {
                // uni.getWindowInfo().windowWidth → Taro.getSystemInfoSync().windowWidth
                setHeight((res.width / 2 - designPxToDevicePx(4 + 12, Taro.getSystemInfoSync().windowWidth)) * 0.63);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const [productGroupsList, setProductGroupsList] = useState<any>({});
    const getProductGroupsList = () => {
        module.comboGroups.forEach(async (group: any, index: number) => {
            if (group.groupType === "product") {
                const ids = group.pruductList.map((item: any) => item.productId);
                try {
                    const result = await getProductsList({ ids: ids.join(","), size: ids.length });
                    setProductGroupsList((prev: any) => ({ ...prev, [index]: result.records }));
                } catch (error) {
                    console.error(error);
                }
            }
        });
    };

    // 对应旧 setup 立即调用 getProductGroupsList()
    useEffect(() => {
        getProductGroupsList();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 对应旧 onMounted getHeight + uni.onWindowResize / onUnmounted offWindowResize
    useEffect(() => {
        void getHeight();
        const windowResizeCallback = () => {
            void getHeight();
        };
        Taro.onWindowResize(windowResizeCallback);
        return () => {
            Taro.offWindowResize(windowResizeCallback);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View
            ref={rootRef}
            className="module-ad-con"
            style={
                commonStyle.moduleStyle.boxPaddingBottom +
                commonStyle.moduleStyle.boxPaddingTop +
                commonStyle.moduleStyle.boxPadding +
                commonStyle.moduleStyle.backgroundSize +
                commonStyle.moduleStyle.backgroundImage
            }
        >
            <View className="main">
                {(module.comboGroups || []).map((group: any, index: number) => (
                    <View key={index} className="list" style={listStyle + `${Number(index) > 1 ? "margin-top: 20rpx;" : ""}`}>
                        <View style={{ padding: "12rpx" }}>
                            <View
                                className="top"
                                onClick={() => {
                                    urlFormat(group.moreLink) && redirect({ url: urlFormat(group.moreLink) });
                                }}
                            >
                                <View className="top-tit">
                                    {group.titleImage?.picUrl ? (
                                        <Image className="img" src={imageFormat(group.titleImage.picUrl)} mode="heightFix" />
                                    ) : (
                                        <View className="big-title line1" style={`color:${module.groupTitleColor}`}>
                                            {t(group.groupTitle)}
                                        </View>
                                    )}
                                    <View className="title line1" style={`background:${group.groupColor}`}>
                                        {t(group.groupSubTitle)}
                                    </View>
                                </View>
                                <View className="desc" style={`color: ${group.groupColor}`}>
                                    {t(group.groupDesc)}
                                </View>
                            </View>
                            <View style={`border-radius: ${designPxToRpx(module.groupRadius)}; overflow: hidden; position: relative; height: ${height}px;`}>
                                {group.groupType === "image" && (
                                    <>
                                        {/* 旧 tig-swiper（v-model="group.picList"）等价展开：circular 固定 true、dot=false、height 为 "Npx" 字符串 */}
                                        <Swiper
                                            style={{ height: height + "px" }}
                                            circular
                                            indicatorDots={false}
                                            interval={interval}
                                            autoplay={autoplay}
                                            duration={500}
                                            onChange={swiperChange}
                                        >
                                            {group.picList?.map((item: any, key: number) => (
                                                <SwiperItem key={key}>
                                                    <View
                                                        className="pic-box"
                                                        onClick={() => urlFormat(item.picLink) && redirect({ url: urlFormat(item.picLink) })}
                                                    >
                                                        <View
                                                            className="pic-img"
                                                            style={` height: ${height}px;background-image: url(${productImage(item)});`}
                                                        />
                                                        <View className="tit" style={`color: ${module.bannerTittleColor};`}>
                                                            {t(item.picTitle ?? "")}
                                                        </View>
                                                    </View>
                                                </SwiperItem>
                                            ))}
                                        </Swiper>
                                        <View style={`position: absolute; right: 20rpx; bottom: 10rpx; line-height: 36rpx; color:${module.bannerDotColor}; z-index: 9`}>
                                            {`${currentIndex + 1}/${group.picList?.length}`}
                                        </View>
                                    </>
                                )}
                                {group.groupType === "product" && (
                                    // 旧 tig-swiper（:display-multiple-items="2"）等价展开，一屏两卡
                                    <Swiper
                                        // TODO(MIGRATION)：H5 端 Taro Swiper 对 displayMultipleItems 支持有限，小程序端原生支持；如 H5 显示异常需参照 productCarousel 用 previous/next-margin 重写
                                        displayMultipleItems={2}
                                        interval={interval}
                                        autoplay={autoplay}
                                        style={{ height: height + "px" }}
                                        circular
                                        indicatorDots={false}
                                        duration={500}
                                    >
                                        {(productGroupsList[index] || []).map((item: any, key: number) => (
                                            <SwiperItem key={key}>
                                                <View
                                                    className="item"
                                                    onClick={() =>
                                                        item.productId && redirect({ url: urlFormat({ path: "product", data: { id: item.productId } }) })
                                                    }
                                                >
                                                    <View
                                                        className="goods-img"
                                                        style={`width: 100%;
                                                                padding-top: 100%;
                                                                background-size: cover;
                                                                border-radius: ${designPxToRpx(module.imageRadius)};
                                                                background-image: url(${productImage(item)});`}
                                                    />
                                                    <View className="goods-price">
                                                        <View
                                                            className="price-text"
                                                            style={`color: ${module.regularPriceColor}; background: ${
                                                                module.regularPriceBgColor || "transparent"
                                                            }; border-radius: ${designPxToRpx(module.regularPriceRadius || 0)}; font-size: ${designPxToRpx(
                                                                module.regularPriceSize || 14
                                                            )};`}
                                                        >
                                                            <FormatPrice priceData={item.productPrice} />
                                                        </View>
                                                    </View>
                                                </View>
                                            </SwiperItem>
                                        ))}
                                    </Swiper>
                                )}
                            </View>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}

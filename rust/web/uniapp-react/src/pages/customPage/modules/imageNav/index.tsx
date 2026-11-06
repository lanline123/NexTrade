import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Swiper, SwiperItem, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToRpx, formatFrame } from "@/components/modules";
import { redirect, getElementRect } from "@/utils";
import { imageFormat, urlFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function ImageNav({ module }: Props) {
    const { frame } = module;
    const instanceRef = useRef<any>(null);

    const frameFormat = useMemo(() => {
        return formatFrame(frame ?? {});
    }, [frame]);

    const imageGap = useMemo(() => designPxToRpx(module.imgPadding), [module.imgPadding]);

    const selectColor = useMemo(() => {
        return module.swiperPageColor || "#333";
    }, [module.swiperPageColor]);

    const mode = useMemo(() => {
        return module.picPageType == 1 ? "default" : "dot";
    }, [module.picPageType]);

    const [swiperList, setSwiperList] = useState<any[]>([]);
    const getSwiperList = () => {
        if (module.navType == 1) return;
        const itemNum = module.rowNum && module.colNum ? module.rowNum * module.colNum : 0;
        const swiperListNum = Math.ceil(module.picList.length / itemNum);
        const next: any[] = [];
        for (let index = 0; index < swiperListNum; index++) {
            next.push(module.picList.slice(index * itemNum, (index + 1) * itemNum));
        }
        setSwiperList(next);
    };
    // 对应旧 watchEffect：按 rowNum * colNum 把图片分组，每组一页轮播
    useEffect(() => {
        getSwiperList();
    }, [module.navType, module.rowNum, module.colNum, module.picList]);

    const [swiperHeight, setSwiperHeight] = useState(150);

    const gteSwiperHeight = async () => {
        try {
            const res = await getElementRect(".swiper-main", instanceRef.current);
            if (res) {
                setSwiperHeight(res.height);
            }
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        // 对应旧 onMounted + nextTick
        const timer = setTimeout(() => {
            gteSwiperHeight();
        }, 0);
        return () => clearTimeout(timer);
    }, []);

    useEffect(() => {
        const windowResizeCallback = () => {
            gteSwiperHeight();
        };
        Taro.onWindowResize(windowResizeCallback);
        return () => {
            Taro.offWindowResize(windowResizeCallback);
        };
    }, []);

    if (!(module.picList && module.picList.length > 0)) {
        return null;
    }

    return (
        <View
            ref={instanceRef as any}
            className={`module-ad-con module-ad-con- module-image_nav ad-nav_type__${module.navType} ad-nav_style__${module.navStyle} ad-row_num__${module.rowNum} ad-col_num__${module.colNum} ad-pic_page_type__${module.picPageType} ad-radio_style__${module.radioStyle}`}
            style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom}
        >
            <View className="module-ad-content" style={frameFormat.innerPadding + frameFormat.backgroundColor + frameFormat.boxRadius}>
                {module.navType == 2 ? (
                    <View className="image-ad-warp">
                        <View className="image-ad-con">
                            {/* 旧 tig-swiper（v-model="swiperList"）等价展开：
                                circular、autoplay 默认 true、interval 默认 3000、duration 默认 500、height 为字符串时按原单位使用 */}
                            <Swiper
                                current={0}
                                className={module.picPageType == 3 ? "uni-swiper-dot-box" : ""}
                                style={{ height: `${swiperHeight}px`, "--swiper-page-color": selectColor } as Record<string, string | number>}
                                circular
                                indicatorDots={mode === "dot"}
                                autoplay
                                interval={3000}
                                duration={500}
                                indicatorColor={module.picPageType == 3 ? "#fff" : ""}
                                indicatorActiveColor={selectColor}
                            >
                                {swiperList.map((item: any[], index: number) => (
                                    <SwiperItem key={index}>
                                        <View className="swiper-main" style={{ flexWrap: module.colNum > 1 ? "wrap" : "nowrap" }}>
                                            {item.map((subItem: any, subIndex: number) => (
                                                <View
                                                    key={subIndex}
                                                    className="swiper-item"
                                                    style={{ flexGrow: 0, flexBasis: `${100 / module.rowNum}%`, padding: designPxToRpx(module.imgPadding) }}
                                                    onClick={() => {
                                                        subItem.picLink && redirect({ url: urlFormat(subItem.picLink, subItem.picTitle) });
                                                    }}
                                                >
                                                    <View className="swiper-item-box" style={`background-image: url(${imageFormat(subItem.picUrl)});`} />
                                                    {subItem.picTitle && module.navStyle !== 2 && (
                                                        <View className="imagenav-item-text">{t(subItem.picTitle)}</View>
                                                    )}
                                                </View>
                                            ))}
                                        </View>
                                    </SwiperItem>
                                ))}
                            </Swiper>
                        </View>
                    </View>
                ) : (
                    <View
                        className="imagenav-main"
                        // 原 scoped 样式中的 v-bind("module.rowNum") / v-bind("module.colNum") / v-bind("imageGap") 改为内联样式
                        style={{
                            gridTemplateColumns: `repeat(${module.rowNum}, 1fr)`,
                            gridTemplateRows: `repeat(${module.colNum}, 1fr)`,
                            gridGap: imageGap
                        }}
                    >
                        {module.picList.map((item: any, index: number) => (
                            <View
                                key={index}
                                className="imagenav-main-item"
                                onClick={() => {
                                    item.picLink && redirect({ url: urlFormat(item.picLink, item.picTitle) });
                                }}
                            >
                                <View className="item-img-a">
                                    {module.navStyle == 2 || module.navStyle == 1 ? (
                                        <Image
                                            className={`imagenav-item-img ${module.navStyle === 2 ? "img-height" : ""}`}
                                            src={imageFormat(item.picUrl)}
                                            mode="widthFix"
                                        />
                                    ) : null}
                                </View>
                                <View className="item-text-a">
                                    {item.picTitle && module.navStyle != 2 && (
                                        <View className="imagenav-item-text line1">{t(item.picTitle ?? "")}</View>
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}

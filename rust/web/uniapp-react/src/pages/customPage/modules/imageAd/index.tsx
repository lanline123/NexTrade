import { useEffect, useMemo, useState } from "react";
import { Image, Swiper, SwiperItem, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToRpx, formatFrame } from "@/components/modules";
import CommonTitle from "@/pages/customPage/modules/commonTitle/index";
import { redirect } from "@/utils";
import { imageFormat, urlFormat } from "@/utils/format";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function ImageAd({ module }: Props) {
    const frameFormat = useMemo(() => {
        return formatFrame(module.frame ?? {});
    }, [module.frame]);

    const format = useMemo(() => {
        return {
            imgPadding: "padding:" + designPxToRpx(module?.imgPadding) + ";"
        };
    }, [module?.imgPadding]);

    const selectColor = useMemo(() => {
        return module.swiperPageColor || "#333";
    }, [module.swiperPageColor]);

    const mode = useMemo(() => {
        return module.picPageType == 1 ? "default" : "dot";
    }, [module.picPageType]);

    const columns = useMemo(() => {
        return module.swiperPreView || 1;
    }, [module.swiperPreView]);

    const [swiperHeight, setSwiperHeight] = useState(150);
    const [loadEnd, setLoadEnd] = useState(false);

    const loadImage = (e: any) => {
        const { height, width } = e.detail;
        computeImgHeight(height, width);
    };

    const computeImgHeight = (height: number, width: number) => {
        const screenWidth = Taro.getSystemInfoSync().windowWidth;
        const pxToRpx = 750 / screenWidth;
        // 统一按宽高比计算，将图片等比例缩放到屏幕宽度后的高度，并按当前视口转换为 rpx
        const scaledHeight = ((screenWidth * height) / width) * pxToRpx;
        // 取所有图片中的最大高度，确保所有图片都能完整显示
        setSwiperHeight((prev) => {
            if (scaledHeight > prev) {
                return scaledHeight;
            }
            return prev;
        });
        setLoadEnd(true);
    };

    const [swiperList, setSwiperList] = useState<any[]>([]);
    const getSwiperList = () => {
        const itemNum = module.swiperPreView || 1;
        const swiperListNum = Math.ceil(module.picList.length / itemNum);
        const next: any[] = [];
        for (let index = 0; index < swiperListNum; index++) {
            next.push(module.picList.slice(index * itemNum, (index + 1) * itemNum));
        }
        setSwiperList(next);
    };
    // 对应旧 watchEffect：多列预览时按 columns 把图片分组，每组一页轮播
    useEffect(() => {
        if (columns > 1 && module.picList && module.picList.length > 0) {
            getSwiperList();
        }
    }, [columns, module.picList]);

    useEffect(() => {
        const windowResizeCallback = () => {
            Taro.getImageInfo({
                src: imageFormat(module.picList[0]?.picUrl),
                success: (e: any) => {
                    computeImgHeight(e.height, e.width);
                }
            }).catch(() => {});
        };
        Taro.onWindowResize(windowResizeCallback);
        return () => {
            Taro.offWindowResize(windowResizeCallback);
        };
    }, [module]);

    if (!module.picList?.length) {
        return null;
    }

    return (
        <View
            className={`module-ad-con module-image_ad  ad-pic_type__${module.picType} ad-pic_page_type__${module.picPageType} ad-radio_style__${module.picRadioStyle} `}
            style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom}
        >
            <View className="module-ad-content" style={frameFormat.backgroundColor + " " + frameFormat.boxRadius}>
                {module.title.showTitle == 1 && <CommonTitle module={module.title} />}
                {module.picList && module.picList.length > 0 && (
                    <>
                        {module.picType == 2 ? (
                            <View className="image-ad-warp" style={frameFormat.innerPadding}>
                                <View className="image-ad-con">
                                    {columns == 1 ? (
                                        // 旧 tig-swiper（v-model="module.picList"）等价展开：
                                        // circular、autoplay 默认 true、interval 默认 3000、duration 默认 500、height 为数值时单位 rpx
                                        <Swiper
                                            current={0}
                                            className={module.picPageType == 3 ? "uni-swiper-dot-box" : ""}
                                            style={{ height: swiperHeight + "rpx" }}
                                            circular
                                            indicatorDots={mode === "dot"}
                                            autoplay
                                            interval={3000}
                                            duration={500}
                                            indicatorColor={module.picPageType == 3 ? "#fff" : ""}
                                            indicatorActiveColor={selectColor}
                                        >
                                            {module.picList.map((item: any, index: number) => (
                                                <SwiperItem key={index}>
                                                    <View style={{ height: swiperHeight + "rpx" }} className="image-ad-item">
                                                        <View
                                                            className="item-content"
                                                            style={format.imgPadding}
                                                            onClick={() => {
                                                                item.picLink && redirect({ url: urlFormat(item.picLink) });
                                                            }}
                                                        >
                                                            <View className="item-img-a">
                                                                <Image
                                                                    style={{ width: "100%", height: "100%" }}
                                                                    src={imageFormat(item.picUrl)}
                                                                    mode="aspectFit"
                                                                    onLoad={loadImage}
                                                                />
                                                            </View>
                                                        </View>
                                                    </View>
                                                </SwiperItem>
                                            ))}
                                        </Swiper>
                                    ) : (
                                        <Swiper
                                            current={0}
                                            className={module.picPageType == 3 ? "uni-swiper-dot-box" : ""}
                                            style={{ height: swiperHeight + "rpx" }}
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
                                                    <View
                                                        className="swiper-main"
                                                        style={{ height: swiperHeight + "rpx", gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                                                    >
                                                        {item.map((subItem: any, subIndex: number) => (
                                                            <View key={subIndex} className="image-ad-item">
                                                                <View className="item-content" style={format.imgPadding}>
                                                                    <View className="item-img-a">
                                                                        <Image
                                                                            style={{ width: "100%", height: "100%" }}
                                                                            src={imageFormat(subItem.picUrl)}
                                                                            onLoad={loadImage}
                                                                        />
                                                                    </View>
                                                                </View>
                                                            </View>
                                                        ))}
                                                    </View>
                                                </SwiperItem>
                                            ))}
                                        </Swiper>
                                    )}
                                </View>
                            </View>
                        ) : (
                            <View className="image-ad-warp" style={frameFormat.innerPadding}>
                                <View className="image-ad-con">
                                    {module.picList.map((pic: any, picIndex: number) => (
                                        <View className="image-ad-item" key={picIndex}>
                                            <View
                                                className="item-content"
                                                style={format.imgPadding}
                                                onClick={() => {
                                                    pic.picLink && redirect({ url: urlFormat(pic.picLink) });
                                                }}
                                            >
                                                <View className="item-img-a">
                                                    <Image className="item-img" src={imageFormat(pic.picUrl)} mode="widthFix" />
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        )}
                    </>
                )}
            </View>
        </View>
    );
}

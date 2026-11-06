import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Swiper, SwiperItem, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToRpx, formatFrame } from "@/components/modules";
import CommonTitle from "@/pages/customPage/modules/commonTitle/index";
import { useImgInfo } from "@/hooks/useDecorate";
import { redirect } from "@/utils";
import { imageFormat, urlFormat } from "@/utils/format";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function ImageAd2({ module }: Props) {
    // React 版用组件根节点 ref 替代 Vue getCurrentInstance()，供选择器查询圈定范围
    const rootRef = useRef<any>(null);

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

    const { height, getHeght, getImgratio } = useImgInfo();
    // 小程序端兜底：高度计算未就绪时避免传 0 导致 slot 内容无高度
    const safeHeightPx = useMemo(() => {
        const h = Number(height || 0);
        return h > 0 ? h : 300;
    }, [height]);

    const [swiperList, setSwiperList] = useState<any[]>([]);
    const getSwiperList = () => {
        const next: any[] = [];
        const itemNum = module.swiperPreView || 1;
        const swiperListNum = Math.ceil(module.picList.length / itemNum);
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [columns, module.picList]);

    // 对应旧 onMounted：轮播形态先测比例再按列数测高度
    useEffect(() => {
        (async () => {
            if (module.picType == 2) {
                await getImgratio(module.picList[0].picUrl);
                await getHeght(".image-ad-con", rootRef, columns);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const windowResizeCallback = async () => {
        if (module.picType == 2) {
            await getImgratio(module.picList[0].picUrl);
            await getHeght(".image-ad-con", rootRef, columns);
        }
    };
    // uni.onWindowResize → Taro.onWindowResize；onUnmounted 清理
    useEffect(() => {
        Taro.onWindowResize(windowResizeCallback);
        return () => {
            Taro.offWindowResize(windowResizeCallback);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!module.picList.length) {
        return null;
    }

    return (
        <View
            className={`module-ad-con module-image_ad  ad-pic_type__${module.picType} ad-pic_page_type__${module.picPageType} ad-radio_style__${module.picRadioStyle} `}
            style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom + frameFormat.backgroundColor}
        >
            <View className="module-ad-content" style={frameFormat.boxRadius}>
                {module.title.showTitle == 1 && <CommonTitle module={module.title} />}
                {module.picList && module.picList.length > 0 && (
                    <>
                        {module.picType == 2 ? (
                            <View className="image-ad-warp" style={frameFormat.innerPadding}>
                                <View className="image-ad-con">
                                    {columns == 1 ? (
                                        // 旧 tig-swiper（:model-value="module.picList" :dot="module.showIndicator == 1"）等价展开：
                                        // circular、autoplay 默认 true、interval 默认 3000、duration 默认 500、
                                        // mode→indicatorDots、:color→indicatorColor、:select-color→indicatorActiveColor
                                        <Swiper
                                            current={0}
                                            className={module.picPageType == 3 ? "uni-swiper-dot-box" : ""}
                                            style={{ height: safeHeightPx + "px" }}
                                            circular
                                            indicatorDots={module.showIndicator == 1}
                                            autoplay
                                            interval={3000}
                                            duration={500}
                                            indicatorColor={module.picPageType == 3 ? "#fff" : ""}
                                            indicatorActiveColor={selectColor}
                                        >
                                            {module.picList.map((item: any, picIndex: number) => (
                                                <SwiperItem key={picIndex}>
                                                    {/* 小程序端：slot 根节点显式定高，避免内部拿不到 swiper-item 高度 */}
                                                    <View className="image-ad-item swiper-item-root" style={{ height: safeHeightPx + "px" }}>
                                                        <View
                                                            className="item-content"
                                                            style={format.imgPadding}
                                                            onClick={() => {
                                                                item.picLink && redirect({ url: urlFormat(item.picLink) });
                                                            }}
                                                        >
                                                            <View className="item-img-a">
                                                                <Image style={{ width: "100%", height: "100%" }} src={imageFormat(item.picUrl)} />
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
                                            style={{ height: safeHeightPx + "px" }}
                                            circular
                                            indicatorDots={module.showIndicator == 1}
                                            autoplay
                                            interval={3000}
                                            duration={500}
                                            indicatorColor={module.picPageType == 3 ? "#fff" : ""}
                                            indicatorActiveColor={selectColor}
                                        >
                                            {swiperList.map((item: any[], groupIndex: number) => (
                                                <SwiperItem key={groupIndex}>
                                                    {/* 小程序端：slot 根节点显式定高，避免内部拿不到 swiper-item 高度 */}
                                                    <View
                                                        className="swiper-main swiper-item-root"
                                                        style={{ height: safeHeightPx + "px", gridTemplateColumns: `repeat(${columns}, 1fr)` }}
                                                    >
                                                        {item.map((subItem: any, subIndex: number) => (
                                                            <View key={subIndex} className="image-ad-item">
                                                                <View className="item-content" style={format.imgPadding}>
                                                                    <View className="item-img-a">
                                                                        <Image style={{ width: "100%", height: "100%" }} src={imageFormat(subItem.picUrl)} />
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
                                                {/* 原 :url 属性为无效遗留属性，不迁移 */}
                                                <View className="item-img-a">
                                                    <Image className="item-img" src={imageFormat(pic.picUrl)} mode="widthFix" />
                                                    {/* 原 <tig-image> 写法在旧版已被注释，此处按生效的 <image> 迁移 */}
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

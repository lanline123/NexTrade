import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Swiper, SwiperItem, Video, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { imageFormat } from "@/utils/format";
import { staticResource } from "@/utils";
import { shouldShowSoldOut } from "@/utils/productSoldOut";
import type { PicList, ProductItem, VideoList } from "@/types/product/product";
import { t } from "@/utils/i18n";

import "./index.scss";

type AnyObject = Record<string, any>;

interface Props {
    picList?: PicList[];
    productInfo?: ProductItem;
    videoList?: VideoList[];
    seckillValue?: AnyObject;
    grouponValue?: AnyObject;
    productStock?: number;
    /** 父页面详情接口完成后置为 true；用于避免首次进入因默认库存=0而误显示"已售罄" */
    detailLoaded?: boolean;
    isSubCard?: boolean;
    /** 主图比例（装修字段） */
    imageRatio?: "4:3" | "4:5" | "1:1";
    /** 轮播图左右边距（px） */
    imageMargin?: number | string;
    /** 主图显示模式：1-完整显示，2-铺满裁切 */
    imageMode?: number | string;
    /** 主图圆角（装修字段） */
    imageRadiusStyle?: "square" | "round" | "large";
}

/**
 * 商品图片轮播组件（风格一 装修版，自旧 pages/product/src/productImgDecorate.vue 移植）
 * - 主图比例 / 圆角由后台装修字段驱动（imageRatio / imageRadiusStyle）
 * - 圆点指示器、内边距留白，与标准风视觉一致
 * - 售罄判断、视频播放沿用门店风主图的业务逻辑，保证行为一致
 * v-bind() 已转内联 style（imageMarginCss/imageRadiusValue/swiperStyle/playImg），scss 内注释原位置。
 */
export default function ProductImgDecorate({
    picList = [],
    productInfo = {} as ProductItem,
    videoList = [],
    seckillValue: _seckillValue,
    grouponValue: _grouponValue,
    productStock = 0,
    detailLoaded = false,
    isSubCard = false,
    imageRatio = "1:1",
    imageMargin = 16,
    imageMode = 1,
    imageRadiusStyle = "square"
}: Props) {
    const isOutSale = useMemo(() => {
        // 仅在详情接口已完成时才判断，避免首次进入（默认库存为 0）误显示
        if (!detailLoaded) return false;
        return shouldShowSoldOut(
            {
                ...productInfo,
                currentStock: productStock
            },
            {
                stockField: "currentStock",
                isSubCard
            }
        );
    }, [detailLoaded, productInfo, productStock, isSubCard]);

    const [currentPic, setCurrentPic] = useState(1);

    const videoData = useMemo(() => {
        return videoList[0] ? videoList[0] : ({} as VideoList);
    }, [videoList]);

    const list = useMemo(() => {
        return videoData.videoUrl
            ? [
                  {
                      ...videoData,
                      picLarge: picList[0]?.picLarge || ""
                  },
                  ...picList
              ]
            : picList;
    }, [videoData, picList]);

    // ===== 主图比例 / 圆角映射（装修字段驱动）=====
    const imageRatioMap: Record<NonNullable<Props["imageRatio"]>, number> = {
        "4:3": 3 / 4,
        "4:5": 5 / 4,
        "1:1": 1
    };

    const imageRadiusMap: Record<NonNullable<Props["imageRadiusStyle"]>, string> = {
        square: "0",
        round: "20rpx",
        large: "36rpx"
    };

    const imageMarginPx = useMemo(() => {
        const value = Number(imageMargin);
        return Number.isFinite(value) ? Math.max(0, value) : 16;
    }, [imageMargin]);
    const imageMarginCss = `${imageMarginPx}px`;

    // 原 swiperStyle（:style="swiperStyle"），保持内联对象
    const swiperStyle = useMemo(() => {
        const windowWidth = Taro.getSystemInfoSync().windowWidth || 0;
        const contentWidth = Math.max(windowWidth - imageMarginPx * 2, 0);
        const ratio = imageRatioMap[imageRatio] || imageRatioMap["1:1"];
        return {
            height: `${Math.round(contentWidth * ratio)}px`
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageMarginPx, imageRatio]);

    // 原 v-bind(imageRadiusValue) 转内联 style
    const imageRadiusValue = imageRadiusMap[imageRadiusStyle] || imageRadiusMap.square;

    const imageDisplayMode = Number(imageMode) === 2 ? "aspectFill" : "aspectFit";

    const swiperChange = (e: any) => {
        setCurrentPic(e.detail.current + 1);
        setShowVideo(false);
        videoContextRef.current?.pause();
    };

    const swiperImagePreview = (index: number) => {
        const images = list.map((item) => imageFormat(item.picUrl || ""));
        // 旧 uni.previewImage 的 indicator/loop 为小程序端参数（Taro 类型未声明，as any 保留）
        Taro.previewImage({
            current: images[index],
            urls: images,
            indicator: "number",
            loop: true
        } as any);
    };

    const [showVideo, setShowVideo] = useState(false);
    const videoContextRef = useRef<any>(null);
    // 记录视频是否处于全屏态：全屏时若直接隐藏 video 元素会导致全屏层无法回收、页面卡死
    const isFullScreenRef = useRef(false);
    // 标记"待退出全屏后再隐藏视频"，避免在全屏状态下抽掉 video 元素导致卡死
    const pendingHideVideoRef = useRef(false);

    const hideVideoSafely = () => {
        if (isFullScreenRef.current) {
            pendingHideVideoRef.current = true;
            videoContextRef.current?.exitFullScreen?.();
        } else {
            setShowVideo(false);
        }
    };

    const handlePlayVideo = () => {
        setShowVideo(true);
        videoContextRef.current?.play();
    };

    const handleFullscreenChange = (e: any) => {
        const fullScreen = !!e?.detail?.fullScreen;
        isFullScreenRef.current = fullScreen;
        if (!fullScreen && pendingHideVideoRef.current) {
            pendingHideVideoRef.current = false;
            setShowVideo(false);
        }
    };

    const handlevideoError = (e: any) => {
        console.log("video error", e);
    };

    const handlevideoEnded = () => {
        hideVideoSafely();
    };

    const handlevideoPause = () => {
        // 旧 #ifdef APP-PLUS（工程无 APP 构建，条件恒为 false，保留原结构；Taro 环境枚举无 "app"，断言绕过）
        if ((process.env.TARO_ENV as string) === "app") {
            hideVideoSafely();
        }
    };

    // 对应旧 watch(videoData.videoUrl)：视频被移除时收起播放器
    useEffect(() => {
        if (!videoData.videoUrl) {
            setShowVideo(false);
            videoContextRef.current?.pause();
        }
    }, [videoData.videoUrl]);

    // 对应旧 onMounted：videoContext = uni.createVideoContext("productVideo", instance)
    useEffect(() => {
        videoContextRef.current = Taro.createVideoContext("productVideo");
    }, []);

    // 对应旧 computed playImg（v-bind(playImg) 转内联 style）
    const playImg = `url("${staticResource("product/video-playing.png")}")`;

    return (
        // 原 .product-pic-con 的 padding: 6px v-bind(imageMarginCss) 12px → 内联 style（原位于 scss 首条规则）
        <View
            className="product-pic-con"
            style={{
                padding: `6px ${imageMarginCss} 12px`
            }}
        >
            {list.length > 0 ? (
                <View
                    className="product-bg"
                    style={{
                        // 原 scss：border-radius: v-bind(imageRadiusValue)（.product-bg 规则内）
                        borderRadius: imageRadiusValue
                    }}
                >
                    {/* 旧 swiper（:style="swiperStyle"）→ Taro Swiper，旧裸标签选择器样式改挂 .decorate-swiper */}
                    <Swiper
                        className="decorate-swiper"
                        style={swiperStyle as any}
                        indicatorDots={false}
                        circular
                        interval={3000}
                        duration={500}
                        onChange={swiperChange}
                    >
                        {list.map((item, index) => (
                            <SwiperItem key={index}>
                                <View className="swiper-item-box">
                                    {!item.videoUrl ? (
                                        <Image
                                            src={imageFormat(item.picLarge || item.picUrl || "")}
                                            mode={imageDisplayMode as any}
                                            className="slide-image"
                                            onClick={() => swiperImagePreview(index)}
                                        />
                                    ) : (
                                        <View className="video-box">
                                            {/* 旧 v-show + mp-force-hidden（微信端 hidden 优先级兜底）→ 显式 display 控制 */}
                                            <View
                                                className={`cover-box ${showVideo ? "mp-force-hidden" : ""}`}
                                                style={{ display: showVideo ? "none" : undefined }}
                                                onClick={handlePlayVideo}
                                            >
                                                <Image
                                                    src={imageFormat(item.videoCover ? item.videoCover : item.picLarge || item.picUrl || "")}
                                                    mode={imageDisplayMode as any}
                                                    className="slide-image"
                                                />
                                                <View
                                                    className="video-icon"
                                                    style={{
                                                        // 原 scss：background-image: v-bind(playImg)（.video-icon 规则内）
                                                        backgroundImage: playImg
                                                    }}
                                                />
                                            </View>
                                            <Video
                                                style={{ display: showVideo ? undefined : "none" }}
                                                id="productVideo"
                                                className="product-video"
                                                src={imageFormat(item.videoUrl)}
                                                autoplay={false}
                                                enableProgressGesture={false}
                                                controls
                                                loop={false}
                                                onPause={handlevideoPause}
                                                onError={handlevideoError}
                                                onEnded={handlevideoEnded}
                                                onFullscreenChange={handleFullscreenChange}
                                            />
                                        </View>
                                    )}
                                    {isOutSale ? (
                                        <View className="product-status-box">
                                            <View className="outsale">{t("已售罄")}</View>
                                        </View>
                                    ) : null}
                                </View>
                            </SwiperItem>
                        ))}
                    </Swiper>
                    <View
                        className={`swiper-indicator-box ${(list.length > 1 && !showVideo) ? "" : "mp-force-hidden"}`}
                        style={{ display: list.length > 1 && !showVideo ? undefined : "none" }}
                    >
                        {Array.from({ length: list.length }, (_v, item) => (
                            <View key={item} className={`swiper-indicator-item ${currentPic === item + 1 ? "active" : ""}`} />
                        ))}
                    </View>
                </View>
            ) : null}
        </View>
    );
}

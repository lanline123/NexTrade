import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Swiper, SwiperItem, Text, Video, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { imageFormat, pickPic, productImage } from "@/utils/format";
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
    /** 后台装修主图比例；A2 在保留旧版轮播结构的同时应用 */
    imageRatio?: "4:3" | "4:5" | "1:1";
    /** 轮播图左右边距（px） */
    imageMargin?: number | string;
    /** 后台装修主图显示模式：1-完整显示，2-铺满裁切 */
    imageMode?: number | string;
    /** 后台装修主图圆角 */
    imageRadiusStyle?: "square" | "round" | "large";
}

/**
 * 商品图片轮播组件（自旧 pages/product/src/productImg.vue 移植）
 * - 主图轮播展示商品图片和视频
 * - 支持图片预览、视频播放
 * - 显示当前图片索引指示器
 * v-bind() 已转内联 style（imageHeight/imageMarginCss/imageRadius/playImg），scss 内注释原位置。
 */
export default function ProductImg({
    picList = [],
    productInfo = {} as ProductItem,
    videoList = [],
    seckillValue: _seckillValue,
    grouponValue: _grouponValue,
    productStock = 0,
    detailLoaded = false,
    isSubCard = false,
    imageRatio = "1:1",
    imageMargin = 0,
    imageMode = 1,
    imageRadiusStyle = "square"
}: Props) {
    const imageRatioMap: Record<NonNullable<Props["imageRatio"]>, number> = {
        "4:3": 3 / 4,
        "4:5": 5 / 4,
        "1:1": 1
    };
    const imageRadiusMap: Record<NonNullable<Props["imageRadiusStyle"]>, string> = {
        square: "0rpx",
        round: "16rpx",
        large: "32rpx"
    };
    const imageMarginPx = useMemo(() => {
        const value = Number(imageMargin);
        return Number.isFinite(value) ? Math.max(0, value) : 0;
    }, [imageMargin]);
    const imageMarginCss = `${imageMarginPx}px`;
    const imageHeight = useMemo(() => {
        const windowWidth = Taro.getSystemInfoSync().windowWidth || 0;
        const contentWidth = Math.max(windowWidth - imageMarginPx * 2, 0);
        const ratio = imageRatioMap[imageRatio] || imageRatioMap["1:1"];
        return `${Math.round(contentWidth * ratio)}px`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [imageMarginPx, imageRatio]);
    const imageRadius = imageRadiusMap[imageRadiusStyle];
    const imageDisplayMode = Number(imageMode) === 2 ? "aspectFill" : "aspectFit";

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

    const swiperChange = (e: any) => {
        setCurrentPic(e.detail.current + 1);
        setShowVideo(false);
        videoContextRef.current?.pause();
    };

    const swiperImagePreview = (index: number) => {
        const images = list.map((item) => productImage(item));
        // 旧 uni.previewImage 的 indicator/loop 为小程序端参数（Taro 类型未声明，as any 保留）
        Taro.previewImage({
            current: images[index],
            urls: images,
            indicator: "number",
            loop: true
        } as any);
    };

    // 对应旧 uni.createVideoContext("productVideo", instance)；React 版组件卸载不持有 context
    const [showVideo, setShowVideo] = useState(false);
    const videoContextRef = useRef<any>(null);
    // 记录视频是否处于全屏态：全屏时若直接隐藏 video 元素会导致全屏层无法回收、页面卡死
    const isFullScreenRef = useRef(false);
    // 标记"待退出全屏后再隐藏视频"，避免在全屏状态下抽掉 video 元素导致卡死
    const pendingHideVideoRef = useRef(false);

    const hideVideoSafely = () => {
        if (isFullScreenRef.current) {
            // 仍在全屏：先退出全屏，等 fullscreenchange 回调里再隐藏
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
        // 退出全屏时，如果视频已播放结束，再执行隐藏
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

    // 对应旧 onMounted：videoContext = uni.createVideoContext("productVideo", instance)
    useEffect(() => {
        videoContextRef.current = Taro.createVideoContext("productVideo");
    }, []);

    // 对应旧 computed playImg（v-bind(playImg) 转内联 style）
    const playImg = `url("${staticResource("product/video-playing.png")}")`;

    return (
        // 旧 .product-pic-con 的 height: v-bind(imageHeight) / padding: 0 v-bind(imageMarginCss) 转内联 style（原位于 scss 末条 .product-pic-con 规则）
        <View
            className="product-pic-con"
            style={{
                height: imageHeight,
                padding: `0 ${imageMarginCss}`,
                boxSizing: "border-box"
            }}
        >
            <View className="nav-bg" />
            {list.length > 0 ? (
                <View
                    className="product-bg"
                    style={{
                        // 原 scss：border-radius: v-bind(imageRadius)（.product-bg 规则内）
                        borderRadius: imageRadius
                    }}
                >
                    {/* 旧 swiper → Taro Swiper（旧裸标签选择器样式在 scss 中改挂 .main-swiper） */}
                    <Swiper className="main-swiper" indicatorDots={false} circular interval={3000} duration={500} onChange={swiperChange}>
                        {list.map((item, index) => (
                            <SwiperItem key={index}>
                                {!item.videoUrl ? (
                                    <View className="slide-image-box">
                                        <Image
                                            src={imageFormat(item.picLarge || pickPic(item))}
                                            className="slide-image"
                                            mode={imageDisplayMode as any}
                                            onClick={() => swiperImagePreview(index)}
                                        />
                                    </View>
                                ) : (
                                    <View className="video-box">
                                        {/* 旧 v-show → display 控制 */}
                                        <View
                                            className="cover-box"
                                            style={{ display: showVideo ? "none" : undefined }}
                                            onClick={handlePlayVideo}
                                        >
                                            <View className="slide-image-box">
                                                <Image
                                                    src={imageFormat(item.videoCover ? item.videoCover : item.picLarge || pickPic(item))}
                                                    mode={imageDisplayMode as any}
                                                    className="slide-image"
                                                />
                                            </View>

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
                            </SwiperItem>
                        ))}
                    </Swiper>
                    <View className="pages" style={{ display: list.length > 1 && !showVideo ? undefined : "none" }}>
                        {/* 原 scss 选择器 .product-bg .pages text（裸 text 标签）→ 类选择器 .pages-num 等价平移 */}
                        <Text className="pages-num">{currentPic}</Text>
                        /{list.length || 1}
                    </View>

                    {isOutSale ? <View className="outsale">{t("已售罄")}</View> : null}
                </View>
            ) : null}
        </View>
    );
}

import { useEffect, useMemo, useState } from "react";
import { Swiper, SwiperItem, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import Poster from "./Poster";

import "./PosterCard.scss";

interface Props {
    currentData?: any;
    activeType?: string;
    qrcodePath?: string;
}

const calculateProportionalHeight = (originalWidth: number, originalHeight: number, containerWidth = 260) => {
    const newHeight = (originalHeight * containerWidth) / originalWidth;
    return { width: containerWidth, height: newHeight };
};

/**
 * 海报卡片组件（自旧 pages/salesman/src/posterCard.vue 移植）
 * - 展示商品海报预览
 * - 生成并保存海报图片
 */
export default function PosterCard({ currentData = {}, activeType = "", qrcodePath = "" }: Props) {
    const [currentPicIndex, setCurrentPicIndex] = useState(0);
    const [picsHeight, setPicsHeight] = useState<number[]>([]);

    const getPicHeight = (src: string): Promise<number> => {
        return new Promise((resolve) => {
            Taro.getImageInfo({
                src,
                success: function (res) {
                    const { height } = calculateProportionalHeight(res.width, res.height);
                    resolve(Number(height));
                },
                fail: (err) => {
                    console.error(err);
                    resolve(0);
                }
            }).catch(() => resolve(0));
        });
    };

    // 旧 watch(() => props.currentData.pics, ..., { immediate: true })
    useEffect(() => {
        const pics = currentData?.pics;
        if (pics && pics.length) {
            pics.forEach(async (item: any, index: number) => {
                const height = await getPicHeight(imageFormat(item.picUrl));
                setPicsHeight((prev) => {
                    const next = [...prev];
                    next[index] = height;
                    return next;
                });
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentData?.pics]);

    const getMaxHeight = useMemo(() => {
        return Math.max(0, ...picsHeight) + 180;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [picsHeight]);

    const swiperChange = (e: any) => {
        setCurrentPicIndex(e.detail.current);
    };

    return (
        <View className="poster-card">
            <View className="poster-card-title">
                <View className="poster-card-title-img" style={{ backgroundImage: `url(${staticResource("salesman/salesmanzhiwen.png")})` }} />
                <Text>{t("长按保存到相册")}</Text>
            </View>
            <View className="poster-card-content">
                <View className="poster-swiper" style={{ height: `${getMaxHeight}px` }}>
                    <Swiper
                        indicatorDots={false}
                        previousMargin="100rpx"
                        nextMargin="100rpx"
                        circular
                        interval={3000}
                        duration={500}
                        style={{ height: "100%" }}
                        onChange={swiperChange}
                    >
                        {(currentData.pics || []).map((item: any, index: number) => (
                            <SwiperItem key={index}>
                                <View className={`poster-card-item${currentPicIndex === index ? " active" : ""}`}>
                                    <Poster
                                        id={`myCanvas${index}`}
                                        currentData={currentData}
                                        currentPic={item.picUrl}
                                        imgHeight={picsHeight[index]}
                                        activeType={activeType}
                                        qrcodePath={qrcodePath}
                                    />
                                </View>
                            </SwiperItem>
                        ))}
                    </Swiper>
                </View>
            </View>
        </View>
    );
}
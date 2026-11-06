import { useState } from "react";
import { Swiper, SwiperItem, Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    productId: number;
}

/**
 * 商品推荐轮播组件（自旧 pages/product/src/productSwiper.vue 移植）
 * - 底部推荐商品滑动展示
 * - 支持自动轮播
 * TODO(MIGRATION)：旧模板内为 uni-swiper-dot（uni-ui）mode="default" 圆点指示器，
 * 此处展开为 Taro Swiper + 自绘圆点行；点击圆点回跳 swiperDotIndex 的交互保留。
 */
export default function ProductSwiper({ productId: _productId }: Props) {
    const [swiperDotIndex, setSwiperDotIndex] = useState(0);
    const [current, setCurrent] = useState(0);
    // 旧 dotsStyles（uni-swiper-dot 的 dots-styles 配置）
    const dotsStyles = {
        backgroundColor: "rgba(255, 90, 95,0.3)",
        border: "1px rgba(255, 90, 95,0.3) solid",
        color: "#fff",
        selectedBackgroundColor: "rgba(255, 90, 95,0.9)",
        selectedBorder: "1px rgba(255, 90, 95,0.9) solid"
    };
    const info = [
        {
            colorClass: "uni-bg-red",
            url: "https://qiniu-web-assets.dcloud.net.cn/unidoc/zh/shuijiao.jpg",
            content: t("内容 A")
        },
        {
            colorClass: "uni-bg-green",
            url: "https://qiniu-web-assets.dcloud.net.cn/unidoc/zh/shuijiao.jpg",
            content: t("内容 B")
        }
    ];

    // 对应旧 click-item 事件（uni-swiper-dot 圆点点击）
    const clickItem = (e: number) => {
        setSwiperDotIndex(e);
    };
    const change = (e: any) => {
        setCurrent(e.detail.current);
    };

    return (
        <View className="product-card-row">
            <View className="product-title"> {t("浏览最终购买")} </View>
            <View className="product-swiper">
                <View className="uni-swiper-dot-box">
                    <Swiper className="swiper-box" current={swiperDotIndex} onChange={change}>
                        {info.map((item, index) => (
                            <SwiperItem key={index}>
                                <View className={`swiper-item swiper-item${index}`}>
                                    <Text style={{ color: "#fff", fontSize: "32px" }}>{index + 1}</Text>
                                </View>
                            </SwiperItem>
                        ))}
                    </Swiper>
                    {/* 旧 uni-swiper-dot mode="default"：底部居中圆点，选中项用 selectedBackgroundColor/selectedBorder */}
                    <View className="uni-swiper-dot__dots">
                        {info.map((_item, index) => (
                            <View
                                key={index}
                                className="uni-swiper-dot__dot"
                                style={{
                                    backgroundColor: current === index ? dotsStyles.selectedBackgroundColor : dotsStyles.backgroundColor,
                                    border: current === index ? dotsStyles.selectedBorder : dotsStyles.border
                                }}
                                onClick={() => clickItem(index)}
                            />
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
}

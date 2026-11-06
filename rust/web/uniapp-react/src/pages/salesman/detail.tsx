import { useEffect, useState } from "react";
import { Image, Swiper, SwiperItem, Text, View } from "@tarojs/components";
import Taro, { useRouter, useUnload } from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { salesmanProductDetail } from "@/api/salesman/salesman";
import type { SalesmanProductDetailItem } from "@/types/salesman/salesman";
import { staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import Share from "./src/Share";

import "./detail.scss";

/**
 * 推广商品详情页（自旧 pages/salesman/detail.vue 逐行移植）
 * - 展示推广商品详细信息
 * - 显示佣金比例和预估收益
 * - 提供分享推广功能
 */
export default function SalesmanDetail() {
    usePageGuards();

    const router = useRouter();
    const [detailData, setDetailData] = useState<SalesmanProductDetailItem>({} as SalesmanProductDetailItem);
    const [currentPic, setCurrentPic] = useState(1);
    const [showShare, setShowShare] = useState(false);

    const getSalesmanProductDetail = async (id: number) => {
        try {
            const result = await salesmanProductDetail(id);
            setDetailData(result);
        } catch (error) {
            console.error(error);
        }
    };

    // 旧 onLoad((options) => { if (options && options.id) ... })
    useEffect(() => {
        const id = router.params?.id;
        if (id) {
            void getSalesmanProductDetail(Number(id));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const swiperChange = (e: any) => {
        setCurrentPic(e.detail.current + 1);
    };

    const swiperImagePreview = (index: number) => {
        const images = (detailData.pics || []).map((item) => imageFormat(item.picUrl || ""));
        Taro.previewImage({
            current: images[index],
            urls: images
        });
    };

    const handleLink = (url: string) => {
        Taro.navigateTo({
            url
        });
    };

    // 关闭预览图片（旧 #ifdef H5 || APP；App 端待定，本批仅还原 H5）
    useUnload(() => {
        if (process.env.TARO_ENV === "h5") {
            (Taro as any).closePreviewImage?.();
        }
    });

    return (
        <View>
            <TigLayout title={t("推广商品")}>
                {detailData.pics ? (
                    <View className="salesman-pro-detail-imgs">
                        <View className="product-bg">
                            <Swiper indicatorDots={false} circular interval={3000} duration={500} onChange={swiperChange}>
                                {(detailData.pics || []).map((item, index) => (
                                    <SwiperItem key={index}>
                                        <Image
                                            mode="aspectFill"
                                            lazyLoad
                                            src={imageFormat(item.picUrl || "")}
                                            className="slide-image"
                                            onClick={() => swiperImagePreview(index)}
                                        />
                                    </SwiperItem>
                                ))}
                            </Swiper>
                            <View className="pages show">
                                <Text>{currentPic}</Text>
                                /{detailData.pics.length || 1}
                            </View>
                        </View>
                    </View>
                ) : null}
                <View className="salesman-pro-detail-info">
                    <View className="salesman-pro-detail-price">
                        <View className="salesman-pro-detail-price-num">
                            <FormatPrice priceData={detailData.productPrice} />
                        </View>
                        {Number(detailData.finalCommissionPrice) > 0 ? (
                            <View className="salesman-pro-detail-price-tip">
                                <Image className="price-tip-img" src={staticResource("salesman/priceTip.png")} />
                                <View className="salesman-pro-detail-price-tip-text">
                                    {t("预计可赚")} <FormatPrice base priceData={detailData.finalCommissionPrice} />
                                </View>
                            </View>
                        ) : null}
                    </View>
                    <View className="salesman-pro-detail-name">{detailData.productName}</View>
                </View>

                <FixedPlaceholder backgroundColor="#fff">
                    <View className="bottom-btns">
                        <View className="bottom-btn" onClick={() => handleLink(`/pages/product/index?id=${detailData.productId}`)}>
                            <View className="bottom-btn-text"> {t("立即购买")} </View>
                        </View>
                        <View className="bottom-btn special" onClick={() => setShowShare(true)}>
                            <View className="bottom-btn-text">
                                <View> {t("分享赚钱")}</View>
                                {Number(detailData.finalCommissionPrice) > 0 ? (
                                    <Text className="bottom-btn-text-tip">
                                        {t("分享后预计可赚")} <FormatPrice base priceData={detailData.finalCommissionPrice} />
                                    </Text>
                                ) : null}
                            </View>
                        </View>
                    </View>
                </FixedPlaceholder>

                <Share showShareCard={showShare} onChange={setShowShare} currentData={detailData} />
            </TigLayout>
        </View>
    );
}
import { useMemo } from "react";
import { RichText, ScrollView, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigImage from "@/components/tig/tig-image/TigImage";
import { useConfigStore } from "@/store/config";
import { useCurrencyStore } from "@/store/currency";
import { useI18nStore } from "@/store/i18n";
import { copy, isOverseas, staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./ImageTextCard.scss";

interface Props {
    currentData?: any;
    link?: string;
    onShowSaveImageTextCard?: () => void;
    onShowShareQrcode?: () => void;
    onClose?: () => void;
}

/**
 * 图文卡片组件（自旧 pages/salesman/src/imageTextCard.vue 移植）
 * - 展示商品图文分享内容
 * - 支持复制文案
 */
export default function ImageTextCard({
    currentData = {},
    link = "",
    onShowSaveImageTextCard,
    onShowShareQrcode,
    onClose
}: Props) {
    // 订阅语言，切换语言时重算文案
    const langCode = useI18nStore((s) => s.langCode);
    const dollarSignCn = useConfigStore((s) => s.dollarSignCn);
    const currentCurrencyData = useCurrencyStore((s) => s.currentCurrencyData);
    const currencyName = isOverseas() ? currentCurrencyData.name : dollarSignCn;

    const promoteText = useMemo(() => {
        return `??${t("现在下单超划算")}\n??${currentData.productName}\n??【${t("售价")}】${currentData.productPrice + currencyName} \n?? ${t(
            "购买链接"
        )}： ${link}`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentData, link, langCode, currencyName]);

    const sendShowSaveImageTextCard = () => {
        copy(promoteText, () => {
            onShowSaveImageTextCard?.();
        });
    };

    const menuList = useMemo(
        () => [
            {
                name: t("复制链接"),
                img: "salesman/salesmanCopy.png"
            },
            {
                name: t("二维码"),
                img: "salesman/salesmanQrcode.png"
            },
            {
                name: t("分销员中心"),
                img: "salesman/salesman.png"
            },
            {
                name: t("素材中心"),
                img: "salesman/salesmanMeterial.png"
            }
        ],
        [langCode]
    );

    const handleMenu = (index: number) => {
        switch (index) {
            case 0:
                copy(promoteText, () => {
                    onClose?.();
                });
                break;
            case 1:
                onShowShareQrcode?.();
                break;
            case 2:
                Taro.navigateTo({
                    url: "/pages/salesman/index"
                });
                break;
            case 3:
                Taro.navigateTo({
                    url: "/pages/salesman/material"
                });
                break;
        }

        if (index === 0)
            copy(promoteText, () => {
                onClose?.();
            });

        if (index === 1) onShowShareQrcode?.();
    };

    const imagePreview = (url: string) => {
        Taro.previewImage({
            urls: [imageFormat(url)]
        });
    };

    return (
        <View className="image-text-promote-main">
            <View className="image-text-promote-box">
                <RichText className="image-text-promote-text" nodes={promoteText} />
                <View className="image-text-promote-image">
                    <ScrollView scrollX>
                        <View className="image-text-promote-image-box">
                            {(currentData.pics || []).map((item: any) => (
                                <View key={item.picId} className="promote-image-item" onClick={() => imagePreview(item.picUrl)}>
                                    <TigImage src={item.picUrl} />
                                </View>
                            ))}
                        </View>
                    </ScrollView>

                    <View className="image-text-btn">
                        <View className="image-text-btn-box" onClick={sendShowSaveImageTextCard}>
                            <Text className="icon-xiazai" />
                            {t("保存图文")}
                        </View>
                    </View>
                </View>
            </View>

            <FixedPlaceholder height="180rpx" backgroundColor="#fff">
                <View className="bottom-menu">
                    {menuList.map((item, index) => (
                        <View key={index} className="bottom-menu-item" onClick={() => handleMenu(index)}>
                            <View className="item-image">
                                <TigImage src={staticResource(item.img)} />
                            </View>
                            <Text>{item.name}</Text>
                        </View>
                    ))}
                </View>
            </FixedPlaceholder>
        </View>
    );
}
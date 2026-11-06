import { useMemo, useState } from "react";
import { View } from "@tarojs/components";
import { Popup } from "@nutui/nutui-react-taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import { useI18nStore } from "@/store/i18n";
import { t } from "@/utils/i18n";

import ImageTextCard from "./ImageTextCard";
import PosterCard from "./PosterCard";

import "./ShareCard.scss";

interface Props {
    /** 对应旧 v-model */
    modelValue?: boolean;
    currentData?: any;
    link?: string;
    qrcodePath?: string;
    /** 对应旧 update:modelValue */
    onChange?: (value: boolean) => void;
    onShowSaveImageTextCard?: () => void;
    onShowShareQrcode?: () => void;
}

/**
 * 分享卡片组件（自旧 pages/salesman/src/shareCard.vue 移植）
 * - 切换图文分享和海报分享模式
 * - 弹窗展示分享内容
 */
export default function ShareCard({
    modelValue = false,
    currentData = {},
    link = "",
    qrcodePath = "",
    onChange,
    onShowSaveImageTextCard,
    onShowShareQrcode
}: Props) {
    const langCode = useI18nStore((s) => s.langCode);
    const [activeType, setActiveType] = useState("imageText");

    const menuList = useMemo(
        () => [
            {
                type: "imageText",
                name: t("推广图文")
            },
            {
                type: "poster",
                name: t("生成海报")
            }
        ],
        [langCode]
    );

    const handleMenu = (type: string) => {
        setActiveType(type);
    };

    const close = () => {
        setActiveType("imageText");
    };

    const handleClose = () => {
        close();
        onChange?.(false);
    };

    return (
        <Popup
            visible={modelValue}
            position="bottom"
            zIndex={999}
            closeable={false}
            style={{ backgroundColor: "#fff", borderRadius: "20rpx 20rpx 0 0" }}
            onClose={handleClose}
        >
            <View className="salesman-share-box">
                <View className="salesman-share-title">
                    {Number(currentData.finalCommissionPrice) > 0 ? t("分享后预计可赚") : t("立即分享给好友")}
                    {Number(currentData.finalCommissionPrice) > 0 ? <FormatPrice base priceData={currentData.finalCommissionPrice} /> : null}
                    <View className="share-close" onClick={handleClose} />
                </View>
                <View className="salesman-share-menu">
                    {menuList.map((item, index) => (
                        <View key={index} className="salesman-share-menu-item" onClick={() => handleMenu(item.type)}>
                            <View className="menu-item-text">
                                {item.name}
                                <View className={`menu-item-line${activeType === item.type ? " show" : ""}`} />
                            </View>
                        </View>
                    ))}
                </View>

                <View className="salesman-share-content">
                    <View style={{ height: "100%", display: activeType === "poster" ? "block" : "none" }}>
                        <PosterCard qrcodePath={qrcodePath} currentData={currentData} activeType={activeType} />
                    </View>
                    <View style={{ display: activeType === "imageText" ? "block" : "none" }}>
                        <ImageTextCard
                            currentData={currentData}
                            link={link}
                            onShowSaveImageTextCard={onShowSaveImageTextCard}
                            onShowShareQrcode={onShowShareQrcode}
                            onClose={handleClose}
                        />
                    </View>
                </View>
            </View>
        </Popup>
    );
}
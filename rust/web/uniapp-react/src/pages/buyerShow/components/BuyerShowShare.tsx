import { useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import { copy } from "@/utils";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";
import BuyerShowPoster from "./BuyerShowPoster";
import { buildBuyerShowShareUrl } from "../utils/share";

import "./BuyerShowShare.scss";

interface Props {
    /** 旧 v-model */
    modelValue: boolean;
    buyerShowId: string | number;
    content?: string;
    buyerName?: string;
    buyerPhoto?: string;
    cover?: string;
    onModelValueChange?: (value: boolean) => void;
}

/**
 * 分享文案中买家秀内容的最大长度（含末尾省略号），避免长文案被社交平台或输入框二次截断
 */
const MAX_SHARE_DESC_LENGTH = 150;

/**
 * 按字符数截断买家秀内容
 *
 * 用 Array.from 而非 slice 按码元切分，买家秀内容普遍含 emoji，
 * 按码元截断会切出半个代理对导致乱码字符。
 */
const truncateDesc = (text: string): string => {
    const chars = Array.from(text);
    if (chars.length <= MAX_SHARE_DESC_LENGTH) return text;
    return `${chars.slice(0, MAX_SHARE_DESC_LENGTH - 1).join("")}…`;
};

/**
 * 买家秀分享弹层（自旧 components/buyerShowShare.vue 移植）
 * - 旧 tig-popup → NutUI Popup（bottom）
 * - 生成海报走子组件 BuyerShowPoster
 */
export default function BuyerShowShare({ modelValue, buyerShowId, content, buyerName, buyerPhoto, cover, onModelValueChange }: Props) {
    const [showPoster, setShowPoster] = useState(false);
    const baseInfo = useConfigStore((s) => s.baseInfo);

    const emitModelValue = (value: boolean) => {
        onModelValueChange?.(value);
    };

    /**
     * 生成海报（参考商品海报）
     */
    const handlePoster = () => {
        emitModelValue(false);
        setShowPoster(true);
    };

    /**
     * 获取分享链接（H5 买家秀详情页链接，用于复制）
     */
    const getShareUrl = (): string => buildBuyerShowShareUrl(buyerShowId, baseInfo.h5Domain || "");

    /**
     * 分享文案中的买家秀描述：仅截断正文，无正文时回退「买家名的买家秀」
     */
    const getShareDesc = (): string => {
        if (content) return truncateDesc(content);
        return buyerName ? `${buyerName}${t("的买家秀")}` : t("买家秀");
    };

    /**
     * 构建分享文案：【店名】链接 「内容/买家秀」（店名和链接始终完整，只截正文）
     */
    const buildShareText = (url: string): string => {
        const shopName = baseInfo.shopTitle || "";
        return `【${shopName}】${url} 「${getShareDesc()}」`;
    };

    /**
     * 复制链接
     */
    const handleCopy = () => {
        emitModelValue(false);
        const shareUrl = getShareUrl();
        if (!shareUrl) {
            Taro.showToast({
                title: t("未配置分享域名"),
                icon: "none"
            });
            return;
        }
        const shareText = buildShareText(shareUrl);
        copy(shareText, () => {
            Taro.showToast({
                title: t("复制成功"),
                icon: "none"
            });
        });
    };

    return (
        <View className="buyer-show-share">
            <Popup
                visible={modelValue}
                position="bottom"
                round
                closeable={false}
                onClose={() => emitModelValue(false)}
                style={{ backgroundColor: "#fff", borderRadius: "20rpx 20rpx 0 0" }}
            >
                <View className="share-title">{t("分享")}</View>
                <View className="share-content">
                    <View className="share-item" onClick={handleCopy}>
                        <Text className="iconfont-h5 icon-link" />
                        <Text className="share-item-text">{t("复制链接")}</Text>
                    </View>
                    <View className="share-item" onClick={handlePoster}>
                        <Text className="iconfont-h5 icon-tupian" />
                        <Text className="share-item-text">{t("生成海报")}</Text>
                    </View>
                </View>
            </Popup>
            {showPoster && (
                <BuyerShowPoster
                    modelValue={showPoster}
                    buyerShowId={buyerShowId}
                    buyerName={buyerName}
                    buyerPhoto={buyerPhoto}
                    content={content}
                    cover={cover}
                    onModelValueChange={setShowPoster}
                />
            )}
        </View>
    );
}
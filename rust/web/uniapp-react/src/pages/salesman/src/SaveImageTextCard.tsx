import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigImage from "@/components/tig/tig-image/TigImage";
import { getDownloadFileInfo, isUrl, saveImageToAlbum } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./SaveImageTextCard.scss";

interface Props {
    /** 对应旧 v-model */
    modelValue?: boolean;
    currentData?: any;
    /** 对应旧 update:modelValue */
    onChange?: (value: boolean) => void;
}

/**
 * 保存图文卡片组件（自旧 pages/salesman/src/saveImageTextCard.vue 移植）
 * - 保存图文素材到本地
 * - 下载图片到相册
 */
export default function SaveImageTextCard({ modelValue = false, currentData = {}, onChange }: Props) {
    const swiperImagePreview = (index: number) => {
        const images = (currentData.pics || []).map((item: any) => imageFormat(item.picUrl || ""));
        Taro.previewImage({
            current: images[index],
            urls: images
        });
    };

    const handleSave = (src: string) => {
        // #ifndef H5
        if (process.env.TARO_ENV === "h5") return;
        const srcFormat = imageFormat(src);
        Taro.showModal({
            title: t("提示"),
            content: t("确定要保存图片吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: async (res) => {
                if (!res.confirm) return;
                if (isUrl(srcFormat)) {
                    const result = await getDownloadFileInfo(srcFormat);
                    if (result.statusCode === 200) {
                        saveImageToAlbum(result.tempFilePath)
                            .then(() => {
                                Taro.showToast({
                                    title: t("保存成功"),
                                    icon: "none"
                                });
                            })
                            .catch((err) => {
                                Taro.showToast({
                                    title: t("保存失败"),
                                    icon: "none"
                                });
                                console.error(err);
                            });
                    }
                }
            }
        });
        // #endif
    };

    return (
        <Popup
            visible={modelValue}
            position="bottom"
            zIndex={999}
            closeable={false}
            style={{ backgroundColor: "#fff" }}
            onClose={() => onChange?.(false)}
        >
            <View className="share-popup">
                <View className="share-cube">
                    <View className="share-cube-tip">
                        <View>
                            <View className="icon-dagou" />
                            {t("文案/链接已复制")}
                        </View>
                    </View>
                    <View className="share-cube-desc">{t("依次长按以下图片保存到相册")}</View>
                    <View className="share-cube-img">
                        {(currentData.pics || []).map((item: any, index: number) => (
                            <View key={index} className="share-cube-img-item" onClick={() => swiperImagePreview(index)}>
                                <TigImage src={item.picUrl} mode="widthFix" />
                            </View>
                        ))}
                    </View>
                </View>
                <FixedPlaceholder height="100rpx" backgroundColor="#fff">
                    <View className="share-cube-btn" onClick={() => onChange?.(false)}>
                        {t("我知道了")}
                    </View>
                </FixedPlaceholder>
            </View>
        </Popup>
    );
}
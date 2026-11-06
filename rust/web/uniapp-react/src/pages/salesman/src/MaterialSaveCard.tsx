import { ScrollView, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigImage from "@/components/tig/tig-image/TigImage";
import { getDownloadFileInfo, isUrl, saveImageToAlbum, staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./MaterialSaveCard.scss";

interface Props {
    /** 对应旧 v-model */
    modelValue?: boolean;
    currentPics?: any[];
    /** 对应旧 update:modelValue */
    onChange?: (value: boolean) => void;
}

/**
 * 素材保存卡片组件（自旧 pages/salesman/src/materialSaveCard.vue 移植）
 * - 展示素材详情并提供保存功能
 * - 支持图片和视频素材
 */
export default function MaterialSaveCard({ modelValue = false, currentPics = [], onChange }: Props) {
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
            <View
                className="share-cube"
                style={{ backgroundImage: `url(${staticResource("salesman/materialPopup.png")})` }}
            >
                <ScrollView className="list-box" scrollX>
                    <View className="list-content">
                        {(currentPics || []).map((item: any) => (
                            <View key={item.picId} className="list-item" onLongPress={() => handleSave(item.picUrl)}>
                                <TigImage src={item.picUrl} />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>
            <FixedPlaceholder height="100rpx" backgroundColor="#fff">
                <View className="share-cube-btn" onClick={() => onChange?.(false)}>
                    {t("我知道了")}
                </View>
            </FixedPlaceholder>
        </Popup>
    );
}
import { Image, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import { saveImageToAlbum } from "@/utils";
import { t } from "@/utils/i18n";

import "./ShareQrcode.scss";

interface Props {
    /** 对应旧 v-model */
    modelValue?: boolean;
    link?: string;
    qrcodePath?: string;
    /** 对应旧 update:modelValue */
    onChange?: (value: boolean) => void;
}

/**
 * 分享二维码组件（自旧 pages/salesman/src/shareQrcode.vue 移植）
 * - 展示推广二维码图片
 * - 支持保存到相册
 * - 旧 tig-popup → NutUI Popup
 */
export default function ShareQrcode({ modelValue = false, link = "", qrcodePath = "", onChange }: Props) {
    void link;

    const handleSave = () => {
        Taro.showModal({
            title: t("提示"),
            content: t("确定要保存二维码吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: function (res) {
                if (!res.confirm) return;
                // 保存本地
                if (process.env.TARO_ENV === "h5") {
                    Taro.previewImage({
                        urls: [qrcodePath]
                    });
                    return;
                }
                saveImageToAlbum(qrcodePath)
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
        });
    };

    return (
        <Popup
            visible={modelValue}
            position="center"
            zIndex={999}
            closeable={false}
            style={{ backgroundColor: "#fff" }}
            onClose={() => onChange?.(false)}
        >
            <View className="qrcode-box" onLongPress={handleSave}>
                <Image src={qrcodePath} mode="aspectFit" style={{ width: "245px", height: "245px" }} />
                <View className="qrcode-tip">{t("长按图片保存至相册")}</View>
            </View>
        </Popup>
    );
}
import { useRef } from "react";
import type { ReactNode } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { useConfigStore } from "@/store/config";
import { baseUrl, getSecret } from "@/utils/request";
import { t } from "@/utils/i18n";

interface Props {
    /** 可选图片数量（旧 count，默认 1） */
    count?: number;
    /** 旧 modelValue（多图时为字符串数组） */
    modelValue?: string | string[];
    /** 旧 @update:modelValue */
    onModelValueChange?: (value: string | string[]) => void;
    /** 上传接口地址（相对 API 前缀） */
    requestUrl?: string;
    /** 旧 @change：单图上传成功后回调 */
    onChange?: () => void;
    children?: ReactNode;
}

/**
 * 图片上传容器（自旧 components/tig/tig-upload/tig-upload.vue 移植）
 * - 点击透传子元素（头像/占位图）触发 uni.chooseImage
 * - uni.uploadFile → Taro.uploadFile，鉴权头与 Secret 同旧实现
 * - count > 1 时累计路径并通过 onModelValueChange 回写，否则仅触发 onChange
 */
export default function TigUpload({ count = 1, modelValue: _modelValue = "", onModelValueChange, requestUrl = "user/user/uploadImg", onChange, children }: Props) {
    void _modelValue;
    const XClientType = useConfigStore((s) => s.XClientType);
    const filesRef = useRef<string[]>([]);

    const handleChoose = () => {
        Taro.chooseImage({
            count,
            success: async (res: any) => {
                Taro.showLoading({ title: t("上传中...") });
                res.tempFilePaths.forEach((file: string) => {
                    Taro.uploadFile({
                        url: baseUrl + process.env.TARO_APP_API_PREFIX + requestUrl,
                        filePath: file,
                        name: "file",
                        header: {
                            Authorization: Taro.getStorageSync("token"),
                            "X-Client-Type": XClientType,
                            Secret: getSecret()
                        },
                        success: (uploadFileRes) => {
                            Taro.hideLoading();

                            let result: { code?: number; message?: string; data?: any } | null = null;
                            try {
                                result = JSON.parse(uploadFileRes.data);
                            } catch (error) {
                                console.error("上传响应解析失败:", error, uploadFileRes.data);
                            }

                            if (result?.code !== 0) {
                                Taro.showToast({
                                    title: result?.message || t("图片上传失败"),
                                    icon: "none"
                                });
                                return;
                            }

                            if (count > 1) {
                                filesRef.current.push(result.data);
                                onModelValueChange?.(filesRef.current);
                            } else {
                                Taro.showToast({ title: t("图片上传成功") });
                                onChange?.();
                            }
                        },
                        fail: (error) => {
                            console.error(error);
                            Taro.hideLoading();
                            Taro.showToast({ title: t("图片上传失败"), icon: "none" });
                        }
                    });
                });
            },
            fail: (error) => {
                console.error(error);
                Taro.showToast({ title: t("图片选择失败"), icon: "none" });
            }
        });
    };

    return (
        <View className="upload-host-MjI4MnFyenY" style={{ height: "inherit", width: "inherit" }} onClick={handleChoose}>
            {children}
        </View>
    );
}
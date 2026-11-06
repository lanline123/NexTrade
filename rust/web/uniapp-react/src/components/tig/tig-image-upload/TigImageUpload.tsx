import { useRef } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { baseUrl, getSecret } from "@/utils/request";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./TigImageUpload.scss";

export interface ImageUploadItem {
    name?: string;
    extname?: string;
    url: string;
    picName?: string;
    picThumb?: string;
    picUrl?: string;
}

interface Props {
    /** 最多可上传数量（旧 upload / uni-file-picker 的 limit） */
    limit?: number;
    /** 旧 v-model：已上传图片列表 */
    modelValue?: ImageUploadItem[];
    /** 旧 @update:modelValue */
    onModelValueChange?: (list: ImageUploadItem[]) => void;
    /** 单张上传成功（旧 leaveMessage 用它同步 form.returnPic） */
    onUploaded?: (item: ImageUploadItem) => void;
    /** 删除某张（旧 up-upload @delete） */
    onDelete?: (index: number) => void;
    /** 上传接口（相对 API 前缀） */
    requestUrl?: string;
    /** 上传按钮图标：旧 up-upload 为加号，uni-file-picker 为相机 */
    trigger?: "camera" | "plus";
}

/**
 * 多图上传（自旧 components/upload/index.vue 与 uni-file-picker 用法移植）：
 * - 图片九宫格预览、点击预览大图、右上角删除
 * - 逐张上传 user/user/uploadImg，鉴权头与旧实现一致（Authorization + Secret）
 * - 上传成功回写 { picName, picThumb, picUrl, url }，与旧 upload 组件返回值一致
 */
export default function TigImageUpload({
    limit = 1,
    modelValue = [],
    onModelValueChange,
    onUploaded,
    onDelete,
    requestUrl = "user/user/uploadImg",
    trigger = "camera"
}: Props) {
    const listRef = useRef<ImageUploadItem[]>(modelValue);
    listRef.current = modelValue;

    const uploadFile = (filePath: string) => {
        Taro.uploadFile({
            url: baseUrl + process.env.TARO_APP_API_PREFIX + requestUrl,
            filePath,
            name: "file",
            header: {
                Authorization: Taro.getStorageSync("token"),
                Secret: getSecret()
            },
            success: (uploadFileRes) => {
                let result: { code?: number; message?: string; data?: any } | null = null;
                try {
                    result = JSON.parse(uploadFileRes.data);
                } catch (error) {
                    console.error("上传响应解析失败:", error, uploadFileRes.data);
                }
                if (uploadFileRes.statusCode < 200 || uploadFileRes.statusCode >= 300 || result?.code !== 0 || !result?.data) {
                    Taro.showToast({
                        title: result?.message || t("图片上传失败"),
                        icon: "none"
                    });
                    return;
                }
                const data = result.data;
                const item: ImageUploadItem = {
                    name: data.picName,
                    extname: String(data.picUrl || "").split(".")[1],
                    url: imageFormat(data.picThumb),
                    picName: data.picName,
                    picThumb: data.picThumb,
                    picUrl: data.picUrl
                };
                const next = [...listRef.current, item];
                listRef.current = next;
                onModelValueChange?.(next);
                onUploaded?.(item);
                Taro.showToast({
                    title: t("图片上传成功")
                });
            },
            fail: (error) => {
                console.error(error);
                Taro.showToast({
                    title: t("图片上传失败"),
                    icon: "none"
                });
            }
        });
    };

    const handleChoose = () => {
        const remain = limit - listRef.current.length;
        if (remain <= 0) {
            Taro.showToast({
                title: t("最多上传{0}张", { 0: limit }),
                icon: "none"
            });
            return;
        }
        Taro.chooseImage({
            count: remain,
            sizeType: ["original", "compressed"],
            success: (res) => {
                res.tempFilePaths.forEach((filePath) => uploadFile(filePath));
            },
            fail: (error) => {
                console.error(error);
                Taro.showToast({
                    title: t("图片选择失败"),
                    icon: "none"
                });
            }
        });
    };

    const handleDelete = (index: number) => {
        const next = listRef.current.filter((_item, i) => i !== index);
        listRef.current = next;
        onModelValueChange?.(next);
        onDelete?.(index);
    };

    const handlePreview = (index: number) => {
        const urls = listRef.current.map((item) => item.url).filter(Boolean);
        if (!urls.length) return;
        Taro.previewImage({
            urls,
            current: urls[index]
        });
    };

    return (
        <View className="tig-image-upload">
            {modelValue.map((item, index) => (
                <View className="tig-image-upload__item" key={`${item.picName || item.url}-${index}`}>
                    <Image className="tig-image-upload__img" src={item.url} mode="aspectFill" onClick={() => handlePreview(index)} />
                    <View className="tig-image-upload__delete" onClick={() => handleDelete(index)}>
                        <Text className="tig-image-upload__delete-icon">×</Text>
                    </View>
                </View>
            ))}
            {modelValue.length < limit && (
                <View className="tig-image-upload__trigger" onClick={handleChoose}>
                    {trigger === "camera" ? (
                        <Text className="iconfont-h5 icon-camera tig-image-upload__camera" />
                    ) : (
                        <Text className="tig-image-upload__plus">+</Text>
                    )}
                </View>
            )}
        </View>
    );
}
import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { baseUrl, getSecret } from "@/utils/request";

import "./Upload.scss";

export interface UploadItem {
    picName?: string;
    picThumb?: string;
    picUrl?: string;
    url?: string;
    [key: string]: any;
}

interface Props {
    /** 最多上传数量（旧 limit，默认 1） */
    limit?: number;
    /** 上传接口（相对 API 前缀） */
    apiUrl?: string;
    /** 旧 v-model：已上传数据（数组或单个对象） */
    modelValue?: UploadItem | UploadItem[];
    /** 旧 @update:modelValue */
    onModelValueChange?: (value: UploadItem | UploadItem[]) => void;
    /** 单文件也回传数组（旧 is-value-array） */
    isValueArray?: boolean;
    /** 自定义触发插槽（旧 is-custom） */
    isCustom?: boolean;
    /** 接口返回结构：gallery 为图片对象；url 为纯地址字符串 */
    responseDataType?: "gallery" | "url";
    /** 是否允许选择 PDF（H5 文件选择器；小程序操作菜单） */
    allowPdf?: boolean;
    /** 单文件大小上限（MB，默认 20） */
    maxSize?: number;
    /** 旧 @uploading-change */
    onUploadingChange?: (uploading: boolean) => void;
    children?: ReactNode;
}

interface FileItem {
    url: string;
    type?: string;
}

const isPdfFile = (file: any) => /\.pdf$/i.test(file?.name || "") || file?.type === "application/pdf";

/**
 * 上传组件（自旧 components/upload/index.vue 逐行移植）
 * - up-upload → 自绘九宫格：缩略图预览 + 右上角删除 + 触发块
 * - uni.uploadFile → Taro.uploadFile，鉴权头/Secret 与旧实现一致
 * - 支持单对象 / 数组两种 v-model；responseDataType=url 时兼容营业执照接口
 * - allowPdf：H5 用 input[type=file]，微信小程序用 chooseMessageFile（操作菜单）
 */
export default function Upload({
    limit = 1,
    apiUrl = "user/user/uploadImg",
    modelValue = [],
    onModelValueChange,
    isValueArray = false,
    isCustom = false,
    responseDataType = "gallery",
    allowPdf = false,
    maxSize = 20,
    onUploadingChange,
    children
}: Props) {
    const [fileLists, setFileLists] = useState<FileItem[]>([]);
    // 旧 picsData：数组模式下累计回传值
    const picsRef = useRef<UploadItem[]>([]);

    const maxFileSize = () => maxSize * 1024 * 1024;
    const sizeExceededTip = () => (maxSize === 20 ? t("图片大小不能超过20MB") : `${t("文件大小不能超过")}${maxSize}MB`);

    // 对应旧 watch(() => props.modelValue, ..., { immediate: true, deep: true })
    useEffect(() => {
        const newVal: any = modelValue;
        if (!newVal) return;
        if (Array.isArray(newVal)) {
            if (newVal.length === 0) {
                setFileLists([]);
                picsRef.current = [];
                return;
            }
            setFileLists(newVal.map((item: UploadItem) => ({ ...item, type: "image", url: imageFormat(item.picUrl as string) })));
            picsRef.current = newVal as UploadItem[];
            return;
        }
        if (Object.values(newVal).length === 0 || !Object.values(newVal)[0]) {
            return;
        }
        setFileLists([{ ...newVal, type: "image", url: imageFormat(newVal.picUrl) }]);
    }, [modelValue]);

    const pushResult = (normalized: UploadItem, fileName?: string) => {
        const url = normalized.picThumb;
        setFileLists((prev) => [...prev, { type: "image", url: imageFormat(url as string) }]);

        if (limit > 1 || isValueArray) {
            const next = [
                ...(picsRef.current || []),
                {
                    picName: normalized.picName,
                    picThumb: normalized.picThumb,
                    picUrl: normalized.picUrl,
                    ...(normalized.url ? { url: normalized.url } : {})
                }
            ];
            picsRef.current = next;
            onModelValueChange?.(next);
        } else {
            onModelValueChange?.({
                picName: normalized.picName ?? fileName,
                picThumb: normalized.picThumb,
                picUrl: normalized.picUrl,
                ...(normalized.url ? { url: normalized.url } : {})
            });
        }
    };

    const uploadFile = (filePath: { url?: string; name?: string }) => {
        if (!filePath.url) return;
        const token = Taro.getStorageSync("token") || "";
        onUploadingChange?.(true);
        Taro.uploadFile({
            url: baseUrl + process.env.TARO_APP_API_PREFIX + apiUrl,
            filePath: filePath.url,
            name: "file",
            header: {
                Authorization: responseDataType === "url" ? "Bearer " + token : token,
                Secret: getSecret()
            },
            success: (uploadFileRes) => {
                onUploadingChange?.(false);
                Taro.hideLoading();
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
                const { data } = result;
                const normalizedData: UploadItem =
                    responseDataType === "url"
                        ? {
                              picName: filePath.name || "营业执照",
                              picThumb: data,
                              picUrl: data,
                              url: data
                          }
                        : data;
                pushResult(normalizedData, filePath.name);
                Taro.showToast({
                    title: t("图片上传成功")
                });
            },
            fail: () => {
                onUploadingChange?.(false);
                Taro.hideLoading();
                Taro.showToast({
                    title: t("图片上传失败"),
                    icon: "none"
                });
            }
        });
    };

    const handlePicSelect = (files: { url?: string; size?: number; name?: string }[]) => {
        const validFiles = files.filter((file) => {
            if (typeof file?.size !== "number" || file.size <= maxFileSize()) return true;
            Taro.showToast({
                title: sizeExceededTip(),
                icon: "none"
            });
            return false;
        });
        if (validFiles.length === 0) return;
        if (validFiles.some(isPdfFile)) Taro.showLoading({ title: t("上传中"), mask: true });
        if (validFiles.length === 1 || limit === 1) {
            uploadFile(validFiles[0]);
        } else {
            validFiles.forEach((item) => uploadFile(item));
        }
    };

    /** H5：input[type=file] 选择图片（allowPdf 时含 PDF） */
    const chooseByH5Input = () => {
        if (typeof document === "undefined") return;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = allowPdf ? ".jpg,.jpeg,.png,.bmp,.pdf" : "image/*";
        input.multiple = limit > 1;
        input.onchange = () => {
            const files = Array.from(input.files || []).map((file) => ({
                url: URL.createObjectURL(file),
                name: file.name,
                size: file.size
            }));
            handlePicSelect(files);
        };
        input.click();
    };

    const chooseImages = () => {
        Taro.chooseImage({
            count: Math.min(9, Math.max(1, limit - fileLists.length)),
            sizeType: ["original", "compressed"],
            success: (res: any) => {
                const files = (res.tempFiles || res.tempFilePaths || []).map((file: any) =>
                    typeof file === "string" ? { url: file } : { url: file.path, size: file.size, name: file.name }
                );
                handlePicSelect(files);
            }
        });
    };

    const handlePdfSelect = () => {
        // 微信小程序：从聊天记录选择 PDF
        Taro.chooseMessageFile({
            count: 1,
            type: "file",
            extension: ["pdf"],
            success: ({ tempFiles }) => {
                const file: any = tempFiles[0];
                // 开发者工具中 extension 过滤不生效（真机有效），选择后仍按扩展名兜底校验
                if (file && !/\.pdf$/i.test(file.name || "")) {
                    Taro.showToast({ title: t("请选择PDF文件"), icon: "none" });
                    return;
                }
                if (typeof file?.size === "number" && file.size > maxFileSize()) {
                    Taro.showToast({ title: sizeExceededTip(), icon: "none" });
                    return;
                }
                Taro.showLoading({ title: t("上传中"), mask: true });
                uploadFile({ url: file?.path, name: file?.name });
            }
        });
    };

    const handleChoose = () => {
        if (process.env.TARO_ENV === "h5") {
            if (allowPdf) {
                chooseByH5Input();
                return;
            }
            chooseImages();
            return;
        }
        if (!allowPdf) {
            chooseImages();
            return;
        }
        Taro.showActionSheet({
            itemList: [t("拍照"), t("从相册选择"), t("选择PDF文件")],
            success: ({ tapIndex }) => {
                if (tapIndex === 2) {
                    handlePdfSelect();
                    return;
                }
                Taro.chooseImage({
                    count: Math.min(9, Math.max(1, limit - fileLists.length)),
                    sizeType: ["original", "compressed"],
                    sourceType: [tapIndex === 0 ? "camera" : "album"],
                    success: (res: any) => {
                        const files = (res.tempFiles || []).map((file: any) => ({ url: file.path, size: file.size, name: file.name }));
                        handlePicSelect(files);
                    }
                });
            }
        });
    };

    const handlePicDelete = (index: number) => {
        setFileLists((prev) => {
            const next = [...prev];
            next.splice(index, 1);
            return next;
        });
        if (limit > 1 || isValueArray) {
            const next = [...(picsRef.current || [])];
            next.splice(index, 1);
            picsRef.current = next;
            onModelValueChange?.(next);
        } else {
            picsRef.current = [];
            onModelValueChange?.({ picName: "", picThumb: "", picUrl: "" });
        }
    };

    return (
        <View className="upload">
            <View className="upload-grid">
                {fileLists.map((file, index) => (
                    <View className="upload-item" key={`${file.url}-${index}`}>
                        <Image
                            className="upload-item-img"
                            src={file.url}
                            mode="aspectFill"
                            onClick={() => {
                                Taro.previewImage({
                                    urls: fileLists.map((item) => item.url),
                                    current: file.url
                                });
                            }}
                        />
                        <View
                            className="upload-item-delete"
                            onClick={(event) => {
                                event.stopPropagation();
                                handlePicDelete(index);
                            }}
                        >
                            ×
                        </View>
                    </View>
                ))}
                {fileLists.length < limit && (
                    <View className="upload-trigger" onClick={handleChoose}>
                        {isCustom && children ? children : allowPdf ? <Text className="iconfont-h5 icon-camera upload-camera" /> : <Text className="upload-plus">＋</Text>}
                    </View>
                )}
            </View>
        </View>
    );
}
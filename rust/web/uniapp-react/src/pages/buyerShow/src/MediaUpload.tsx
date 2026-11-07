import { useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { requestPhotosPermission } from "@/utils/appPermission";
import { isH5Shell } from "@/utils/nativeBridge";
import { baseUrl, getSecret } from "@/utils/request";

import "./MediaUpload.scss";

export interface MediaItem {
    type: "image" | "video";
    videoUrl?: string;
    videoCover?: string;
    picUrl?: string;
    picId?: number;
    url?: string;
    /** 本地预览地址；上传完成后保留，避免远程地址切换时出现空白闪烁 */
    previewUrl?: string;
    progress?: number;
    uploading?: boolean;
    uploadId?: string;
}

interface Props {
    /** 旧 v-model:media-list */
    mediaList: MediaItem[];
    onMediaListChange?: (list: MediaItem[]) => void;
    multiple?: boolean;
    maxCount?: number;
    cols?: number;
    imgApiUrl?: string;
    videoApiUrl?: string;
    mediaType?: "image" | "video" | "all";
    uploadTip?: string;
    /** 视频数量上限；0 表示不限制 */
    maxVideoCount?: number;
    /** 图片缩略图裁剪模式，默认按宽度等比缩放 */
    imageMode?: string;
}

/**
 * 图片/视频上传（自旧 components/upload/UploadMedia.vue 平移的核心链路）
 * - H5 走动态 input[type=file]，非 H5 走 Taro.chooseMedia（失败降级 chooseImage/chooseVideo）
 * - 上传接口与旧版一致：user/user/uploadImg、user/user/uploadVideo
 * - 视频数量上限、上传进度、上传中删除中止均保留
 * - 旧 App 相册权限申请已接 H5 壳桥（utils/appPermission，requestPhotosPermission）
 */
export default function MediaUpload({
    mediaList,
    onMediaListChange,
    multiple = true,
    maxCount = 9,
    cols = 3,
    imgApiUrl = "user/user/uploadImg",
    videoApiUrl = "user/user/uploadVideo",
    mediaType = "all",
    uploadTip = "",
    maxVideoCount = 0,
    imageMode = "widthFix"
}: Props) {
    const uploadTasks = useRef<Map<string, any>>(new Map());
    const cancelledUploads = useRef<Set<string>>(new Set());
    const listRef = useRef<MediaItem[]>(mediaList || []);
    const [list, setList] = useState<MediaItem[]>(mediaList || []);

    const updateList = (next: MediaItem[]) => {
        listRef.current = next;
        setList(next);
        onMediaListChange?.(next);
    };

    const videoCount = list.filter((item) => item.type === "video").length;

    /** 中文文案中的数量用汉字表述，如 1 → 一 */
    const CN_NUMBERS = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    const cnCount = (count: number) => CN_NUMBERS[count] ?? count;
    const maxVideoTip = (count: number) => t("最多上传{0}个视频", { 0: cnCount(count) });

    /**
     * 依据 maxVideoCount 筛选本次选择：超出视频配额的视频项丢弃并提示，图片不受影响。
     * maxVideoCount 为 0 时不限制，原样返回。
     */
    const limitVideoCount = <T extends { fileType: string }>(batch: T[]): T[] => {
        if (!maxVideoCount) return batch;
        let quota = maxVideoCount - videoCount;
        const kept: T[] = [];
        let dropped = false;
        batch.forEach((item) => {
            if (item.fileType !== "video") {
                kept.push(item);
                return;
            }
            if (quota > 0) {
                quota -= 1;
                kept.push(item);
            } else {
                dropped = true;
            }
        });
        if (dropped) {
            Taro.showToast({ title: maxVideoTip(maxVideoCount), icon: "none" });
        }
        return kept;
    };

    const validateFileType = (mimeType: string): string => {
        if (mimeType.startsWith("image/")) return "image";
        if (mimeType.startsWith("video/")) return "video";
        return "unknown";
    };

    // 选择媒体文件的主方法
    const chooseMedia = async () => {
        if (process.env.TARO_ENV === "h5") {
            createFileInput();
            return;
        }
        // 旧 #ifdef APP-PLUS：先申请相册权限（H5 壳桥实现；iOS 由系统在 chooseImage 时弹窗，桥端放行）
        if (isH5Shell()) {
            try {
                const hasPhotosPermission = await requestPhotosPermission();
                if (!hasPhotosPermission) {
                    Taro.showToast({ title: t("需要相册权限才能选择图片"), icon: "none" });
                    return;
                }
            } catch (error) {
                console.error("权限请求失败:", error);
                Taro.showToast({ title: t("权限请求失败"), icon: "none" });
                return;
            }
        }
        chooseMediaNative();
    };

    // H5 平台通过动态创建 input 实现文件选择
    const createFileInput = () => {
        if (typeof document === "undefined") return;
        const input = document.createElement("input");
        input.type = "file";
        input.accept = mediaType === "image" ? "image/*" : mediaType === "video" ? "video/*" : "image/*,video/*";
        input.multiple = Boolean(multiple);
        input.style.display = "none";
        input.onchange = (event: Event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                processH5Files(Array.from(target.files));
            }
            if (input.parentNode) {
                input.parentNode.removeChild(input);
            }
        };
        document.body.appendChild(input);
        input.click();
    };

    // 处理 H5 平台选择的文件
    const processH5Files = (files: File[]) => {
        const remainingSlots = maxCount - list.length;
        if (remainingSlots <= 0) {
            Taro.showToast({
                title: `${t("限制上传")}${maxCount}${t("个数")}`,
                icon: "none"
            });
            return;
        }
        const filesToProcess = files.slice(0, remainingSlots).map((file) => ({ file, fileType: validateFileType(file.type) }));
        if (filesToProcess.some((item) => item.fileType === "unknown")) {
            Taro.showToast({
                title: t("不支持的文件类型"),
                icon: "none"
            });
        }
        limitVideoCount(filesToProcess.filter((item) => item.fileType !== "unknown")).forEach(({ file, fileType }) => {
            // 生成预览 URL
            const previewUrl = URL.createObjectURL(file);
            uploadFile(previewUrl, fileType, file);
        });
    };

    // 非 H5 平台使用 Taro.chooseMedia
    const chooseMediaNative = () => {
        if (list.length > maxCount) {
            Taro.showToast({
                title: `${t("限制上传")}${maxCount}${t("个数")}`,
                icon: "none"
            });
            return;
        }
        Taro.chooseMedia({
            count: maxCount - list.length,
            mediaType: mediaType === "image" ? ["image"] : mediaType === "video" ? ["video"] : ["image", "video"],
            sourceType: ["album", "camera"],
            maxDuration: 60,
            camera: "back",
            success: (res) => {
                const batch = (res.tempFiles as any[]).map((file: any) => ({
                    file,
                    fileType: file.fileType,
                    path: file.tempFilePath
                }));
                limitVideoCount(batch).forEach((item) => uploadFile(item.path, item.fileType, item.file));
            },
            fail: (err) => {
                if (String(err.errMsg).includes("cancel")) return;
                // 降级处理
                Taro.showActionSheet({
                    itemList: ["选择图片", "选择视频"],
                    success: (res) => {
                        if (res.tapIndex === 0) chooseImage();
                        else chooseVideo();
                    }
                }).catch(() => {});
            }
        }).catch(() => {});
    };

    // 降级处理 - 选择图片
    const chooseImage = () => {
        Taro.chooseImage({
            count: 9 - list.length,
            sizeType: ["original", "compressed"],
            sourceType: ["album", "camera"],
            success: (res: any) => {
                res.tempFilePaths.forEach((path: string, index: number) => {
                    uploadFile(path, "image", res.tempFiles[index]);
                });
            }
        }).catch(() => {});
    };

    // 降级处理 - 选择视频
    const chooseVideo = () => {
        if (maxVideoCount && videoCount >= maxVideoCount) {
            Taro.showToast({ title: maxVideoTip(maxVideoCount), icon: "none" });
            return;
        }
        Taro.chooseVideo({
            sourceType: ["album", "camera"],
            compressed: true,
            maxDuration: 60,
            camera: "back",
            success: (res) => {
                uploadFile(res.tempFilePath, "video", (res as any).tempFile);
            }
        }).catch(() => {});
    };

    // 删除媒体文件
    const removeMedia = (index: number) => {
        const item = list[index];
        if (item?.uploading && item.uploadId) {
            cancelledUploads.current.add(item.uploadId);
            uploadTasks.current.get(item.uploadId)?.abort?.();
            uploadTasks.current.delete(item.uploadId);
        }
        const next = [...list];
        next.splice(index, 1);
        updateList(next);
    };

    const uploadFile = (filePath: any, fileType: string, file?: File) => {
        // H5 File 提供 MIME 类型；小程序选择接口返回的临时文件不提供该字段。
        if (process.env.TARO_ENV === "h5" && fileType === "image" && !/\/(png|jpe?g|gif|webp|tiff)$/i.test(file?.type ?? "")) {
            Taro.showToast({
                title: t("不支持上传此文件格式"),
                icon: "none"
            });
            return;
        }
        const type = fileType as MediaItem["type"];
        const uploadId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const uploadingItem: MediaItem = {
            type,
            url: filePath,
            progress: 0,
            uploading: true,
            uploadId
        };
        updateList([...listRef.current, uploadingItem]);

        const findUploadingIndex = (source: MediaItem[]) => source.findIndex((item) => item.uploadId === uploadId);

        const uploadTask = Taro.uploadFile({
            url: `${baseUrl}${process.env.TARO_APP_API_PREFIX || ""}${fileType === "image" ? imgApiUrl : videoApiUrl}`,
            filePath,
            name: "file",
            header: {
                Authorization: "Bearer " + Taro.getStorageSync("token"),
                Secret: getSecret()
            },
            // 视频需要此操作
            formData: {
                file: file as any
            },
            success: (uploadFileRes: any) => {
                uploadTasks.current.delete(uploadId);
                if (cancelledUploads.current.delete(uploadId)) return;
                const { data, message } = JSON.parse(uploadFileRes.data);
                if (!data) {
                    const next = listRef.current.filter((item) => item.uploadId !== uploadId);
                    updateList(next);
                    Taro.showToast({
                        title: message || "上传失败",
                        icon: "none"
                    });
                    return;
                }
                const uploadIndex = findUploadingIndex(listRef.current);
                if (uploadIndex < 0) return;
                const next = [...listRef.current];
                next.splice(uploadIndex, 1, {
                    ...data,
                    url: type === "image" ? imageFormat(data.picThumb) : data.videoUrl,
                    ...(type === "image" ? { previewUrl: filePath } : {}),
                    type
                });
                updateList(next);
            },
            fail: (error) => {
                uploadTasks.current.delete(uploadId);
                if (cancelledUploads.current.delete(uploadId)) return;
                Taro.showToast({
                    title: (error as any).errMsg || t("上传失败"),
                    icon: "none"
                });
                updateList(listRef.current.filter((item) => item.uploadId !== uploadId));
            }
        });
        uploadTasks.current.set(uploadId, uploadTask);
        uploadTask.onProgressUpdate?.((progressEvent: any) => {
            const uploadIndex = findUploadingIndex(listRef.current);
            if (uploadIndex < 0) return;
            const next = [...listRef.current];
            next[uploadIndex] = {
                ...next[uploadIndex],
                progress: Math.min(100, Math.max(0, Number(progressEvent.progress)))
            };
            updateList(next);
        });
    };

    return (
        <View className="upload-media">
            <View className="media-preview" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
                {list.map((item, index) => (
                    <View className="media-item" key={index}>
                        {item.type === "image" ? (
                            <Image className="media-preview-image" src={item.previewUrl || item.url || ""} mode={imageMode as any} />
                        ) : (
                            <Image className="media-preview-video" src={item.videoCover || item.url || ""} mode="aspectFill" />
                        )}
                        {item.uploading && (
                            <View className="progress">
                                <View className="progress-spinner" />
                                <View className="progressText">
                                    {t("上传中...")} {item.progress ?? 0}%
                                </View>
                            </View>
                        )}
                        <Text className="iconfont-h5 icon-clear delete-btn" style={{ fontSize: "50rpx", color: "#cccccc" }} onClick={() => removeMedia(index)} />
                    </View>
                ))}
                {list.length < maxCount && (
                    <View className="fileBox" onClick={chooseMedia}>
                        <View className="iconfont-h5 icon-8tupian-1 icon" />
                        <View className="tip">
                            {uploadTip ||
                                (mediaType === "image"
                                    ? `上传凭证图片，最多上传${maxCount}张`
                                    : `${t("上传图片/视频最多上传")}${maxCount}${t("张")}`)}
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}
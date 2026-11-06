import { useEffect, useRef, useState } from "react";
import { Canvas, Image, ScrollView, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigImage from "@/components/tig/tig-image/TigImage";
import { useSafeAreaInsets } from "@/hooks";
import { getImageInfo, saveImageToAlbum, staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import { POSTER_CONTAINER_WIDTH, POSTER_FOOTER_HEIGHT, calculateProportionalHeight, getPosterCanvasSize } from "./materialChoosePosterLayout";

import "./MaterialChoosePoster.scss";

interface Props {
    /** 对应旧 v-model */
    modelValue?: boolean;
    currentData?: any;
    qrcodePath?: string;
    /** 对应旧 update:modelValue */
    onChange?: (value: boolean) => void;
}

/**
 * 素材选择海报组件（自旧 pages/salesman/src/materialChoosePoster.vue 移植）
 * - 选择素材图片生成海报
 * - 支持多张图片选择
 * - Canvas 绘制并保存
 */
export default function MaterialChoosePoster({ modelValue = false, currentData = {}, qrcodePath = "", onChange }: Props) {
    const { safeBottom } = useSafeAreaInsets();
    const [currentIndex, setCurrentIndex] = useState(0);
    const [boxHeight, setBoxHeight] = useState(0);
    const [posterPics, setPosterPics] = useState<string[]>([]);
    const posterPicsRef = useRef<string[]>([]);
    const CONTAINERWIDTH = POSTER_CONTAINER_WIDTH;
    const pics = currentData.pics || [];
    void modelValue;

    const createFilePath = (index: number, height: number) => {
        Taro.canvasToTempFilePath({
            // 这里修改保存的图片格式
            fileType: "jpg",
            canvasId: "myCanvas",
            quality: 1,
            destWidth: CONTAINERWIDTH * 2,
            destHeight: height * 2,
            success: function (res) {
                const next = [...posterPicsRef.current];
                next[index] = res.tempFilePath;
                posterPicsRef.current = next;
                setPosterPics(next);
            },
            fail: (err) => {
                Taro.showToast({
                    title: JSON.stringify(err),
                    icon: "none",
                    duration: 3000
                });
                console.log(err);
            }
        } as any);
    };

    const createPoster = async (index = currentIndex) => {
        const pic = pics[index];
        if (!pic) return;
        try {
            const res = await getImageInfo(imageFormat(pic.picUrl));
            const canvasSize = getPosterCanvasSize(res.width, res.height);
            const imgHeight = canvasSize.height - POSTER_FOOTER_HEIGHT;
            setBoxHeight(canvasSize.height);

            const context: any = Taro.createCanvasContext("myCanvas");
            if (posterPicsRef.current[index]) return;
            const userInfo = Taro.getStorageSync("userInfo") || {};
            const avatarSrc = userInfo.avatar ? imageFormat(userInfo.avatar) : staticResource("user/defaultAvatar.jpg");
            context.draw(); // 清空原来的画图内容
            context.setFillStyle("#ffffff");
            context.fillRect(0, 0, CONTAINERWIDTH, canvasSize.height);
            try {
                context.draw(false, async () => {
                    const avatarRes = await getImageInfo(avatarSrc);
                    context.save();
                    context.beginPath();
                    context.arc(30, imgHeight + 35, 22, 0, 2 * Math.PI);
                    context.clip();
                    context.drawImage(avatarRes.path, 8, imgHeight + 12, 45, 45);
                    context.restore();
                    setTimeout(() => {
                        context.draw(true, async () => {
                            const currentPicRes = await getImageInfo(imageFormat(pic.picUrl));
                            context.drawImage(currentPicRes.path, 0, 0, CONTAINERWIDTH, calculateProportionalHeight(currentPicRes.width, currentPicRes.height));
                            context.draw(true, async () => {
                                const qrcodeRes = await getImageInfo(qrcodePath);
                                // 绘制二维码
                                context.drawImage(qrcodeRes.path, CONTAINERWIDTH - 80, canvasSize.height - 80, 70, 70);
                                // 绘制文字
                                context.setFontSize(13);
                                context.setFillStyle("#000000");
                                context.fillText(userInfo.mobile, 58, imgHeight + 33);
                                context.setFontSize(11);
                                context.setFillStyle("#999999");
                                context.fillText(t("这个真不错，推荐你也来看看"), 58, imgHeight + 48);
                                setTimeout(() => {
                                    context.draw(true, () => {
                                        createFilePath(index, canvasSize.height);
                                    });
                                }, 50);
                            });
                        });
                    }, 50);
                });
            } catch (error) {
                console.error(error);
            }
        } catch (error) {
            console.error(error);
        }
    };

    const handlePic = (index: number) => {
        setCurrentIndex(index);
        void createPoster(index);
    };

    const handleSave = (tempFilePath: string) => {
        Taro.showModal({
            title: t("提示"),
            content: t("确定要保存分享海报吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: function (res) {
                if (!res.confirm) return;
                // 保存本地
                if (process.env.TARO_ENV === "h5") {
                    Taro.previewImage({
                        urls: [tempFilePath]
                    });
                    return;
                }
                saveImageToAlbum(tempFilePath)
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

    // 旧 onMounted → nextTick(() => createPoster())
    useEffect(() => {
        const timer = setTimeout(() => {
            void createPoster(0);
        }, 0);
        return () => clearTimeout(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View className="overlay">
            {pics.length > 1 ? (
                <View className="bottom-choose-box">
                    <View className="bottom-choose-inner">
                        <View className="bottom-choose" style={{ paddingBottom: `${safeBottom + 20}rpx` }}>
                            <View className="bottom-choose-title">{t("选择图片，生成对应海报")}</View>
                            <View className="chose-ico" onClick={() => onChange?.(false)}>
                                ×
                            </View>
                            <View className="choose-img">
                                <ScrollView className="list-box" scrollX>
                                    <View className="list-content">
                                        {pics.map((item: any, index: number) => (
                                            <View key={item.picId} className="list-item" onClick={() => handlePic(index)}>
                                                <View className={`list-item-radio${currentIndex === index ? " active" : ""}`} />
                                                <TigImage src={item.picUrl} />
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        </View>
                    </View>
                </View>
            ) : null}
            <View className="poster-box">
                <View className="preview-wrap">
                    <View className="poster-wrap">
                        <View className="poster-img" style={{ height: `${boxHeight}px` }}>
                            <Image style={{ width: "100%", height: "100%" }} mode="aspectFit" src={posterPics[currentIndex] || ""} />
                        </View>
                    </View>
                    {pics.length === 1 ? (
                        <View className="preview-icon" onClick={() => onChange?.(false)}>
                            <View className="preview-icon-close" />
                        </View>
                    ) : null}
                    <View className="preview-text" onLongPress={() => handleSave(posterPics[currentIndex])}>
                        {t("长按图片保存至相册")}
                    </View>
                </View>
            </View>
            <Canvas
                id="myCanvas"
                canvasId="myCanvas"
                className="canvas-content"
                width={`${CONTAINERWIDTH}`}
                height={`${boxHeight}`}
                style={{ height: `${boxHeight}px` }}
            />
        </View>
    );
}
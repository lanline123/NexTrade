import { useEffect, useRef, useState } from "react";
import { Canvas, Image, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { getImageInfo, saveImageToAlbum, staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./Poster.scss";

interface Props {
    id?: string;
    currentData?: any;
    imgHeight?: number;
    currentPic?: string;
    activeType?: string;
    qrcodePath?: string;
}

interface BoxInfo {
    boxHeight: number;
    boxWidth: number;
    imgHeight: number;
    imgWidth: number;
}

const INITIAL_BOX: BoxInfo = {
    boxHeight: 0,
    boxWidth: 260,
    imgHeight: 0,
    imgWidth: 0
};

const calculateProportionalHeight = (originalWidth: number, originalHeight: number, containerWidth = 260) => {
    const newHeight = (originalHeight * containerWidth) / originalWidth;
    return { width: containerWidth, height: newHeight };
};

/**
 * 海报绘制组件（自旧 pages/salesman/src/poster.vue 移植）
 * - Canvas 绘制分销商品分享海报
 * - 旧版 createCanvasContext(id, instance) 的实例参数在 React 端无对应值，直接按 canvasId 获取
 */
export default function Poster({
    id = "myCanvas",
    currentData = {},
    imgHeight = 0,
    currentPic = "",
    activeType = "",
    qrcodePath = ""
}: Props) {
    void imgHeight;
    const [img, setImg] = useState("");
    const [boxInfo, setBoxInfo] = useState<BoxInfo>(INITIAL_BOX);
    const isGeneratingRef = useRef(false);
    const boxRef = useRef<BoxInfo>(INITIAL_BOX);
    const currentDataCopyRef = useRef<any>(null);

    const measureTextWidth = async (canvas: any, text: string) => {
        try {
            const res = canvas.measureText(text);
            // 兼容某些端返回 Promise 的情况
            if (res && typeof res.then === "function") {
                const r = await res;
                return Number(r?.width ?? 0);
            }
            return Number(res?.width ?? 0);
        } catch {
            return 0;
        }
    };

    const truncateTextToWidth = async (canvas: any, text: string, maxWidth: number) => {
        if (!text) return { text: "", width: 0 };
        if (maxWidth <= 0) return { text: "", width: 0 };
        const fullWidth = await measureTextWidth(canvas, text);
        if (fullWidth <= maxWidth) return { text, width: fullWidth };

        const ellipsis = "...";
        const ellipsisWidth = await measureTextWidth(canvas, ellipsis);
        const targetWidth = Math.max(0, maxWidth - ellipsisWidth);

        let result = "";
        for (let i = 0; i < text.length; i++) {
            const next = result + text[i];
            const w = await measureTextWidth(canvas, next);
            if (w > targetWidth) break;
            result = next;
        }
        const finalText = result ? result + ellipsis : ellipsis;
        const finalWidth = await measureTextWidth(canvas, finalText);
        return { text: finalText, width: finalWidth };
    };

    // 商品名称文字换行，最多三行，超出显示省略号
    const drawText = (text: string, x: number, y: number, canvas: any, boxWidth: number) => {
        canvas.setFontSize(12);
        const lineHeight = 15;
        // 计算可用宽度（总宽度减去左边距和右边距，右边有二维码占80px）
        const maxWidth = boxWidth - x - 80;
        const ellipsis = "...";
        // 估算字符宽度：中文字符约12px，英文字符约6px（12px字体）
        const getCharWidth = (char: string) => {
            // 判断是否为中文字符
            return /[\u4e00-\u9fa5]/.test(char) ? 12 : 6;
        };
        const ellipsisWidth = 18; // 三个点约18px

        // 第一行
        let firstLine = "";
        let firstLineWidth = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text[i];
            const charWidth = getCharWidth(char);
            if (firstLineWidth + charWidth <= maxWidth) {
                firstLine += char;
                firstLineWidth += charWidth;
            } else {
                break;
            }
        }

        // 如果第一行就显示完了，直接绘制
        if (firstLine.length === text.length) {
            canvas.fillText(firstLine, x, y);
            return y;
        }

        // 绘制第一行
        canvas.fillText(firstLine, x, y);

        // 第二行
        let remainingText = text.slice(firstLine.length);
        let secondLine = "";
        let secondLineWidth = 0;
        for (let i = 0; i < remainingText.length; i++) {
            const char = remainingText[i];
            const charWidth = getCharWidth(char);
            if (secondLineWidth + charWidth <= maxWidth) {
                secondLine += char;
                secondLineWidth += charWidth;
            } else {
                break;
            }
        }

        // 如果第二行就显示完了，直接绘制
        if (secondLine.length === remainingText.length) {
            y += lineHeight;
            canvas.fillText(secondLine, x, y);
            return y;
        }

        // 绘制第二行
        y += lineHeight;
        canvas.fillText(secondLine, x, y);

        // 第三行（需要加上省略号）
        remainingText = remainingText.slice(secondLine.length);
        let thirdLine = "";
        let thirdLineWidth = 0;
        const thirdLineMaxWidth = maxWidth - ellipsisWidth;

        for (let i = 0; i < remainingText.length; i++) {
            const char = remainingText[i];
            const charWidth = getCharWidth(char);
            if (thirdLineWidth + charWidth <= thirdLineMaxWidth) {
                thirdLine += char;
                thirdLineWidth += charWidth;
            } else {
                break;
            }
        }

        // 绘制第三行（带省略号）
        y += lineHeight;
        canvas.fillText(thirdLine + ellipsis, x, y);

        return y;
    };

    const formatPrice = (price: unknown) => {
        // 兼容接口返回 string/number/null，以及可能包含货币符号的字符串
        const num = typeof price === "number" ? price : parseFloat(String(price ?? "").replace(/[^\d.-]/g, ""));
        if (!Number.isFinite(num)) return "0.00";
        return num.toFixed(2);
    };

    const saveToImg = (box: BoxInfo) => {
        // 微信小程序对导出尺寸有限制，这里做一下上限保护，避免海报过长时 canvasToTempFilePath 失败
        const EXPORT_MAX = 4096;
        const scale = Math.min(2, EXPORT_MAX / box.boxWidth, EXPORT_MAX / box.boxHeight);
        Taro.canvasToTempFilePath({
            fileType: "jpg",
            canvasId: id,
            quality: 1,
            destHeight: Math.max(1, Math.floor(box.boxHeight * scale)),
            destWidth: Math.max(1, Math.floor(box.boxWidth * scale)),
            success: function (res) {
                setImg(res.tempFilePath);
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

    const createPoster = async () => {
        if (isGeneratingRef.current) return;
        if (!currentPic) return;
        // 二维码通常是异步生成的，小程序下为空会导致 getImageInfo 直接报错
        if (!qrcodePath) return;
        isGeneratingRef.current = true;
        const userInfo = Taro.getStorageSync("userInfo") || {};
        const nickname = userInfo.nickname ?? t("普通会员");
        const avatarSrc = userInfo.avatar ? imageFormat(userInfo.avatar) : staticResource("user/defaultAvatar.jpg");
        const context: any = Taro.createCanvasContext(id);
        context.draw();
        context.setFillStyle("#ffffff");

        try {
            const currentPicRes = await getImageInfo(imageFormat(currentPic));
            const { height, width } = calculateProportionalHeight(currentPicRes.width, currentPicRes.height);
            const box: BoxInfo = {
                boxHeight: height + 150,
                boxWidth: 260,
                imgHeight: height,
                imgWidth: width
            };
            boxRef.current = box;
            setBoxInfo(box);

            context.fillRect(0, 0, box.boxWidth, box.boxHeight);

            context.draw(false, async () => {
                const avatarRes = await getImageInfo(avatarSrc);
                context.save();
                context.beginPath();
                context.arc(35, box.imgHeight + 25, 15, 0, 2 * Math.PI);
                context.clip();
                context.drawImage(avatarRes.path, 15, box.imgHeight + 5, 40, 40);
                context.restore();
                setTimeout(() => {
                    context.draw(true, async () => {
                        context.drawImage(currentPicRes.path, 0, 0, box.imgWidth, box.imgHeight);
                        context.draw(true, async () => {
                            const qrcodeRes = await getImageInfo(qrcodePath);
                            // 绘制二维码
                            context.drawImage(qrcodeRes.path, box.boxWidth - 80, box.imgHeight + 50, 70, 70);
                            // 绘制文字
                            const baseX = 55;
                            const baseY = box.imgHeight + 30;
                            const maxRight = box.boxWidth - 80; // 右侧给二维码留白
                            const availableWidth = maxRight - baseX;

                            context.setFontSize(13);
                            // 先测“为您推荐”宽度，决定 nickname 如何裁剪/是否换行
                            const recommendText = t("为您推荐");
                            const recommendWidth = await measureTextWidth(context, recommendText);

                            // 默认同一行展示；如果空间不足则“为您推荐”换到第二行
                            const showRecommendSameLine = recommendWidth + 6 <= availableWidth;
                            const nicknameMaxWidth = showRecommendSameLine ? availableWidth - recommendWidth - 6 : availableWidth;
                            const nicknameFit = await truncateTextToWidth(context, nickname, nicknameMaxWidth);

                            context.setFillStyle("#000000");
                            context.fillText(nicknameFit.text, baseX, baseY);

                            context.setFillStyle("#999999");
                            if (showRecommendSameLine) {
                                context.fillText(recommendText, baseX + nicknameFit.width + 6, baseY);
                            } else {
                                // 放到下一行，避免被挤出画布
                                context.fillText(recommendText, baseX, baseY + 18);
                            }

                            context.setFontSize(12);
                            const y = drawText(currentData.productName, 20, box.imgHeight + 60, context, box.boxWidth);
                            context.setFontSize(18);
                            context.setFillStyle("#ea122c");
                            context.fillText(formatPrice(currentData.productPrice), 20, y + 30);
                            // 不加延迟小程序会出现诡异问题
                            setTimeout(() => {
                                context.draw(true);
                                setTimeout(() => {
                                    saveToImg(boxRef.current);
                                }, 50);
                            }, 50);
                        });
                    });
                }, 50);
            });
        } catch (error) {
            console.error(error);
        } finally {
            isGeneratingRef.current = false;
        }
    };

    const handleSave = () => {
        // #ifdef APP-PLUS||MP-WEIXIN
        if (process.env.TARO_ENV === "h5") return;
        Taro.showModal({
            title: t("提示"),
            content: t("确定要保存分享海报吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: function (res) {
                if (!res.confirm) return;
                saveImageToAlbum(img)
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
        // #endif
    };

    // 旧 watch(() => [activeType, qrcodePath, currentPic, currentData.productId], ..., { immediate: true })
    useEffect(() => {
        if (activeType && activeType === "poster") {
            if (!currentDataCopyRef.current) {
                currentDataCopyRef.current = JSON.parse(JSON.stringify(currentData || {}));
                setTimeout(() => void createPoster(), 0);
            } else if (currentDataCopyRef.current.productId !== currentData?.productId) {
                setImg("");
                currentDataCopyRef.current = JSON.parse(JSON.stringify(currentData || {}));
                setTimeout(() => void createPoster(), 0);
            } else if (!img) {
                // 二维码/图片异步就绪时也需要重绘（否则第一次 getImageInfo 失败后不会再生成）
                setTimeout(() => void createPoster(), 0);
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeType, qrcodePath, currentPic, currentData?.productId]);

    return (
        <>
            <View className="poster-main">
                {img ? (
                    <Image
                        src={img}
                        className="img-box"
                        mode="aspectFit"
                        style={{ height: `${boxInfo.boxHeight}px` }}
                        onLongPress={handleSave}
                    />
                ) : null}
            </View>
            <Canvas
                id={id}
                canvasId={id}
                className="canvas-content"
                style={{ height: `${boxInfo.boxHeight}px`, width: `${boxInfo.boxWidth}px` }}
                width={`${boxInfo.boxWidth}`}
                height={`${boxInfo.boxHeight}`}
            />
        </>
    );
}
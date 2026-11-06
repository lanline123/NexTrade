import { useEffect, useRef, useState } from "react";
import { Canvas, Image, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import { imageFormat } from "@/utils/format";
import type { ProductItem } from "@/types/product/product";
import type { GrouponPromotionDetail, GrouponRecordDetail } from "@/types/groupon/groupon";
import { getMiniCode, getQrCode } from "@/api/common";
import { getGrouponRecordDetail } from "@/api/groupon/groupon";
import { getImageInfo, rpx2px } from "@/utils";
import { t } from "@/utils/i18n";

import "./Poster.scss";

/**
 * 拼团海报组件（自旧 pages/groupon/src/poster.vue 移植）
 * - Canvas 绘制拼团分享海报
 * - 包含商品信息、拼团价格、二维码
 */
interface Props {
    /** 对应旧 v-model */
    modelValue: boolean;
    productId: number;
    productInfo: ProductItem;
    grouponPromotionId: number;
    grouponPromotionRecordId: number;
    productPrice: string | number;
    /** 对应旧 update:modelValue */
    onChange?: (value: boolean) => void;
}

export default function GrouponPoster({
    modelValue: _modelValue,
    productId,
    productInfo: _productInfo,
    grouponPromotionId: _grouponPromotionId,
    grouponPromotionRecordId,
    productPrice: _productPrice,
    onChange
}: Props) {
    const [grouponPromotion] = useState<GrouponPromotionDetail>({
        endTime: "",
        grouponExplain: "",
        grouponImage: "",
        startTime: "",
        shopId: 0,
        shopTitle: ""
    });
    const [grouponRecordDetail, setGrouponRecordDetail] = useState<GrouponRecordDetail>({
        grouponPromotionRecordId: 0,
        productId: 0,
        productName: "",
        joinType: 0,
        joinStatus: 0,
        minGroupNum: 0,
        groupNum: 0,
        shopId: 0,
        shopTitle: "",
        grouponImage: "",
        minGrouponPrice: 0,
        grouponPrice: 0,
        productPrice: 0,
        picThumb: "",
        joinNumCount: 0,
        joinUsers: [],
        skuId: 0,
        startTime: "",
        endTime: "",
        grouponPromotionId: 0
    });

    const [qrImg, setQrImg] = useState("");
    const [show, setShow] = useState(false);
    const powerwRef = useRef(0);
    const [canvasHeight, setCanvasHeight] = useState(900); // 动态高度值
    const [img, setImg] = useState("");

    // 旧 onMounted（挂载即绘制一次）
    useEffect(() => {
        const init = async () => {
            const { windowWidth } = Taro.getSystemInfoSync();
            powerwRef.current = windowWidth / 375;
            // const result = await getGrouponPromotionDetail(props.grouponPromotionId);
            // console.log(result);
            // grouponPromotion.value = result;
            const grouponRecordRes = await getGrouponRecordDetail(grouponPromotionRecordId);
            if (grouponRecordRes) {
                setGrouponRecordDetail(grouponRecordRes);
            }
            const qrCode = await __getQrCode();
            // React state 更新异步，绘制使用本次拿到的记录（无数据时沿用默认值，与旧版一致）
            void generatePoster(qrCode, grouponRecordRes || grouponRecordDetail);
        };
        void init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const __getQrCode = async (): Promise<string> => {
        try {
            let qrImgValue = "";
            if (process.env.TARO_ENV === "h5") {
                // #ifdef H5
                // 拼接地址
                const url = `${location.origin}/mobile/pages/product/groupBuying?grouponPromotionRecordId=${grouponPromotionRecordId}`;
                const result = await getQrCode(url);
                qrImgValue = result;
                // #endif
            } else {
                // #ifdef MP-WEIXIN
                // const page = currRoute();
                const page = `/pages/product/groupBuying?grouponPromotionRecordId=${grouponPromotionRecordId}`;
                const res = await getMiniCode(page ?? "", productId);
                qrImgValue = res;
                // #endif
            }
            setQrImg(qrImgValue);
            Taro.showToast({
                title: t("正在生成海报，请稍后"),
                icon: "none",
                duration: 1000
            });
            return qrImgValue;
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
            return "";
        }
    };

    const getDate = (date: string) => {
        const dateObj = new Date(date);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const day = dateObj.getDate();
        return `${year}-${month}-${day}`;
    };
    // 保持纵横比绘制图片
    const drawImageWithAspect = (ctx: any, image: any, x: number, y: number, areaWidth: number, areaHeight: number) => {
        const { width: imgWidth, height: imgHeight, path: imgPath } = image;

        // 计算缩放比例，保持图片不变形
        const scale = Math.min(areaWidth / imgWidth, areaHeight / imgHeight);

        // 计算实际绘制尺寸
        const drawWidth = imgWidth * scale;
        const drawHeight = imgHeight * scale;

        // 绘制图片
        ctx.drawImage(imgPath, x, y, areaWidth, areaHeight);
        return drawHeight;
    };
    // 生成海报
    const generatePoster = async (qrImgValue: string, recordDetail: GrouponRecordDetail) => {
        try {
            // 使用固定的 rpx 尺寸，然后转换为实际像素
            const canvasWidthRpx = 500; // 画布宽度 (rpx)

            // 边距设置 (rpx)
            const horizontalPaddingRpx = 30;
            const topMarginRpx = 120;
            const bottomMarginRpx = 80;

            // 内边距设置 (rpx)
            const innerTopPaddingRpx = 60;
            const innerBottomPaddingRpx = 220;
            const qrCodeSizeRpx = 120;

            // 转换为实际像素尺寸
            const canvasWidth = rpx2px(canvasWidthRpx);

            // 转换为实际像素
            const horizontalPadding = rpx2px(horizontalPaddingRpx);
            const topMargin = rpx2px(topMarginRpx);
            const bottomMargin = rpx2px(bottomMarginRpx);

            // 转换为实际像素
            const innerTopPadding = rpx2px(innerTopPaddingRpx);
            const innerBottomPadding = rpx2px(innerBottomPaddingRpx);
            const qrCodeSize = rpx2px(qrCodeSizeRpx);

            // 图片区域
            const imageAreaWdithTemp = canvasWidth - 2 * horizontalPadding;
            // 获取图片信息
            const picRes = await getImageInfo(imageFormat(recordDetail.grouponImage));
            const { width: imgWidth, height: imgHeight } = picRes;
            // 计算缩放比例，保持图片不变形
            const scale = Math.min(imageAreaWdithTemp / imgWidth, imageAreaWdithTemp / imgHeight);
            // 计算实际绘制尺寸
            const imageAreaWidth = imgWidth * scale;
            const imageAreaHeight = imgHeight * scale;

            const contentHeight = innerTopPadding + imageAreaHeight + innerBottomPadding;
            // 最终高度
            const canvasHeightValue = topMargin + contentHeight + bottomMargin;
            setCanvasHeight(canvasHeightValue);

            // TODO(MIGRATION)：旧 uni.createCanvasContext("myCanvas", instance) 的组件实例参数在 React 端无对应值，
            // 页面级唯一 canvas 直接按 canvasId 获取（Taro 支持）。
            const context: any = Taro.createCanvasContext("myCanvas");

            context.clearRect(0, 0, canvasWidth, canvasHeightValue);
            context.draw();

            // 填充背景色
            context.setFillStyle("red");
            context.fillRect(0, 0, canvasWidth, canvasHeightValue);

            // 画渐变背景
            const grd = context.createLinearGradient(0, 0, 0, canvasHeightValue);
            grd.addColorStop(0, "#F2F2F6");
            grd.addColorStop(1, "#E6E6EE");
            context.setFillStyle(grd);
            context.fillRect(0, 0, canvasWidth, canvasHeightValue);

            // 头部文字
            context.setFontSize(rpx2px(30));
            context.setFillStyle("#333");
            context.fillText(t("拼团"), canvasWidth / 2 - rpx2px(30), topMargin / 2 + rpx2px(16));

            // 绘制主要内容区域（白色背景）
            const contentX = horizontalPadding;
            const contentY = topMargin;
            const contentWidth = imageAreaWidth;
            const contentHeightTotal = contentHeight;

            // 绘制阴影效果
            const shadowBlur = rpx2px(20);
            const shadowOffsetX = 0;
            const shadowOffsetY = rpx2px(20);
            context.save();
            context.shadowColor = "rgba(0, 0, 0, 0.1)";
            context.shadowBlur = shadowBlur;
            context.shadowOffsetX = shadowOffsetX;
            context.shadowOffsetY = shadowOffsetY;

            // 绘制圆角背景区域（带阴影）
            const contentRadius = rpx2px(30);
            context.beginPath();
            context.moveTo(contentX + contentRadius, contentY);
            context.lineTo(contentX + contentWidth - contentRadius, contentY);
            context.quadraticCurveTo(contentX + contentWidth, contentY, contentX + contentWidth, contentY + contentRadius);
            context.lineTo(contentX + contentWidth, contentY + contentHeightTotal - contentRadius);
            context.quadraticCurveTo(
                contentX + contentWidth,
                contentY + contentHeightTotal,
                contentX + contentWidth - contentRadius,
                contentY + contentHeightTotal
            );
            context.lineTo(contentX + contentRadius, contentY + contentHeightTotal);
            context.quadraticCurveTo(contentX, contentY + contentHeightTotal, contentX, contentY + contentHeightTotal - contentRadius);
            context.lineTo(contentX, contentY + contentRadius);
            context.quadraticCurveTo(contentX, contentY, contentX + contentRadius, contentY);
            context.closePath();

            // 填充白色背景
            context.fillStyle = "#FFFFFF";
            context.fill();
            context.restore(); // 恢复

            // 绘制商品名称，这里是调用一个方法，按字符串长度进行分割换行。【可以做一个优化】
            // 在内部底部留白区域添加信息
            const infoAreaStartY = contentY + innerTopPadding + imageAreaHeight;
            const groupNameX = contentX + rpx2px(20);
            let groupNameY = 0;
            if (recordDetail.productName?.length > 20) {
                groupNameY = infoAreaStartY + innerBottomPadding - qrCodeSize - rpx2px(50);
            } else {
                groupNameY = infoAreaStartY + innerBottomPadding - qrCodeSize - rpx2px(30);
            }
            drawText(t(recordDetail.productName), groupNameX, groupNameY, context);

            // 绘制拼团时间
            const timeY = infoAreaStartY + innerBottomPadding - rpx2px(30);
            context.setFontSize(rpx2px(18));
            context.setFillStyle("#888");
            context.fillText(getDate(recordDetail.startTime) + "~" + getDate(recordDetail.endTime), groupNameX, timeY);
            context.save();

            // 计算二维码位置
            const qrX = contentX + contentWidth - qrCodeSize - rpx2px(15);
            const qrY = infoAreaStartY + innerBottomPadding - qrCodeSize - rpx2px(50);
            context.setFontSize(rpx2px(18));
            context.setFillStyle("#666");
            context.fillText(t("长按识别查看"), qrX + rpx2px(4), timeY);

            // debug
            // const avatarRes = await getImageInfo(userInfo.avatar ? imageFormat(userInfo.avatar) : staticResource("user/default_avatar.jpg"));
            // 这个就是绘制圆形头像
            // context.beginPath();
            // context.arc(50, 50, 28, 0, 2 * Math.PI);
            // context.clip();
            // context.drawImage(avatarRes.path, 20, 20, 70 * powerw.value, 70 * powerw.value);
            context.restore();
            context.draw(true, async () => {
                context.save();
                // debug
                // context.drawImage(picRes.path, 40, 160, 245 * powerw.value, 245 * powerw.value);
                // 绘制商品图片，以当前的大小绘制，进行缩放
                // context.drawImage(picRes.path, contentX, contentY + innerTopPadding, imageAreaWidth, imageAreaHeight);
                drawImageWithAspect(context, picRes, contentX, contentY + innerTopPadding, imageAreaWidth, imageAreaHeight);

                context.draw(true, () => {
                    // 绘制小程序码
                    if (process.env.TARO_ENV === "weapp") {
                        // #ifdef MP-WEIXIN
                        const fs = Taro.getFileSystemManager();
                        const userDataPath = (Taro as any).env?.USER_DATA_PATH ?? "";
                        const codeimg = userDataPath + "/" + new Date().getTime() + ".png";
                        fs.writeFile({
                            filePath: codeimg,
                            data: qrImgValue.slice(22),
                            encoding: "base64",
                            success: () => {
                                // context.drawImage(codeimg, 165, 360 * powerw.value, 100 * powerw.value, 100 * powerw.value);
                                context.drawImage(codeimg, qrX, qrY, qrCodeSize, qrCodeSize);
                                context.draw(true, () => {
                                    saveToImg();
                                });
                            }
                        } as any);

                        // #endif
                    } else {
                        // #ifdef H5
                        // context.drawImage(qrImg.value, 165, 360 * powerw.value, 100 * powerw.value, 100 * powerw.value);
                        // debug
                        context.drawImage(qrImgValue, qrX, qrY, qrCodeSize, qrCodeSize);
                        context.draw(true, () => {
                            saveToImg();
                        });
                        // #endif
                    }
                });
            });
        } catch (error) {
            console.error(error);
        }
    };

    // 商品名称文字换行（支持中英文按宽度自动换行）
    const drawText = (text: any, x: any, y: any, canvas: any) => {
        const fontSize = rpx2px(28);
        const maxWidth = rpx2px(270); // 文本区域最大宽度
        const lineHeight = 20;
        const maxLines = 2;
        const langCode = Taro.getStorageSync("langCode");
        // 判断是否使用英文换行：语言环境是英文 且 文本实际包含英文字母（说明翻译已维护）
        // 计算中文字符占比，判断文本主要是中文还是英文
        const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
        const englishChars = (text.match(/[a-zA-Z]/g) || []).length;
        const totalChars = chineseChars + englishChars;
        // 如果中文字符占比超过30%，则认为是中文为主的文本
        const isMainlyChinese = totalChars > 0 && chineseChars / totalChars > 0.3;
        const isEnglishMode = langCode === "en" && !isMainlyChinese;

        canvas.setFontSize(fontSize);
        canvas.setFillStyle("#333333");

        let lines: string[] = [];

        if (isEnglishMode) {
            // 英文模式：按单词换行，避免单词被切开
            const words = text.split(/(\s+)/); // 保留空格
            let currentLine = "";

            for (const word of words) {
                const testLine = currentLine + word;
                const metrics = canvas.measureText(testLine);
                const testWidth = metrics ? metrics.width : testLine.length * fontSize * 0.6;

                if (testWidth > maxWidth && currentLine !== "") {
                    lines.push(currentLine.trim());
                    currentLine = word;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine.trim()) {
                lines.push(currentLine.trim());
            }
        } else {
            // 中文模式：按字符换行
            let currentLine = "";

            for (const char of text) {
                const testLine = currentLine + char;
                const metrics = canvas.measureText(testLine);
                const testWidth = metrics ? metrics.width : testLine.length * fontSize;
                if (testWidth > maxWidth && currentLine !== "") {
                    lines.push(currentLine);
                    currentLine = char;
                } else {
                    currentLine = testLine;
                }
            }
            if (currentLine) {
                lines.push(currentLine);
            }
        }

        // 绘制文字，限制最多显示2行
        lines.slice(0, maxLines).forEach((line, index) => {
            y += lineHeight;
            // 如果超过两行，在第二行后面添加省略号
            if (index === maxLines - 1 && lines.length > maxLines) {
                canvas.fillText(line + "...", x, y);
            } else {
                canvas.fillText(line, x, y);
            }
        });
    };

    const saveToImg = () => {
        Taro.canvasToTempFilePath(
            {
                // 这里修改保存的图片格式
                fileType: "jpg",
                canvasId: "myCanvas",
                quality: 1,
                success: function (res) {
                    console.log(res.tempFilePath, 9999);
                    setImg(res.tempFilePath);
                    setShow(true);
                    // console.log("img", img.value);
                },
                fail: (err) => {
                    Taro.showToast({
                        title: JSON.stringify(err),
                        icon: "none",
                        duration: 3000
                    });
                    setShow(false);
                    console.log(err);
                }
            } as any
        );
    };

    const handleSave = () => {
        // #ifdef APP-PLUS||MP-WEIXIN
        // TODO(MIGRATION)：App(rn) 端待定，本批仅还原微信小程序分支
        if (process.env.TARO_ENV !== "weapp") return;
        Taro.saveImageToPhotosAlbum({
            filePath: img,
            success: function () {
                Taro.showToast({
                    title: t("保存海报成功"),
                    icon: "none",
                    duration: 1500
                });
                setTimeout(() => {
                    onChange?.(false);
                }, 1500);
            },
            fail: function (err) {
                console.error(err);
                Taro.showToast({
                    title: t("保存海报失败"),
                    icon: "none",
                    duration: 3000
                });
            }
        });
        // #endif
    };

    return (
        <View>
            {/* 生成海报的canvas */}
            <Canvas
                id="myCanvas"
                canvasId="myCanvas"
                className="canvas-content"
                style={{ height: `${canvasHeight}px` }}
            />
            <Popup
                visible={show}
                position="center"
                closeable={false}
                style={{ backgroundColor: "transparent" }}
                onClose={() => onChange?.(false)}
            >
                <View
                    className="poster-box"
                    style={{ height: `${canvasHeight}px` }}
                    catchMove
                    onTouchMove={(e: any) => {
                        e.stopPropagation();
                        e.preventDefault?.();
                    }}
                    onLongPress={handleSave}
                >
                    <Image src={img} style={{ height: "100%", width: "100%" }} mode="aspectFit" />
                </View>
                <View className="canvas-tip">{t("长按可保存海报")}</View>
            </Popup>
        </View>
    );
}
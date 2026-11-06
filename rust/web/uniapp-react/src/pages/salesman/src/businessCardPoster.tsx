import { useEffect, useRef, useState } from "react";
import { Canvas, Image, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { getImageInfo, saveImageToAlbum, staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./businessCardPoster.scss";

interface Props {
    /** 对应旧 v-model:modelValue */
    modelValue?: boolean;
    userInfo?: any;
    qrcodeImg?: string;
    /** 对应旧 update:modelValue */
    onChange?: (value: boolean) => void;
}

const boxInfo = {
    height: 525,
    width: 345
};

/**
 * 名片海报组件（自旧 pages/salesman/src/businessCardPoster.vue 逐行移植）
 * - Canvas 绘制分销员名片海报（头像 / 昵称 / 手机号 / 二维码）
 * - 支持长按保存到相册
 * - 旧 createCanvasContext("myCanvas", instance) 的实例参数在 React 端无对应值，按 canvasId 获取
 */
export default function BusinessCardPoster({ modelValue = false, userInfo = {}, qrcodeImg = "", onChange }: Props) {
    const [show, setShow] = useState(false);
    const [img, setImg] = useState("");
    const avatarSrc = userInfo.avatar ? imageFormat(userInfo.avatar) : staticResource("user/defaultAvatar.jpg");

    const saveToImg = () => {
        Taro.canvasToTempFilePath({
            fileType: "jpg",
            canvasId: "myCanvas",
            quality: 1,
            destHeight: boxInfo.height * 2,
            destWidth: boxInfo.width * 2,
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

    // 生成海报
    const createPoster = () => {
        Taro.showLoading({
            title: t("生成中"),
            mask: true
        });
        const nickname = userInfo.nickname ?? t("普通会员");
        const context: any = Taro.createCanvasContext("myCanvas");
        try {
            context.draw(); // 清空原来的画图内容
            context.setFillStyle("#ffffff");
            context.fillRect(0, 0, 345, 600);
            context.draw(true, async () => {
                const avatarRes = await getImageInfo(avatarSrc);
                context.drawImage(avatarRes.path, 0, 0, 345, 345);
                context.draw(true, async () => {
                    const qrcodeRes = await getImageInfo(qrcodeImg);
                    // 绘制二维码
                    context.drawImage(qrcodeRes.path, 345 - 160 - 10, 345 + 15, 150, 150);
                    // 绘制文字
                    context.setFontSize(13);
                    context.setFillStyle("#969799");
                    context.fillText(nickname, 20, boxInfo.height - 50);
                    context.setFillStyle("#000");
                    context.setFontSize(22);
                    context.fillText(userInfo.mobile, 20, 345 + 80);
                    setTimeout(() => {
                        context.draw(true);
                        setTimeout(() => {
                            saveToImg();
                        }, 50);
                        setShow(true);
                    }, 50);
                });
            });
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
        }
    };

    const handleSave = () => {
        // 旧 #ifdef APP-PLUS||MP-WEIXIN：App 端随 App 批次；此处保留微信小程序
        if (process.env.TARO_ENV !== "weapp") return;
        Taro.showModal({
            title: t("提示"),
            content: t("确定要保存图片吗？"),
            confirmText: t("确定"),
            cancelText: t("取消"),
            success: function (res) {
                if (res.confirm) {
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
            }
        });
    };

    const handleClose = () => {
        onChange?.(false);
    };

    // 旧 onMounted(async () => createPoster())
    const mountedRef = useRef(false);
    useEffect(() => {
        if (mountedRef.current) return;
        mountedRef.current = true;
        createPoster();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View className={`my-canvas-box${show ? " show" : ""}`} onClick={handleClose}>
            <View className="canvas-content-box">
                <View className="img-box" style={{ height: `${boxInfo.height}px` }}>
                    {img ? <Image src={img} onLongPress={(e) => {
                        e.stopPropagation();
                        handleSave();
                    }} /> : null}
                </View>
                <View className="canvas-tip">{t("长按保存图片")}</View>
            </View>
            <Canvas
                id="myCanvas"
                canvasId="myCanvas"
                className="canvas-content"
                style={{ height: `${boxInfo.height}px`, width: `${boxInfo.width}px` }}
                width={`${boxInfo.width}`}
                height={`${boxInfo.height}`}
                onLongPress={(e: any) => {
                    e.stopPropagation();
                    handleSave();
                }}
            />
        </View>
    );
}
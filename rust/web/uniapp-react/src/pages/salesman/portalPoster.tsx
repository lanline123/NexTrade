import { useEffect, useState } from "react";
import { Canvas, Image, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getQrCode } from "@/api/common";
import { useConfigStore } from "@/store/config";
import { getImageInfo, saveImageToAlbum, staticResource } from "@/utils";
import { imageFormat } from "@/utils/format";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./portalPoster.scss";

const boxInfo = {
    height: 525,
    width: 345
};

const removeBase64Prefix = (base64String: string) => {
    if (base64String.includes(",")) {
        return base64String.split(",")[1];
    }
    return base64String;
};

/**
 * 门户海报页（自旧 pages/salesman/portalPoster.vue 逐行移植）
 * - 生成分销推广门户海报
 * - 包含分销员二维码
 * - 支持保存到相册
 */
export default function SalesmanPortalPoster() {
    usePageGuards();

    const h5Domain = useConfigStore((s) => s.baseInfo.h5Domain);

    const [userInfo] = useState<any>(Taro.getStorageSync("userInfo") || {});
    const [img, setImg] = useState("");
    const [qrcodeImg, setQrcodeImg] = useState("");

    const link = (() => {
        let domain = h5Domain;

        // 旧 #ifdef H5
        if (process.env.TARO_ENV === "h5") {
            domain = domain ? domain : `${window.location.origin}/mobile`;
        }

        return `${domain}/pages/salesman/salesmanCard?salesmanId=${userInfo?.salesman?.salesmanId}`;
    })();

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
    const createPoster = async (qrPath: string) => {
        Taro.showLoading({
            title: t("生成中"),
            mask: true
        });
        const avatarSrc = userInfo.avatar ? imageFormat(userInfo.avatar) : staticResource("user/defaultAvatar.jpg");
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
                    context.drawImage(qrPath, 345 - 160 - 10, 345 + 15, 150, 150);
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

    const getQrCodeData = async () => {
        try {
            const res = await getQrCode(link);
            let path = res as string;
            setQrcodeImg(path);
            // 小程序绘制：旧 #ifdef MP-WEIXIN
            if (process.env.TARO_ENV === "weapp") {
                const fs = Taro.getFileSystemManager();
                const filePath = `${Taro.env.USER_DATA_PATH}/temp_image_${new Date().getTime()}.png`;
                path = await new Promise<string>((resolve, reject) => {
                    (fs as any).writeFile({
                        filePath,
                        data: removeBase64Prefix(res as string),
                        encoding: "base64",
                        success: () => resolve(filePath),
                        fail: reject
                    });
                });
                setQrcodeImg(path);
            }
            void createPoster(path);
        } catch (error) {
            console.error("获取二维码失败", error);
        }
    };

    // 旧 setup 阶段直接执行 getQrCodeData()
    useEffect(() => {
        void getQrCodeData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TigLayout title={t("名片海报")}>
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
            <View className="portalPoster-box">
                <View className="img-box" style={{ height: `${boxInfo.height}px` }}>
                    {img ? (
                        <Image
                            src={img}
                            onLongPress={(e) => {
                                e.stopPropagation();
                                handleSave();
                            }}
                        />
                    ) : null}
                </View>
                <View className="canvas-tip">{t("长按保存图片")}</View>
            </View>
        </TigLayout>
    );
}

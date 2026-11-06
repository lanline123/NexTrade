import { useMemo, useRef, useState } from "react";
import { Camera, Image, Text, View } from "@tarojs/components";
import Taro, { useDidHide, useDidShow, useUnload } from "@tarojs/taro";

import { CAPTURE_CLOSED_EVENT, openSearchResult, type PickedSearchImage } from "@/utils/imageSearchPick";
import { getCaptureLayout } from "@/utils/imageSearchLayout";
import { t } from "@/utils/i18n";

import iconBack from "./assets/capture-back.png";
import iconAlbum from "./assets/capture-album.png";

import "./captureMp.scss";

// TODO(MIGRATION)：B6 原生插件（uni_modules）按端重写；本页为微信小程序 `camera` 组件实现，
// 相机/胶囊/媒体选择等平台 API 已用 process.env.TARO_ENV === "weapp" 守卫。

// pending 正在打开相机；live 取景中；denied 相机未授权；error 相机不可用
type CaptureStatus = "pending" | "live" | "denied" | "error";

interface CaptureNotice {
    title: string;
    desc: string;
    action: string;
}

const NOTICES: Partial<Record<CaptureStatus, CaptureNotice>> = {
    denied: { title: "相机权限未开启", desc: "开启后可拍摄商品图片搜索相似商品，也可以从相册选择图片", action: "开启相机" },
    error: { title: "相机暂时不可用", desc: "可以重试，或从相册选择图片", action: "重试" }
};

const CAMERA_SCOPE = "scope.camera" as const;
const CAMERA_ASKED_KEY = "imageSearchCameraAsked";
const CORNER_SIZE = 28;
const CORNER_INSET = 14;
const BACK_SIZE = 32;

const px = (value: number) => `${value}px`;

/**
 * 以图搜图拍摄页（自旧 pages/imageSearch/captureMp.vue 逐行移植）
 * - 只负责拿到一张图片，拿到后自己进入等待页
 * - 进入页面只涉及相机授权；相册走微信选图界面，不读取手机照片列表
 */
export default function ImageSearchCaptureMp() {
    const layout = getCaptureLayout();
    const { windowWidth, finderTop, finderHeight } = layout;
    // 屏幕较短时控制区会压住取景区底部，角标和提示让到控制区上面
    const visibleBottom = Math.min(finderTop + finderHeight, layout.panelTop);
    // 返回按钮与右上角胶囊按钮垂直居中对齐（非微信端没有胶囊，按状态栏兜底）
    const backTop = useMemo(() => {
        if (process.env.TARO_ENV === "weapp") {
            const menu = Taro.getMenuButtonBoundingClientRect();
            return Math.round(menu.top + (menu.height - BACK_SIZE) / 2);
        }
        return Math.round((layout.statusBarHeight || 20) + 6);
    }, [layout.statusBarHeight]);
    // 取景区顶到返回按钮下方时，上面两个角标让到按钮下面
    const cornerTop = Math.max(finderTop, backTop + BACK_SIZE) + CORNER_INSET;
    const cornerBottomTop = visibleBottom - CORNER_INSET - CORNER_SIZE;
    const cornerRight = windowWidth - CORNER_INSET - CORNER_SIZE;

    const finderStyle = { top: px(finderTop), height: px(finderHeight) };
    const screenStyle = { top: px(0), height: px(layout.windowHeight) };
    const backStyle = { top: px(backTop) };
    const panelStyle = { top: px(layout.panelTop), height: px(layout.panelHeight), paddingBottom: px(layout.safeBottom) };
    const hintStyle = { top: px(visibleBottom - 56) };
    const cornerStyles = {
        tl: { top: px(cornerTop), left: px(CORNER_INSET) },
        tr: { top: px(cornerTop), left: px(cornerRight) },
        bl: { top: px(cornerBottomTop), left: px(CORNER_INSET) },
        br: { top: px(cornerBottomTop), left: px(cornerRight) }
    };

    const [status, setStatus] = useState<CaptureStatus>("pending");
    const [cameraOn, setCameraOn] = useState(false);
    const [position, setPosition] = useState<"back" | "front">("back");
    const [frozenPath, setFrozenPath] = useState("");
    const notice = useMemo(() => NOTICES[status] ?? null, [status]);

    const busyRef = useRef(false);
    const firstRef = useRef(true);

    const startCamera = () => {
        setStatus("pending");
        setCameraOn(true);
    };

    const stopCamera = () => {
        setCameraOn(false);
        setStatus((prev) => (prev === "live" ? "pending" : prev));
    };

    const getCameraAuth = () =>
        new Promise<boolean | undefined>((resolve) => {
            Taro.getSetting({
                success: (res: any) => resolve(res.authSetting[CAMERA_SCOPE]),
                fail: () => resolve(undefined)
            } as any);
        });

    const confirmPurpose = () =>
        new Promise<boolean>((resolve) => {
            Taro.showModal({
                title: t("使用相机"),
                content: t("用于拍摄商品图片并搜索相似商品"),
                cancelText: t("暂不开启"),
                confirmText: t("继续"),
                success: (res) => resolve(!!res.confirm),
                fail: () => resolve(false)
            });
        });

    const authorizeCamera = () => {
        Taro.authorize({
            scope: CAMERA_SCOPE,
            success: startCamera,
            fail: () => {
                setStatus("denied");
            }
        } as any);
    };

    /** 按真实授权状态决定是否取景；用途说明只在首次进入时自动弹出 */
    const syncCamera = async (first: boolean) => {
        const auth = await getCameraAuth();
        if (auth) return startCamera();
        setStatus("denied");
        if (!first || auth === false || Taro.getStorageSync(CAMERA_ASKED_KEY)) return;
        Taro.setStorageSync(CAMERA_ASKED_KEY, 1);
        if (await confirmPurpose()) authorizeCamera();
    };

    const onNoticeAction = async () => {
        if (status === "error") return startCamera();
        const auth = await getCameraAuth();
        if (auth) return startCamera();
        // 还没被拒绝过可以直接申请；拒绝过只能去设置页开启，返回后按真实状态重新检查
        if (auth === undefined) return authorizeCamera();
        Taro.openSetting({ success: () => syncCamera(false) } as any);
    };

    const onCameraError = async () => {
        setCameraOn(false);
        setStatus((await getCameraAuth()) ? "error" : "denied");
    };

    const deliver = (picked: PickedSearchImage) => {
        busyRef.current = true;
        setFrozenPath(picked.path);
        stopCamera();
        openSearchResult(picked);
    };

    const takePhoto = () => {
        if (busyRef.current || status !== "live") return;
        busyRef.current = true;
        Taro.createCameraContext().takePhoto({
            quality: "high",
            success: (res: any) => deliver({ path: res.tempImagePath, source: "camera" }),
            fail: () => {
                busyRef.current = false;
                void Taro.showToast({ title: t("拍照失败，请重试"), icon: "none" });
            }
        });
    };

    const pickFromAlbum = () => {
        if (busyRef.current) return;
        busyRef.current = true;
        Taro.chooseMedia({
            count: 1,
            mediaType: ["image"],
            sourceType: ["album"],
            sizeType: ["compressed"]
        })
            .then((res: any) => {
                const path = res.tempFiles?.[0]?.tempFilePath;
                if (path) return deliver({ path, source: "album" });
                busyRef.current = false;
            })
            .catch((err: any) => {
                busyRef.current = false;
                if (/cancel/i.test(err?.errMsg || "")) return;
                void Taro.showToast({ title: t("无法读取图片，请重试"), icon: "none" });
            });
    };

    const switchCamera = () => {
        if (status !== "live") return;
        setPosition((prev) => (prev === "back" ? "front" : "back"));
    };

    const goBack = () => {
        Taro.navigateBack();
    };

    // 首次进入、从等待页取消、选图返回、设置返回、切回前台：清除定格并按真实权限恢复取景
    useDidShow(() => {
        setFrozenPath("");
        busyRef.current = false;
        void syncCamera(firstRef.current);
        firstRef.current = false;
    });

    useDidHide(() => {
        stopCamera();
    });

    useUnload(() => {
        stopCamera();
        Taro.eventCenter.trigger(CAPTURE_CLOSED_EVENT, { unavailable: false });
    });

    return (
        <View className="capture">
            {/* 取景区固定 3:4，范围就是成片范围；离开页面或定格后卸载组件以释放摄像头 */}
            {cameraOn && !frozenPath && (
                <Camera
                    className="capture__finder"
                    style={finderStyle}
                    devicePosition={position}
                    flash="off"
                    onInitDone={() => setStatus("live")}
                    onError={onCameraError}
                />
            )}

            {/* 拍照或选图后定格：整个屏幕当显示区，图片居中完整显示，与等待页的画面一致 */}
            {frozenPath && <Image className="capture__finder" style={screenStyle} src={frozenPath} mode="aspectFit" />}

            {status === "live" && !frozenPath && (
                <>
                    <View className="capture__corner capture__corner--tl" style={cornerStyles.tl} />
                    <View className="capture__corner capture__corner--tr" style={cornerStyles.tr} />
                    <View className="capture__corner capture__corner--bl" style={cornerStyles.bl} />
                    <View className="capture__corner capture__corner--br" style={cornerStyles.br} />
                    <View className="capture__hint-row" style={hintStyle}>
                        <Text className="capture__hint">{t("对准商品拍摄")}</Text>
                    </View>
                </>
            )}

            {/* 相机未授权或不可用时说明原因，相册仍然可用 */}
            {notice && !frozenPath && (
                <View className="capture__finder capture__notice" style={finderStyle}>
                    <Text className="capture__notice-title">{t(notice.title)}</Text>
                    <Text className="capture__notice-desc">{t(notice.desc)}</Text>
                    <View className="capture__notice-btn" onClick={onNoticeAction}>
                        {t(notice.action)}
                    </View>
                </View>
            )}

            <View className="capture__back" style={backStyle} onClick={goBack}>
                <Image className="capture__icon" src={iconBack} mode="aspectFit" />
            </View>

            <View className="capture__panel" style={panelStyle}>
                <View className="capture__side" onClick={pickFromAlbum}>
                    <View className="capture__round">
                        <Image className="capture__icon" src={iconAlbum} mode="aspectFit" />
                    </View>
                    <Text className="capture__side-text">{t("相册")}</Text>
                </View>
                <View className={`capture__shutter ${status !== "live" ? "capture__shutter--off" : ""}`} onClick={takePhoto}>
                    <View className="capture__shutter-inner" />
                </View>
                <View className="capture__side" onClick={switchCamera}>
                    <View className="capture__round">
                        <Text className="iconfont-h5 icon-qiehuan1 capture__switch" />
                    </View>
                    <Text className="capture__side-text">{t("翻转")}</Text>
                </View>
            </View>
        </View>
    );
}
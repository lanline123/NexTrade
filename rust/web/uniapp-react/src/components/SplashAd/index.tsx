import { useEffect, useRef, useState } from "react";
import { CoverView, Image, Video, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { imageFormat, urlFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    adType: "image" | "video";
    adUrl: string;
    duration?: number;
    redirectType?: string;
    redirectUrl?: string;
    /** 对应旧 emit("close") */
    onClose?: () => void;
}

/**
 * 开屏广告（自旧 components/SplashAd/index.vue 131 行移植）。
 *
 * 行为逐条对齐旧实现：
 * - 素材加载完成（image @load / video loadedmetadata）后才开始倒计时并露出"跳过"；
 * - 倒计时归零自动关闭；video 播完（ended）也关闭；
 * - 点击素材：redirectType == "1" 时按 redirectUrl 跳转并关闭，其余类型只打日志（旧代码注释掉的分支同样保留为注释语义）；
 * - 旧 close-btn 的端差异（weapp 左上 / h5 右上）改为 TARO_ENV 下不同 className。
 */
export default function SplashAd({ adType, adUrl, duration = 3, redirectType, redirectUrl, onClose }: Props) {
    const [show, setShow] = useState(true);
    const [loaded, setLoaded] = useState(false);
    const [countdown, setCountdown] = useState(duration || 3);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const closedRef = useRef(false);

    const clearTimer = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    useEffect(() => {
        return () => clearTimer();
    }, []);

    const closeAd = () => {
        if (closedRef.current) return;
        closedRef.current = true;
        setShow(false);
        clearTimer();
        onClose?.();
    };

    const onLoaded = () => {
        if (loaded || closedRef.current) return;
        setLoaded(true);
        timerRef.current = setInterval(() => {
            setCountdown((prev) => {
                const next = prev - 1;
                if (next <= 0) {
                    closeAd();
                }
                return next;
            });
        }, 1000);
    };

    const handleAdClick = () => {
        if (redirectType == "1") {
            Taro.navigateTo({ url: urlFormat(redirectUrl || "") });
            closeAd();
        }
    };

    const isWeapp = process.env.TARO_ENV === "weapp";
    const closeBtnClass = `close-btn${isWeapp ? " close-btn--weapp" : " close-btn--h5"}`;

    if (!show) return null;

    return (
        <View className="splash-ad">
            {adType === "image" ? (
                <Image className="ad-img" src={imageFormat(adUrl)} mode="aspectFill" onLoad={onLoaded} onClick={handleAdClick} />
            ) : (
                <Video
                    className="ad-video"
                    src={imageFormat(adUrl)}
                    objectFit="cover"
                    autoplay
                    controls={false}
                    showCenterPlayBtn={false}
                    showPlayBtn={false}
                    showFullscreenBtn={false}
                    enableProgressGesture={false}
                    muted
                    loop
                    onEnded={closeAd}
                    onLoadedMetaData={onLoaded}
                    onClick={handleAdClick}
                >
                    {loaded && (
                        <CoverView className={`${closeBtnClass} close-btn--cover`} onClick={(e) => { e.stopPropagation(); closeAd(); }}>
                            {countdown} {t("跳过")}
                        </CoverView>
                    )}
                </Video>
            )}
            {adType !== "video" && loaded && (
                <View className={closeBtnClass} onClick={(e) => { e.stopPropagation(); closeAd(); }}>
                    {countdown} {t("跳过")}
                </View>
            )}
        </View>
    );
}

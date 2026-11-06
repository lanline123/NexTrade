import { useEffect, useRef, useState } from "react";
import { View, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { imageFormat } from "@/utils/format";
import { staticResource, guid } from "@/utils";
import { useConfigStore } from "@/store/config";

import "./TigLazyImage.scss";

interface Props {
    src?: string;
    mode?: string;
    threshold?: number;
    onLoad?: (e: any) => void;
    onError?: (e: any) => void;
}

/** 懒加载图片（自旧 tig-lazy-image.vue 移植）：视口交叉观察 + 骨架屏 + 失败占位 */
export default function TigLazyImage({ src = "", mode = "widthFix", threshold = 100, onLoad, onError }: Props) {
    const storageUrl = useConfigStore((s) => s.storageUrl);
    const rootRef = useRef<any>(null);
    const elUid = useRef(guid()).current;

    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingEnd, setIsLoadingEnd] = useState(false);
    const [srcData, setSrcData] = useState("");
    const [show, setShow] = useState(false);
    const observerRef = useRef<any>(null);

    // 与 tig-image 相同：等 storageUrl 就绪后再拼相对路径；完整 URL 勿因 storageUrl 变化重置 loading
    useEffect(() => {
        if (!src) {
            setIsError(true);
            setIsLoading(false);
            setIsLoadingEnd(true);
            setSrcData("");
            return;
        }
        if (!String(src).includes("http") && !storageUrl) {
            setIsError(false);
            setIsLoading(true);
            setIsLoadingEnd(false);
            setSrcData("");
            return;
        }
        const next = imageFormat(src);
        setSrcData((current) => {
            if (next === current) return current;
            setIsError(false);
            setIsLoading(true);
            setIsLoadingEnd(false);
            return next;
        });
    }, [src, storageUrl]);

    const handleLoad = (e: any) => {
        setIsLoading(false);
        setIsLoadingEnd(true);
        setIsError(false);
        onLoad?.(e);
    };

    const handleError = (e: any) => {
        setIsError(true);
        setIsLoading(false);
        setIsLoadingEnd(true);
        onError?.(e);
    };

    const disposeObserver = () => {
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }
    };

    useEffect(() => {
        if (process.env.TARO_ENV === "h5") {
            // H5 端 Taro IntersectionObserver 观察自定义组件根节点不稳定，直接展示（懒加载收益主要在小程序端）
            setShow(true);
            return;
        }
        try {
            const observer = Taro.createIntersectionObserver(rootRef.current as any, { thresholds: [0] });
            observer
                .relativeToViewport({ top: 0, bottom: threshold })
                .observe(`.base-image-box${elUid}`, (res: any) => {
                    setShow(res.intersectionRatio > 0);
                    if (res.intersectionRatio > 0) disposeObserver();
                });
            observerRef.current = observer;
        } catch {
            setShow(true);
        }
        return () => disposeObserver();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <View className="tig-lazy-image" ref={rootRef as any}>
            <View className={`base-image-box base-image-box${elUid}`}>
                {!isError && show && (
                    <Image className={`base-image ${!isLoading ? "loading-end" : ""}`} src={srcData} mode={mode as any} onLoad={handleLoad} onError={handleError} />
                )}
                {!isLoading && isError && <Image className="base-image empty" src={staticResource("common/empty-img-bg3.png")} mode={mode as any} />}
                {!isLoadingEnd && !isError && (
                    <View className="base-skeleton shan">
                        <View className="block" />
                    </View>
                )}
            </View>
        </View>
    );
}

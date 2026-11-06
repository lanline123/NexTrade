import { useEffect, useRef, useState } from "react";
import { View, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { imageFormat } from "@/utils/format";
import { staticResource } from "@/utils";
import { useConfigStore } from "@/store/config";

import "./TigImage.scss";

interface Props {
    src: string;
    mode?: string;
    preview?: boolean;
    /** 透传到根节点（对齐旧 Vue class 透传语义） */
    className?: string;
    onLoad?: (e: any) => void;
    onError?: (e: any) => void;
    onClick?: (e: any) => void;
}

/**
 * 基础图片组件（自旧 tig-image.vue 移植）：
 * - 相对路径按 storageUrl 补全；域名未就绪时先不请求，避免闪烁
 * - loading 态 opacity 过渡 + 3s 兜底超时（事件丢失不致整图不可见）
 * - 失败回退占位图
 */
export default function TigImage({ src, mode = "widthFix", preview = false, className, onLoad, onError, onClick }: Props) {
    const storageUrl = useConfigStore((s) => s.storageUrl);
    const [isError, setIsError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [srcData, setSrcData] = useState("");
    // 最近一次加载成功的最终地址。@load 只在 src 真正变化时才会再来一次，
    // 所以「这张图已经显示出来了」这个事实必须自己记住，不能靠事件重放。
    const loadedSrcRef = useRef("");
    const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 兜底时长：超时后即便没收到 @load 也结束 loading
    const LOAD_TIMEOUT = 3000;

    const clearLoadTimer = () => {
        if (loadTimerRef.current) {
            clearTimeout(loadTimerRef.current);
            loadTimerRef.current = null;
        }
    };

    useEffect(() => {
        if (!src) {
            clearLoadTimer();
            setSrcData("");
            loadedSrcRef.current = "";
            setIsError(true);
            setIsLoading(false);
            return;
        }
        // 相对路径且域名未就绪：先不请求，等 storageUrl 到位再拼
        if (!String(src).includes("http") && !storageUrl) {
            clearLoadTimer();
            setIsError(false);
            setIsLoading(true);
            setSrcData("");
            return;
        }
        const next = imageFormat(src);
        setSrcData((current) => {
            // 同一地址已经加载成功过：直接恢复展示态。O2O 首页会被定位与门店接口拖到 1s 后
            // 才写入 storageUrl，此时图片早已加载完成，走重置分支就再也亮不回来了。
            if (next === current && next === loadedSrcRef.current) {
                clearLoadTimer();
                setIsError(false);
                setIsLoading(false);
                return current;
            }
            // 地址没变且上次没失败：维持当前加载态，等 @load 收尾
            if (next === current && !isError) {
                return current;
            }
            setIsError(false);
            setIsLoading(true);
            loadedSrcRef.current = "";
            clearLoadTimer();
            loadTimerRef.current = setTimeout(() => {
                loadTimerRef.current = null;
                setIsLoading((loading) => {
                    if (loading) {
                        setIsError((err) => {
                            if (!err) return false;
                            return err;
                        });
                        return false;
                    }
                    return loading;
                });
            }, LOAD_TIMEOUT);
            return next;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [src, storageUrl]);

    useEffect(() => {
        return () => {
            clearLoadTimer();
        };
    }, []);

    const handleLoad = (e: any) => {
        clearLoadTimer();
        loadedSrcRef.current = srcData;
        setIsLoading(false);
        setIsError(false);
        onLoad?.(e);
    };

    const handleError = (e: any) => {
        clearLoadTimer();
        setIsError(true);
        setIsLoading(false);
        onError?.(e);
    };

    const showBigPic = (e: any) => {
        if (preview && srcData) {
            Taro.previewImage({
                urls: [srcData]
            }).catch(() => {});
        }
        onClick?.(e);
    };

    return (
        <View className={`base-image-box${className ? ` ${className}` : ""}`} onClick={showBigPic}>
            {!isError && (
                <Image
                    className={`base-image ${!isLoading ? "loading-end" : ""}`}
                    src={srcData}
                    mode={mode as any}
                    onLoad={handleLoad}
                    onError={handleError}
                />
            )}
            {!isLoading && isError && <Image className="base-image empty" src={staticResource("common/empty-img-bg3.png")} mode={mode as any} />}
        </View>
    );
}

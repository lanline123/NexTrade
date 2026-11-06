import { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { rpx2px } from "@/utils";

import "./index.scss";

interface Props {
    text?: string;
    maxLines?: number;
    /** 单位 rpx */
    fontSize?: number;
    /** 单位 rpx，用于扣除同行其他元素（如标签）的宽度 */
    offsetWidth?: number;
}

/**
 * 可展开文本（自旧 pages/product/src/expandableText.vue 移植）：
 * 用隐藏 canvas 测量文字宽度，溢出时截断为「首段 + 展开图标 + 余段」结构。
 */
export default function ExpandableText({ text = "", maxLines = 2, fontSize = 32, offsetWidth = 0 }: Props) {
    // 旧实现用 Date.now() 生成组件实例级唯一 id，保持一致（同页面多实例不冲突）
    const idsRef = useRef({
        containerId: `container-${Date.now()}`,
        canvasId: `canvas-${Date.now()}`
    });
    const [isExpanded, setIsExpanded] = useState(false);
    const [isOverflow, setIsOverflow] = useState(false);
    const [firstPart, setFirstPart] = useState("");
    const [restPart, setRestPart] = useState("");
    const [showCanvas, setShowCanvas] = useState(false);
    // 旧实现 checkOverflow 失败时 setTimeout(checkOverflow, 100) 重试，需要可重入的闭包
    const checkOverflowRef = useRef<() => void>(() => {});
    const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // 图标宽度用 rpx2px 估算即可，稍微留点余量（对应旧 uni.upx2px(32)）
    const iconWidth = rpx2px(32);

    const toggleExpand = () => {
        setIsExpanded((v) => !v);
    };

    // 使用 canvas 测量文字宽度并判断是否溢出、计算截断位置
    const measureText = useCallback(
        (containerWidth: number, fontSizePx: number, offsetWidthPx: number) => {
            // TODO(MIGRATION)：Taro.createCanvasContext 在 H5 下按页面级 canvasId 查找，
            // 旧实现为组件实例作用域（uni.createCanvasContext(canvasId, instance)），
            // 依赖 canvasId 唯一性保证不串。CanvasContext.setFontSize/measureText 为 Taro 同名 API。
            const ctx = Taro.createCanvasContext(idsRef.current.canvasId);
            ctx.setFontSize(fontSizePx);

            // 第一行需要扣除 offsetWidth
            const firstLineWidth = containerWidth - offsetWidthPx;
            const maxWidth = firstLineWidth + containerWidth * (maxLines - 1);

            // 测量文字总宽度
            let totalWidth = 0;
            const charWidths: number[] = [];
            for (const char of text) {
                const w = ctx.measureText(char).width;
                charWidths.push(w);
                totalWidth += w;
            }

            // 判断是否溢出
            const needOverflow = totalWidth > maxWidth;
            setIsOverflow(needOverflow);

            if (needOverflow) {
                // 计算截断位置（留出图标宽度和间距）
                const targetWidth = maxWidth - iconWidth;
                let currentWidth = 0;
                let splitIndex = text.length;

                for (let i = 0; i < charWidths.length; i++) {
                    if (currentWidth + charWidths[i] > targetWidth) {
                        splitIndex = i;
                        break;
                    }
                    currentWidth += charWidths[i];
                }

                setFirstPart(text.slice(0, splitIndex));
                setRestPart(text.slice(splitIndex));
            }

            // 测量完成后销毁 canvas
            setShowCanvas(false);
        },
        [text, maxLines, iconWidth]
    );

    // 对应旧 checkOverflow：先挂载 canvas，再在 nextTick 后查询容器尺寸
    checkOverflowRef.current = () => {
        setShowCanvas(true);
        // 对应旧 nextTick
        setTimeout(() => {
            const query = Taro.createSelectorQuery();
            query
                .select(`#${idsRef.current.containerId}`)
                .fields({ size: true, computedStyle: ["fontSize"] }, () => {});

            query.exec((results: any[]) => {
                const containerRes = results?.[0];

                if (!containerRes || containerRes.width === 0) {
                    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
                    retryTimerRef.current = setTimeout(() => checkOverflowRef.current(), 100);
                    return;
                }

                const fontSizePx = parseFloat(containerRes.fontSize) || rpx2px(fontSize);
                const offsetWidthPx = rpx2px(offsetWidth);
                measureText(containerRes.width, fontSizePx, offsetWidthPx);
            });
        }, 0);
    };

    // 对应旧 watch(text, immediate: true)
    useEffect(() => {
        setIsExpanded(false);
        setIsOverflow(false);
        checkOverflowRef.current();
    }, [text]);

    // 对应旧 onMounted(checkOverflow)
    useEffect(() => {
        checkOverflowRef.current();
        return () => {
            if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        };
    }, []);

    return (
        <View id={idsRef.current.containerId} className="expandable-text">
            {isOverflow ? (
                <>
                    <Text>{firstPart}</Text>
                    {!isExpanded ? (
                        <Text
                            className="expand-icon iconfont-h5 icon-up rotate"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand();
                            }}
                        />
                    ) : null}
                    {isExpanded ? <Text className="rest-part fade-in">{restPart}</Text> : null}
                    {isExpanded ? (
                        <Text
                            className="expand-icon iconfont-h5 icon-up"
                            onClick={(e) => {
                                e.stopPropagation();
                                toggleExpand();
                            }}
                        />
                    ) : null}
                </>
            ) : (
                <Text>{text}</Text>
            )}
            {/* 隐藏的 canvas 用于测量文字宽度 */}
            {showCanvas ? <Canvas id={idsRef.current.canvasId} canvasId={idsRef.current.canvasId} className="measure-canvas" /> : null}
        </View>
    );
}

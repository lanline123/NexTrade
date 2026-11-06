import { useEffect, type CSSProperties } from "react";
import { View } from "@tarojs/components";

import "./Animation.scss";

interface Props {
    animationPosition: { top: number; left: number };
    styleVariable: {
        "--y": string;
        "--x": string;
    };
    /** 对应旧 defineModel（默认 false） */
    modelValue?: boolean;
    /** 对应旧 update:modelValue */
    onUpdateModelValue?: (val: boolean) => void;
}

/**
 * 加入购物车动画组件（自旧 pages/productV1/src/animation.vue 移植）
 * - 商品图片飞入购物车抛物线动画
 * - CSS动画实现平滑过渡效果
 * - 原 v-bind("props.animationPosition.top + 'px'") / left → 内联 style（原 scss 位置见 Animation.scss 注释）
 * 旧源与 pages/product/src/animation.vue 逐字一致，props 契约一致，直接沿用 B2 迁移实现。
 */
export default function Animation({ animationPosition, styleVariable, modelValue = false, onUpdateModelValue }: Props) {
    const setShowAnimation = (val: boolean) => {
        onUpdateModelValue?.(val);
    };

    let timeout: ReturnType<typeof setTimeout>;

    // 原 #ifdef MP-WEIXIN
    useEffect(() => {
        if (process.env.TARO_ENV === "weapp") {
            if (modelValue) {
                timeout = setTimeout(() => {
                    setShowAnimation(false);
                    clearTimeout(timeout);
                }, 290);
            }
        }
    }, [modelValue]);

    const handleAnimationEnd = () => {
        // 原 #ifdef MP-WEIXIN
        if (process.env.TARO_ENV === "weapp") {
            return;
        }
        setShowAnimation(false);
    };

    /* 自定义属性 --x / --y 需断言为 CSSProperties 才能进入 style 对象 */
    const cssVariables = styleVariable as CSSProperties;

    return (
        <View
            className={`animation-box ${modelValue ? "animation" : ""}`}
            style={{
                ...cssVariables,
                // 原 .animation { top: v-bind(top+'px'); left: v-bind(left+'px') } → 内联 style
                top: `${animationPosition.top}px`,
                left: `${animationPosition.left}px`
            }}
        >
            <View className="animation-content" onAnimationEnd={handleAnimationEnd} />
        </View>
    );
}
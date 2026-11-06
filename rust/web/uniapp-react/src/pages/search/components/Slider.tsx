import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";

import { getElementRect } from "@/utils";
import { t } from "@/utils/i18n";
import FormatPrice from "@/components/format-price/FormatPrice";

import "./Slider.scss";

interface Props {
    maxPrice?: number;
    currentMax?: number;
    /** 对应旧 emit("sliderMany", { minPrice, maxPrice }) */
    onSliderMany?: (payload: { minPrice: number; maxPrice: number }) => void;
}

export interface SliderRef {
    /** 重置滑杆到 0 ~ currentMax（对应旧 defineExpose init） */
    init: () => void;
}

/**
 * 价格区间滑杆（自旧 pages/search/components/slider.vue 移植）。
 * - 双滑块拖动 / 点击轨道就近吸附 / H5 鼠标拖动，逻辑与旧版逐行对齐
 * - 旧版 uni.createSelectorQuery().in(proxy) 取 .slider-bar 矩形，
 *   React 版改用 getElementRect(selector, rootRef.current)
 */
const Slider = forwardRef<SliderRef, Props>(function Slider({ maxPrice = 0, currentMax = 0, onSliderMany }: Props, ref) {
    // React 版用组件根节点 ref 替代 Vue getCurrentInstance()，供选择器查询圈定范围
    const rootRef = useRef<any>(null);

    // 旧版 setup 内 `const max = props.maxPrice` 创建时捕获一次；滑杆按 maxPrice>0 条件渲染，
    // 挂载时 maxPrice 已就绪，这里用 ref 同步等价复现
    const maxRef = useRef(maxPrice);
    maxRef.current = maxPrice;
    // init 等暴露方法里要读最新 props，镜像到 ref
    const propsRef = useRef({ maxPrice, currentMax });
    propsRef.current = { maxPrice, currentMax };

    const emitSliderMany = (minPrice: number, maxPriceVal: number) => {
        // 对应旧 emit("sliderMany", { minPrice, maxPrice })
        onSliderMany?.({ minPrice, maxPrice: maxPriceVal });
    };

    // Vue ref 为同步读写；这些值既驱动渲染，又会在异步 rect 回调 / document 监听器闭包里读写，
    // 统一「state + ref 镜像」双写
    const [leftValueState, setLeftValueState] = useState(0);
    const leftValueRef = useRef(0);
    const setLeftValue = (value: number) => {
        leftValueRef.current = value;
        setLeftValueState(value);
    };

    const [rightValueState, setRightValueState] = useState(maxPrice || 0);
    const rightValueRef = useRef(maxPrice || 0);
    const setRightValue = (value: number) => {
        rightValueRef.current = value;
        setRightValueState(value);
    };

    const [leftPercentState, setLeftPercentState] = useState(() => valueToPercent(0, maxPrice));
    const leftPercentRef = useRef(leftPercentState);
    const setLeftPercent = (value: number) => {
        leftPercentRef.current = value;
        setLeftPercentState(value);
    };

    const [rightPercentState, setRightPercentState] = useState(() => valueToPercent(maxPrice || 0, maxPrice));
    const rightPercentRef = useRef(rightPercentState);
    const setRightPercent = (value: number) => {
        rightPercentRef.current = value;
        setRightPercentState(value);
    };

    function valueToPercent(val: number, max: number) {
        return ((val - 0) / (max - 0)) * 100;
    }

    function percentToValue(percent: number) {
        return Math.round((percent / 100) * (maxRef.current - 0) + 0);
    }

    const init = () => {
        const { maxPrice: maxPriceNow, currentMax: currentMaxNow } = propsRef.current;
        setLeftValue(0);
        setRightValue(maxPriceNow || maxRef.current);
        if (currentMaxNow && currentMaxNow <= maxPriceNow) {
            setRightValue(currentMaxNow);
        }
        setLeftPercent(valueToPercent(leftValueRef.current, maxPriceNow));
        setRightPercent(valueToPercent(rightValueRef.current, maxPriceNow));
    };

    // 旧版 setup 末尾立即调用 init()
    useEffect(() => {
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useImperativeHandle(ref, () => ({
        init
    }));

    function emitValue() {
        const minPrice = Math.min(leftValueRef.current, rightValueRef.current);
        const maxPriceVal = Math.max(leftValueRef.current, rightValueRef.current);
        emitSliderMany(minPrice, maxPriceVal);
    }

    /** 按触点/鼠标位置计算落点并分配给对应滑块（onDrag 与 onMouseMove 共用逻辑） */
    const applyDragPercent = (which: string, pageX: number) => {
        getElementRect(".slider-bar", rootRef.current).then((data) => {
            if (!data) return;
            const { left, width } = data as { left: number; width: number };
            if (typeof left !== "number" || typeof width !== "number") return;

            let percent = ((pageX - left) / width) * 100;
            percent = Math.max(0, Math.min(percent, 100));
            const value = percentToValue(percent);

            if (which === "left") {
                if (percent > rightPercentRef.current) {
                    setRightPercent(percent);
                    setRightValue(value);
                } else {
                    setLeftPercent(percent);
                    setLeftValue(value);
                }
            } else {
                if (percent < leftPercentRef.current) {
                    setLeftPercent(percent);
                    setLeftValue(value);
                } else {
                    setRightPercent(percent);
                    setRightValue(value);
                }
            }
        });
    };

    function onDrag(which: string, e: any) {
        const touch = e.touches[0] || e.changedTouches[0];
        applyDragPercent(which, touch.pageX);
    }

    function clickBar(e: any) {
        const touch = e.touches?.[0] || e.changedTouches?.[0] || e;
        getElementRect(".slider-bar", rootRef.current).then((data) => {
            if (!data) return;
            const { left, width } = data as { left: number; width: number };
            if (typeof left !== "number" || typeof width !== "number") return;

            let percent = ((touch.pageX - left) / width) * 100;
            percent = Math.max(0, Math.min(percent, 100));
            const value = percentToValue(percent);
            if (Math.abs(value - leftValueRef.current) < Math.abs(value - rightValueRef.current)) {
                setLeftPercent(percent);
                setLeftValue(value);
            } else {
                setRightPercent(percent);
                setRightValue(value);
            }
        });
    }

    // 鼠标拖动相关变量（H5）
    const isDraggingRef = useRef(false);
    const currentDragWhichRef = useRef<string>("");

    function onMouseDown(which: string, e: MouseEvent) {
        e.preventDefault();
        e.stopPropagation();
        isDraggingRef.current = true;
        currentDragWhichRef.current = which;

        // 添加全局鼠标移动和松开事件监听
        if (typeof document !== "undefined") {
            document.addEventListener("mousemove", onMouseMove);
            document.addEventListener("mouseup", onMouseUp);
        }
    }

    function onMouseMove(e: MouseEvent) {
        if (!isDraggingRef.current) return;
        applyDragPercent(currentDragWhichRef.current, e.pageX);
    }

    function onMouseUp() {
        if (isDraggingRef.current) {
            isDraggingRef.current = false;
            currentDragWhichRef.current = "";
            emitValue();

            if (typeof document !== "undefined") {
                document.removeEventListener("mousemove", onMouseMove);
                document.removeEventListener("mouseup", onMouseUp);
            }
        }
    }

    return (
        <View className="container" ref={rootRef}>
            <Text className="title">{t("价格")}</Text>
            <View className="price-labels">
                {/* 旧版 fontStyle 原样保留（含 '##1a1a1a' 笔误，保持渲染一致） */}
                <FormatPrice fontStyle={{ color: "##1a1a1a", "font-size": "25rpx" } as any} priceData={leftValueState} />
                <FormatPrice fontStyle={{ color: "##1a1a1a", "font-size": "25rpx" } as any} priceData={rightValueState} />
            </View>
            <View className="slider-bar-box">
                <View className="slider-bar" onClick={clickBar}>
                    <View
                        className="active-bar"
                        style={{
                            left: `${Math.min(leftPercentState, rightPercentState)}%`,
                            width: `${Math.abs(leftPercentState - rightPercentState)}%`
                        }}
                    />

                    <View
                        className="block left"
                        style={{ left: `${leftPercentState}%` }}
                        onTouchMove={(e) => {
                            e.stopPropagation();
                            onDrag("left", e);
                        }}
                        onTouchEnd={emitValue}
                        {...({ onMouseDown: (e: any) => onMouseDown("left", e) } as any)}
                    />

                    <View
                        className="block right"
                        style={{ left: `${rightPercentState}%` }}
                        onTouchMove={(e) => {
                            e.stopPropagation();
                            onDrag("right", e);
                        }}
                        onTouchEnd={emitValue}
                        {...({ onMouseDown: (e: any) => onMouseDown("right", e) } as any)}
                    />
                </View>
            </View>
        </View>
    );
});

export default Slider;

import { useEffect, useRef, useState } from "react";
import { Input, Text, View } from "@tarojs/components";

import "./TigNumberBox.scss";

interface Props {
    value?: number;
    max?: number;
    min?: number;
    inputWidth?: number | string;
    buttonSize?: number | string;
    buttonWidth?: number | string;
    iconStyle?: string;
    disabled?: boolean;
    onChange?: (value: number) => void;
    /** 超出 min/max 边界时触发，"minus" | "plus"（对齐 tig-number-box / u-number-box overlimit 事件） */
    onOverlimit?: (direction: "minus" | "plus") => void;
}

/**
 * 数量步进器（自旧 tig-number-box.vue 移植，旧组件基于 u-number-box 定制输入框）：
 * - 聚焦时可清空；失焦且未输入时回填最小值
 * - 点击越过 min/max 边界时触发 onOverlimit("minus" | "plus")
 */
export default function TigNumberBox({
    value = 1,
    max = 99,
    min = 1,
    inputWidth = 35,
    buttonSize = 30,
    buttonWidth = 35,
    iconStyle = "",
    disabled = false,
    onChange,
    onOverlimit
}: Props) {
    const [focused, setFocused] = useState(false);
    const [inputText, setInputText] = useState("");
    const valueRef = useRef(value);
    valueRef.current = value;

    const clampValue = (num: number) => {
        const minValue = Number(min);
        const maxValue = Number(max);
        return Math.max(Math.min(maxValue, num), minValue);
    };

    // 聚焦期间外部值变化时回填输入框（对应旧 watch modelValue）
    useEffect(() => {
        if (!focused) return;
        const textNum = Number(inputText);
        if (inputText !== "" && Number.isFinite(textNum) && textNum === value) return;
        setInputText(value == null ? "" : String(value));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [value, focused]);

    const emitChange = (next: number) => {
        onChange?.(next);
    };

    const handleMinus = () => {
        if (disabled) return;
        if (Number(valueRef.current) <= Number(min)) {
            onOverlimit?.("minus");
            return;
        }
        emitChange(clampValue(Number(valueRef.current) - 1));
    };

    const handlePlus = () => {
        if (disabled) return;
        if (Number(valueRef.current) >= Number(max)) {
            onOverlimit?.("plus");
            return;
        }
        emitChange(clampValue(Number(valueRef.current) + 1));
    };

    const handleFocus = () => {
        setFocused(true);
        setInputText(value == null ? "" : String(value));
    };

    const handleInput = (e: any) => {
        const raw = typeof e?.detail?.value === "string" ? e.detail.value : typeof e?.target?.value === "string" ? e.target.value : "";
        const nextText = raw.replace(/[^\d]/g, "");
        setInputText(nextText);
        if (nextText === "") return;
        const num = Number(nextText);
        if (!Number.isFinite(num)) return;
        emitChange(clampValue(num));
    };

    const handleBlur = () => {
        setFocused(false);
        const raw = Number(inputText);
        const next = inputText !== "" && Number.isFinite(raw) ? clampValue(raw) : Number(min);
        setInputText("");
        if (next === value) return;
        emitChange(next);
    };

    const inputStyle = {
        width: `${inputWidth}px`,
        height: `${buttonSize}px`
    };

    return (
        <View className={`u-number-box ${disabled ? "u-number-box--disabled" : ""}`}>
            <View
                className={`u-number-box__minus u-number-box__btn ${Number(value) <= Number(min) ? "u-number-box__btn--disabled" : ""}`}
                style={{ width: `${buttonWidth}px`, height: `${buttonSize}px` }}
                onClick={handleMinus}
            >
                <Text className="u-number-box__icon" style={iconStyle}>
                    -
                </Text>
            </View>
            <Input
                className="u-number-box__input number-box-input"
                type="number"
                disabled={disabled}
                value={focused ? inputText : String(value ?? min)}
                style={inputStyle}
                onFocus={handleFocus}
                onInput={handleInput}
                onBlur={handleBlur}
            />
            <View
                className={`u-number-box__plus u-number-box__btn ${Number(value) >= Number(max) ? "u-number-box__btn--disabled" : ""}`}
                style={{ width: `${buttonWidth}px`, height: `${buttonSize}px` }}
                onClick={handlePlus}
            >
                <Text className="u-number-box__icon" style={iconStyle}>
                    +
                </Text>
            </View>
        </View>
    );
}

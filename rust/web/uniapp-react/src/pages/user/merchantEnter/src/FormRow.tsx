import type { CSSProperties, ReactNode } from "react";
import { Text, View } from "@tarojs/components";

interface FormRowProps {
    label?: ReactNode;
    required?: boolean;
    /** 旧 up-form-item label-position */
    labelPosition?: "left" | "top";
    className?: string;
    children?: ReactNode;
    onClick?: (event: any) => void;
}

/** 旧 up-form-item 等价自绘（左标签 + 右内容 / 顶部标签） */
export function FormRow({ label, required = false, labelPosition = "left", className = "", children, onClick }: FormRowProps) {
    return (
        <View className={`form-row${labelPosition === "top" ? " is-top" : ""}${className ? ` ${className}` : ""}`} onClick={onClick}>
            {label !== undefined && (
                <View className="form-row-label">
                    {required && <Text className="form-required">*</Text>}
                    <Text>{label}</Text>
                </View>
            )}
            <View className="form-row-content">{children}</View>
        </View>
    );
}

interface RadioItemProps {
    checked?: boolean;
    label: string;
    style?: CSSProperties;
    onSelect?: () => void;
}

/** 旧 up-radio（circle 形状、主题色）等价自绘 */
export function RadioItem({ checked = false, label, style, onSelect }: RadioItemProps) {
    return (
        <View className="radio-item" style={style} onClick={() => onSelect?.()}>
            <View className={`radio-dot${checked ? " checked" : ""}`}>{checked && <View className="radio-dot-inner" />}</View>
            <Text className="radio-label">{label}</Text>
        </View>
    );
}
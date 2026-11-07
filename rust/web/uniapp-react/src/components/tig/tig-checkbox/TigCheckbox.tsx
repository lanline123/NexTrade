import type { CSSProperties, ReactNode } from "react";
import { Text, View } from "@tarojs/components";

import { useThemeStore } from "@/store/theme";

import "./TigCheckbox.scss";

interface Props {
    /** 勾选框右侧文案 */
    checkedText?: string;
    /** 勾选框缩放系数（旧 checked-size，up-checkbox 默认 20px 基准） */
    checkedSize?: number;
    checked?: boolean;
    disabled?: boolean;
    /** circle（圆形）/ square（方角圆角矩形） */
    shape?: "circle" | "square";
    /** 文案字号（旧 size，单位 px） */
    size?: string;
    /** 勾选图标大小（如 "36rpx"）；留空用 20px * checkedSize */
    iconSize?: string;
    /** 选中色；留空取主题色 --general */
    activeColor?: string;
    className?: string;
    style?: CSSProperties | string;
    children?: ReactNode;
    /** 旧 @change（无参） */
    onChange?: () => void;
    /** 旧 update:checked（受控翻转） */
    onUpdateChecked?: (next: boolean) => void;
    onClick?: (event: any) => void;
}

/**
 * 复选框（自旧 components/tig/tig-checkbox/tig-checkbox.vue 移植，包装 up-checkbox）
 * - 点击整块 label 翻转（旧 onCheckAll 同时绑在 label 与 checkbox 上）
 * - 选中色 = activeColor || themeStore["--general"] || "#ee0a24"
 * - 类名沿用 u-checkbox__icon-wrap / u-checkbox__label，保旧页面局部覆盖样式生效
 */
export default function TigCheckbox({
    checkedText = "",
    checkedSize = 0.8,
    checked = false,
    disabled = false,
    shape = "circle",
    size = "15",
    iconSize = "",
    activeColor = "",
    className = "",
    style,
    children,
    onChange,
    onUpdateChecked,
    onClick
}: Props) {
    const themeGeneral = useThemeStore((s) => s.themeStyle["--general"]);
    const checkedColor = activeColor || themeGeneral || "#ee0a24";

    const icon = iconSize || `${Math.round(20 * checkedSize)}px`;

    const handleCheck = (event: any) => {
        onClick?.(event);
        if (disabled) return;
        onUpdateChecked?.(!checked);
        onChange?.();
    };

    return (
        <View className={`check tig-checkbox${disabled ? " tig-checkbox--disabled" : ""}${className ? ` ${className}` : ""}`} style={style as any} onClick={handleCheck}>
            <View
                className={`u-checkbox__icon-wrap u-checkbox__icon-wrap--${shape}${checked ? " u-checkbox__icon-wrap--checked" : ""}`}
                style={{ width: icon, height: icon, borderColor: checked ? checkedColor : "#c8c9cc", backgroundColor: checked ? checkedColor : "#fff" } as any}
            >
                {checked ? <Text className="u-checkbox__icon">✓</Text> : null}
            </View>
            {checkedText ? <Text className="u-checkbox__label" style={{ fontSize: `${size}px` } as any}>{checkedText}</Text> : null}
            {children}
        </View>
    );
}

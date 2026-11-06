import type { CSSProperties } from "react";
import { Input, Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./SearchInput.scss";

interface Props {
    /** 对应旧 v-model */
    value?: string;
    /** 对应旧 update:modelValue */
    onChange?: (value: string) => void;
    onConfirm?: (value: string) => void;
    onClear?: () => void;
    placeholder?: string;
    customStyle?: CSSProperties;
    clearable?: boolean;
    fontSize?: string;
    border?: string;
    prefixIcon?: string;
    prefixIconStyle?: CSSProperties | string;
}

const defaultStyle: CSSProperties = {
    backgroundColor: "#f7f8fa",
    borderRadius: "36rpx",
    padding: "10rpx 15rpx",
    height: "inherit"
};

/**
 * 搜索输入框组件（自旧 pages/salesman/src/searchInput.vue 移植）
 * - 带搜索图标的输入框
 * - 支持清空和提交搜索
 * - 旧 up-input → Taro Input + 基础组件自绘
 */
export default function SearchInput({
    value = "",
    onChange,
    onConfirm,
    onClear,
    placeholder = "商品搜索：请输入关键字",
    customStyle,
    clearable = true,
    fontSize = "14px",
    border = "none",
    prefixIcon = "search",
    prefixIconStyle = "font-size: 20px;"
}: Props) {
    const handleInput = (event: any) => {
        onChange?.(event.detail.value);
    };

    const handleConfirm = (event: any) => {
        onConfirm?.(event.detail.value);
    };

    const handleClear = () => {
        onChange?.("");
        onClear?.();
    };

    return (
        <View className="input-box">
            <View className={`search-input-box${border === "none" ? " no-border" : ""}`} style={customStyle || defaultStyle}>
                {prefixIcon && <View className="search-icon" style={prefixIconStyle as any} />}
                <Input
                    className="search-input"
                    value={value}
                    placeholder={t(placeholder)}
                    placeholderClass="search-placeholder"
                    confirmType="search"
                    style={{ fontSize }}
                    onInput={handleInput}
                    onConfirm={handleConfirm}
                />
                {clearable && value ? (
                    <View className="search-clear" onClick={handleClear}>
                        <Text className="search-clear__icon">×</Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
}
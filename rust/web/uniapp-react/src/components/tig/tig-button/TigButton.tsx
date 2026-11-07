import type { CSSProperties, ReactNode } from "react";
import { Button, Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./TigButton.scss";

type Shape = "circle" | "square";
type Type = "primary" | "success" | "warning" | "info";
type Size = "normal" | "large" | "small";

interface Props {
    shape?: Shape;
    type?: Type;
    /** 背景色（plain 时为描边/文字色）；默认 var(--main-bg)，由 TigLayout 注入主题 */
    color?: string;
    text?: string;
    disabled?: boolean;
    loading?: boolean;
    loadingText?: string;
    plain?: boolean;
    size?: Size;
    /** 兼容小程序的旧 customStyle（对象） */
    customStyle?: CSSProperties;
    className?: string;
    style?: CSSProperties | string;
    /** 旧 open-type（getPhoneNumber / contact / navigate 等），透传 Taro Button */
    openType?:
        | "contact"
        | "share"
        | "getPhoneNumber"
        | "getUserInfo"
        | "launchApp"
        | "openSetting"
        | "feedback"
        | "chooseAvatar"
        | "agreePrivacyAuthorization";
    onGetPhoneNumber?: (event: any) => void;
    onContact?: (event: any) => void;
    onError?: (event: any) => void;
    onOpenSetting?: (event: any) => void;
    onLaunchApp?: (event: any) => void;
    onChooseAvatar?: (event: any) => void;
    onAgreePrivacyAuthorization?: (event: any) => void;
    children?: ReactNode;
    onClick?: (event: any) => void;
}

/**
 * 通用按钮（自旧 components/tig/tig-button/tig-button.vue 移植，包装 up-button）
 * - 视觉对齐 uview-plus u-button：solid/plain、circle/square、三档尺寸
 * - openType 走 Taro Button 原生 open-type（手机号快捷登录/客服等场景依赖）
 * - displayText = text || t("确定")；有 slot（children）时渲染 children
 * - 默认色 var(--main-bg)（主题红），plain 模式描边 + 文字同色
 */
export default function TigButton({
    shape = "circle",
    type = "primary",
    color = "var(--main-bg)",
    text = "",
    disabled = false,
    loading = false,
    loadingText = "",
    plain = false,
    size = "normal",
    customStyle,
    className = "",
    style,
    openType,
    onGetPhoneNumber,
    onContact,
    onError,
    onOpenSetting,
    onLaunchApp,
    onChooseAvatar,
    onAgreePrivacyAuthorization,
    children,
    onClick
}: Props) {
    // 旧 up-button：type 影响预设色，但 color 恒传（默认 --main-bg）覆盖背景
    const bg = plain ? "#fff" : color;
    const fg = plain ? color : "#fff";
    const borderColor = color;

    const displayText = text || t("确定");
    const loadingDisplay = loadingText || displayText;

    const classNames = [
        "tig-button",
        `tig-button--${size}`,
        shape === "circle" ? "tig-button--circle" : "tig-button--square",
        disabled || loading ? "tig-button--disabled" : "",
        className
    ]
        .filter(Boolean)
        .join(" ");

    const innerStyle: CSSProperties = {
        backgroundColor: bg,
        color: fg,
        borderColor,
        ...(customStyle || {}),
        ...(style && typeof style === "object" ? (style as CSSProperties) : {})
    };

    return (
        <Button
            className={classNames}
            style={innerStyle as any}
            disabled={disabled || loading}
            hoverClass="none"
            openType={openType}
            onGetPhoneNumber={onGetPhoneNumber}
            onContact={onContact}
            onError={onError}
            onOpenSetting={onOpenSetting}
            onLaunchApp={onLaunchApp}
            onChooseAvatar={onChooseAvatar}
            onAgreePrivacyAuthorization={onAgreePrivacyAuthorization}
            onClick={(event) => {
                if (disabled || loading) return;
                onClick?.(event);
            }}
        >
            {loading ? (
                <View className="tig-button__content">
                    <View className="tig-button__spinner" />
                    <Text className="tig-button__text">{loadingDisplay}</Text>
                </View>
            ) : children !== undefined && children !== null ? (
                children
            ) : (
                <Text className="tig-button__text">{displayText}</Text>
            )}
        </Button>
    );
}

import { useMemo } from "react";
import { Image, Text, View } from "@tarojs/components";

import { t } from "@/utils/i18n";

import "./TigAuthBadge.scss";

interface Props {
    /** 是否已认证 */
    verified?: boolean;
    /** 样式：outline 橙色描边胶囊；tag 粉色渐变标签（用户信息3居中布局） */
    type?: "outline" | "tag";
    /** 标识高度（rpx） */
    height?: number;
}

const toSrc = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

// outline：圆底 + 断开的两笔 V（按原 authenticated.svg 描摹）
const outlineIcon = (color: string) =>
    toSrc(
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><circle cx="24" cy="24" r="24" fill="${color}"/><path d="M12.5 15h6.3l9.2 15.6L25.2 36z" fill="#fff"/><path d="M32.2 15h5.4l-7 12.8-3-5.4z" fill="#fff"/></svg>`
    );

// tag：无底色的粗体 V
const tagIcon = (color: string) =>
    toSrc(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36"><path d="M7 8.5h5.5l5 11.5 5.5-11.5h7l-9.5 19h-6z" fill="${color}"/></svg>`);

/**
 * 企业认证标识（自旧 components/tig/tig-auth-badge/tig-auth-badge.vue 移植）
 * 图标 + 可翻译文字（原图片内嵌中文，跨境无法翻译）
 */
export default function TigAuthBadge({ verified = false, type = "outline", height = 36 }: Props) {
    const iconSrc = useMemo(() => {
        if (type === "tag") {
            return tagIcon(verified ? "#fff" : "#999");
        }
        return outlineIcon(verified ? "#f8aa19" : "#c6c6c6");
    }, [type, verified]);

    const badgeStyle = {
        height: `${height}rpx`,
        paddingRight: `${Math.round(height * (type === "tag" ? 0.25 : 0.35))}rpx`,
        borderRadius: type === "tag" ? `${Math.round(height * 0.17)}rpx` : `${height}rpx`
    };
    const iconStyle = { width: `${height}rpx`, height: `${height}rpx` };
    const textStyle = {
        fontSize: `${Math.round(height * 0.6)}rpx`,
        marginLeft: type === "tag" ? "0" : `${Math.round(height * 0.15)}rpx`
    };

    return (
        <View className={`tig-auth-badge tig-auth-badge--${type}${verified ? "" : " tig-auth-badge--off"}`} style={badgeStyle}>
            <Image className="tig-auth-badge__icon" src={iconSrc} style={iconStyle} />
            <Text className="tig-auth-badge__text" style={textStyle}>
                {verified ? t("已认证") : t("未认证")}
            </Text>
        </View>
    );
}
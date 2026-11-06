import { useMemo } from "react";
import { Image, View } from "@tarojs/components";

import { designPxToRpx, gradientMap } from "@/components/modules";
import { imageFormat, pickPic } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./index.scss";

interface StyleOptions {
    showBtn?: number; // 是否显示按钮
    btnType?: number; // 按钮类型
    text?: string; // 按钮文字
    textColor?: string; // 按钮文字颜色
    iconColor?: string; // 按钮图标颜色
    gradientType?: string; // 按钮背景渐变类型
    gradientColorA?: string; // 按钮背景渐变颜色A
    gradientColorB?: string; // 按钮背景渐变颜色B
    radius?: number; // 按钮圆角
    paddingTopBottom?: number; // 按钮高度
    paddingLeftRight?: number; // 按钮宽度
    iconSize?: number;
    textSize?: number;
    iconImage?: any;
}

interface Props {
    styleOptions?: StyleOptions;
}

/** 通用购买按钮（自旧 commonBuyButton/index.vue 移植，供 productA1 等装修模块复用） */
export default function CommonBuyButton({
    styleOptions = {
        showBtn: 1, // 是否显示按钮
        btnType: 1, // 按钮类型
        text: "", // 按钮文字
        textColor: "#ffffff", // 按钮文字颜色
        iconColor: "#ffffff", // 按钮图标颜色
        gradientType: "leftRight", // 按钮背景渐变类型
        gradientColorA: "#333333", // 按钮背景渐变颜色A
        gradientColorB: "#333333", // 按钮背景渐变颜色B
        radius: 16, // 按钮圆角
        paddingTopBottom: 0, // 按钮高度
        paddingLeftRight: 10 // 按钮宽度
    }
}: Props) {
    // 新增字段对历史草稿做兜底：旧 buyBtnStyle 对象可能缺这些子字段（与 admin commonBuyButton 同源）
    const iconSizeVal = styleOptions.iconSize ?? 14;
    const textSizeVal = styleOptions.textSize ?? 12;
    const iconBoxWidth = Math.max(iconSizeVal, 24);
    const iconStyle = `color: ${styleOptions.iconColor}; font-weight: 400; font-size: ${designPxToRpx(iconSizeVal)};`;
    const iconImageSrc = useMemo(() => {
        const img = styleOptions.iconImage;
        if (!img || typeof img !== "object") return "";
        return pickPic(img);
    }, [styleOptions.iconImage]);

    const background = useMemo(() => {
        let str = "";
        if (styleOptions.gradientType !== "purity") {
            str = `background-image: linear-gradient(${gradientMap[styleOptions.gradientType]}, ${styleOptions?.gradientColorA}, ${styleOptions.gradientColorB});`;
        } else {
            str = `background-color:${styleOptions?.gradientColorA};`;
        }
        return str;
    }, [styleOptions.gradientType, styleOptions.gradientColorA, styleOptions.gradientColorB]);

    const paddingLeft = useMemo(() => {
        let str = "padding-left:0";
        if (styleOptions.text) {
            str = `padding-left: ${designPxToRpx(styleOptions.paddingLeftRight)};`;
            if (!styleOptions.btnType) {
                str = `padding-left: ${designPxToRpx(Number(styleOptions.paddingLeftRight || 0) + 10)};`;
            }
        }
        return str;
    }, [styleOptions.text, styleOptions.btnType, styleOptions.paddingLeftRight]);

    if (!(styleOptions.btnType || styleOptions.text)) {
        return null;
    }

    return (
        <View
            className="goods-btn"
            style={
                `height: ${designPxToRpx(Number(styleOptions.paddingTopBottom || 0) + 24)}; padding-right: ${
                    styleOptions.text ? designPxToRpx(Number(styleOptions.paddingLeftRight || 0) + 10) : 0
                }; border-radius: ${designPxToRpx(styleOptions.radius)}; color: ${styleOptions.textColor}; font-weight: 400;` +
                background +
                paddingLeft
            }
        >
            {styleOptions.btnType ? (
                <View
                    className="btn-icon"
                    style={`margin-left: ${styleOptions.text ? "10rpx" : 0}; margin-right: ${
                        styleOptions.text ? "-4rpx" : 0
                    }; width: ${designPxToRpx(iconBoxWidth)}; background: none;`}
                >
                    {/* color/font-size 必须打在 .iconfont-h5 上：父级 .item-buy .iconfont-h5 与 iconfont.css 会覆盖继承样式 */}
                    {styleOptions.btnType == 1 && <View className="iconfont-h5 icon-gouwuche" style={iconStyle} />}
                    {styleOptions.btnType == 2 && <View className="iconfont-h5 icon-gouwuche1" style={iconStyle} />}
                    {styleOptions.btnType == 3 && <View className="iconfont-h5 icon-jia" style={iconStyle} />}
                    {styleOptions.btnType == 4 && <View className="iconfont-h5 icon-jia1" style={iconStyle} />}
                    {styleOptions.btnType == 5 && iconImageSrc && (
                        <Image
                            className="btn-icon-img"
                            src={imageFormat(iconImageSrc)}
                            mode="aspectFit"
                            style={`width: ${designPxToRpx(iconSizeVal)}; height: ${designPxToRpx(iconSizeVal)};`}
                        />
                    )}
                </View>
            ) : null}
            {styleOptions.text ? (
                <View className="btn-text" style={`font-size: ${designPxToRpx(textSizeVal)};`}>
                    {t(styleOptions.text)}
                </View>
            ) : null}
        </View>
    );
}

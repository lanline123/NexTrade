import Taro from "@tarojs/taro";

import type { ModuleFrameType, ModuleStyle, ModuleSubTitle, ModuleContentStyle } from "@/types/decorate/decorate.d";

// 375 基准设计尺寸转 rpx；缺值保留无效声明，让组件默认样式生效。
export const designPxToRpx = (value: unknown): string => {
    if (typeof value !== "number" && typeof value !== "string") return "";
    if (typeof value === "string" && value.trim() === "") return "";
    const size = Number(value);
    return Number.isFinite(size) ? `${size * 2}rpx` : "";
};

// rpx 转实际 px；显式传当前窗口宽度，避免 H5 换算沿用首次读取的宽度。
export const rpxToDevicePx = (value: number, windowWidth?: number): number => {
    const width = windowWidth ?? Taro.getSystemInfoSync().windowWidth;
    return (value * width) / 750;
};

// 装修配置仍以 375 设计像素为基准，先转 rpx 再换算实际 px。
export const designPxToDevicePx = (value: number, windowWidth?: number): number => rpxToDevicePx(value * 2, windowWidth);

// 格式化模块设置
export const formatFrame = (frame: ModuleFrameType) => {
    return {
        innerPadding: "padding:" + designPxToRpx(frame.innerPadding) + ";",
        boxPadding: "padding-left:" + designPxToRpx(frame.boxPadding) + ";padding-right:" + designPxToRpx(frame.boxPadding) + ";",
        boxPaddingTop: "padding-top:" + designPxToRpx(frame.boxPaddingTop) + ";",
        boxPaddingBottom: "padding-bottom:" + designPxToRpx(frame.boxPaddingBottom) + ";",
        backgroundColor: frame.backgroundColor ? "background-color:" + frame.backgroundColor + ";" : "",
        boxRadius: "border-radius:" + designPxToRpx(frame.boxRadius) + ";",
        textFontSize: "font-size:" + designPxToRpx(frame.titleFontSize) + ";",
        textBlod: "font-weight:" + frame.titleFontWeight + ";"
    };
};

export const gradientMap: { [key: string]: string } = {
    upDown: "to bottom",
    leftRight: "to right",
    diagonal: "to right bottom"
};
type CommonStyle = {
    moduleStyle: any;
    moduleContentStyle: any;
    moduleSubTitle: any;
};
export const formatCommonStyle = (moduleStyle: ModuleStyle, moduleContentStyle?: ModuleContentStyle, moduleSubTitle?: ModuleSubTitle) => {
    const obj: CommonStyle = {
        moduleStyle: {} as ModuleStyle,
        moduleContentStyle: {} as ModuleContentStyle,
        moduleSubTitle: {}
    };
    if (moduleStyle) {
        obj.moduleStyle = {
            boxPaddingTopBottom: `padding-top:${designPxToRpx(moduleStyle.boxPaddingTopBottom)};padding-bottom:${designPxToRpx(moduleStyle.boxPaddingTopBottom)};`,
            boxPadding: "padding-left:" + designPxToRpx(moduleStyle.boxPadding) + ";padding-right:" + designPxToRpx(moduleStyle.boxPadding) + ";",
            boxMargin: "margin-left:" + designPxToRpx(moduleStyle.boxMargin ?? 0) + ";margin-right:" + designPxToRpx(moduleStyle.boxMargin ?? 0) + ";",
            boxPaddingTop: "padding-top:" + designPxToRpx(moduleStyle.boxPaddingTop) + ";",
            boxPaddingBottom: "padding-bottom:" + designPxToRpx(moduleStyle.boxPaddingBottom) + ";",
            backgroundColor: moduleStyle.backgroundColor ? "background-color:" + moduleStyle.backgroundColor + ";" : "",
            backgroundImage: moduleStyle.backgroundPic?.picUrl
                ? "background-image:url(" + moduleStyle.backgroundPic.picUrl + ");"
                : `background-color:${moduleStyle.backgroundColor};`,
            backgroundSize: `background-size: ${moduleStyle.backgroundPicFillType};`
        };
    }
    if (moduleContentStyle) {
        const radiusTop = designPxToRpx(moduleContentStyle.boxRadiusTop);
        const radiusBottom = designPxToRpx(moduleContentStyle.boxRadiusBottom);
        obj.moduleContentStyle = {
            paddingLeftRight:
                "padding-left:" +
                designPxToRpx(moduleContentStyle.paddingLeftRight) +
                ";padding-right:" +
                designPxToRpx(moduleContentStyle.paddingLeftRight) +
                ";",
            paddingTopBottom:
                "padding-top:" +
                designPxToRpx(moduleContentStyle.paddingTopBottom) +
                ";padding-bottom:" +
                designPxToRpx(moduleContentStyle.paddingTopBottom) +
                ";",
            paddingTop: "padding-top:" + designPxToRpx(moduleContentStyle.paddingTop) + ";",
            paddingBottom: "padding-bottom:" + designPxToRpx(moduleContentStyle.paddingBottom) + ";",
            innerPadding: "padding:" + designPxToRpx(moduleContentStyle.padding) + ";",
            backgroundColor: moduleContentStyle.backgroundColor ? "background-color:" + moduleContentStyle.backgroundColor + ";" : "",
            backgroundImage: moduleContentStyle.backgroundPic?.picUrl
                ? "background-image:url(" + moduleContentStyle.backgroundPic.picUrl + ");"
                : `background-image: linear-gradient( ${gradientMap[moduleContentStyle.gradientType]}, ${moduleContentStyle.gradientColorA}, ${
                      moduleContentStyle.gradientColorB
                  });`,
            backgroundSize: `background-size: ${moduleContentStyle.backgroundPicFillType};`,
            boxRadius: radiusTop && radiusBottom ? `border-radius:${radiusTop} ${radiusTop} ${radiusBottom} ${radiusBottom};` : "",
            boxRadius2: `border-radius:${designPxToRpx(moduleContentStyle.boxRadius)};`,
            boxShadow: moduleContentStyle.boxShadow === 1 ? "box-shadow:rgba(0, 0, 0, 0.06) 0 4rpx 8rpx;" : ""
        };
    }

    if (moduleSubTitle) {
        obj.moduleSubTitle = {
            textFontSize: "font-size:" + designPxToRpx(moduleSubTitle.titleFontSize) + ";",
            textBlod: "font-weight:" + moduleSubTitle.titleFontBold + ";",
            textColor: "color:" + moduleSubTitle.titleColor + ";"
        };
    }
    return obj;
};

export const formatAnimation = (type: string, range: number) => {
    const num = range ? 50 * range : 50 * 0.3;
    switch (type) {
        case "close":
            return ``;
        case "scale":
            return `transform: translate(0px, 0px) scale(${range});opacity:0;`;
        case "slideLeft":
            return `transform: translate(-${num}px, 0px) scale(1);opacity:0;`;
        case "slideRight":
            return `transform: translate(${num}px, 0px) scale(1);opacity:0;`;
        case "slideTop":
            return `transform: translate(0px, ${num}px) scale(1);opacity:0;`;
        case "flip":
            return `transform: translate(0px, 0px) scale(1) rotateY(-180deg);opacity:0;`;
        default:
            return "";
    }
};

export const copyArray = (data: any, num = 1) => {
    let result: any = [];
    for (let i = 0; i < num; i++) {
        if (data && typeof data === "object") {
            result = [...result, ...data];
        } else {
            result = [...result, data];
        }
    }
    return result;
};

// 图片橱窗：比例字面量 → padding-top 百分比（兼容微信小程序，不依赖 aspect-ratio）
// 公式：padding-top = (高 / 宽) * 100%
// 与 admin 端 Tigshop-Admin/src/views/decorate/decorate/src/modules/index.ts 保持一致
export const imageShowcasePaddingMap: Record<string, string> = {
    default: "",
    "3:2": "66.667%",
    "1:1": "100%",
    "3:4": "133.333%",
    "2:1": "50%",
    "16:9": "56.25%"
};

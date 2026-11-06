import { useMemo } from "react";
import { Text, View } from "@tarojs/components";

import { designPxToRpx, formatCommonStyle } from "@/components/modules";
import { redirect } from "@/utils";
import { urlFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function TagNav({ module }: Props) {
    const commonStyle = useMemo(() => formatCommonStyle(module.moduleStyle ?? {}), [module]);

    // Fallback 默认值与 admin defaultTagNav 同源
    // (Tigshop-Admin/src/views/decorate/decorate/src/modules/index.ts)。
    // admin 的 mergeDefaultModule 通常会补齐字段，移动端用相同默认值兜底，
    // 保证老数据 / 不完整 payload 与画布渲染一致。
    const groupList = useMemo(() => module.groupList ?? [], [module.groupList]);
    const textWeight = useMemo(() => module.textWeight ?? 700, [module.textWeight]);
    const groupGap = useMemo(() => {
        const v = module.groupGap;
        return v === undefined || v === null ? 10 : Number(v) || 0;
    }, [module.groupGap]);
    const groupPadding = useMemo(() => {
        const v = module.groupPadding;
        return v === undefined || v === null ? 10 : Number(v) || 0;
    }, [module.groupPadding]);
    const categoryColors = useMemo(() => module.categoryColors ?? [], [module.categoryColors]);
    const titleColor = useMemo(() => module.titleColor ?? "#ffffff", [module.titleColor]);
    const titleBgColor = useMemo(() => module.titleBgColor ?? "rgba(255,255,255,0)", [module.titleBgColor]);

    // 标签文字样式：颜色 + 粗细 + 文字背景色（默认透明）
    const textStyle = useMemo(() => {
        let str = `color:${titleColor || "#ffffff"};`;
        str += `font-weight:${textWeight};`;
        if (titleBgColor) {
            str += `background-color:${titleBgColor};`;
        }
        return str;
    }, [titleColor, textWeight, titleBgColor]);

    // 单个标签样式：水滴形造型 + 按 index%len 循环取渐变色 + 间距
    const itemStyle = (idx: number): string => {
        const i = typeof idx === "number" ? idx : Number(idx);
        const colors = categoryColors;
        const c: any = colors.length ? colors[i % colors.length] : {};
        const a = c.colorA || "#cccccc";
        const b = c.colorB || c.colorA || "#cccccc";
        let str = `background-image:linear-gradient(to bottom, ${a}, ${b});`;
        str += "border-radius:50% 0 50% 50%;"; // 右上尖角，其余圆角，水滴形
        // 动态宽高保证正圆水滴：groupPadding 默认 10 时为 52×52
        const size = 32 + groupPadding * 2;
        str += `width:${designPxToRpx(size)};height:${designPxToRpx(size)};`;
        if (i !== groupList.length - 1) {
            str += `margin-right:${designPxToRpx(groupGap)};`;
        }
        return str;
    };

    return (
        <View
            className="module-ad-con module-tag_nav"
            style={
                commonStyle.moduleStyle.boxPaddingTop +
                commonStyle.moduleStyle.boxPaddingBottom +
                commonStyle.moduleStyle.boxPadding +
                commonStyle.moduleStyle.backgroundColor +
                commonStyle.moduleStyle.backgroundImage +
                commonStyle.moduleStyle.backgroundSize
            }
        >
            {groupList.length > 0 && (
                <View className="tag-nav-scroll">
                    {groupList.map((group: any, index: number) => (
                        <View
                            key={index}
                            className="tag-nav-item"
                            style={itemStyle(index)}
                            onClick={() => {
                                urlFormat(group.link) && redirect({ url: urlFormat(group.link) });
                            }}
                        >
                            <Text className="tag-nav-text" style={textStyle}>
                                {t(group.title)}
                            </Text>
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}

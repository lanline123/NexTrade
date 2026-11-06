import { useMemo } from "react";
import { Text, View } from "@tarojs/components";

import { designPxToRpx, formatCommonStyle } from "@/components/modules";
import { urlFormat, imageFormat } from "@/utils/format";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function CategoryRecA1({ module }: Props) {
    const commonStyle = useMemo(
        () => formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {}),
        [module.moduleStyle, module.contentStyle, module.subTitle]
    );

    // 旧版为固定常量（非响应式配置）
    const itemGap = 4;

    return (
        <View
            className="module-ad-con module-category-rec-a1"
            style={
                commonStyle.moduleStyle.boxPaddingTop +
                commonStyle.moduleStyle.boxPaddingBottom +
                commonStyle.moduleStyle.boxPadding +
                commonStyle.moduleStyle.backgroundColor +
                commonStyle.moduleStyle.backgroundImage +
                commonStyle.moduleStyle.backgroundSize
            }
        >
            <View
                className="module-ad-content"
                style={
                    commonStyle.moduleContentStyle.backgroundImage +
                    commonStyle.moduleContentStyle.backgroundSize +
                    commonStyle.moduleContentStyle.boxRadius +
                    commonStyle.moduleContentStyle.boxShadow +
                    commonStyle.moduleContentStyle.innerPadding
                }
            >
                {module.picList && module.picList.length > 0 && (
                    <View className="category-rec-a1-list" style={`padding-left:${designPxToRpx(itemGap)};`}>
                        {(module.picList ?? []).map((pic: any, index: number) => (
                            <View
                                key={index}
                                className="category-rec-a1-item"
                                style={{ flexBasis: "25%", paddingRight: `${designPxToRpx(itemGap)}` }}
                                onClick={() => {
                                    if (urlFormat(pic.picLink)) {
                                        redirect({ url: urlFormat(pic.picLink) });
                                    }
                                }}
                            >
                                <View className="item-inner" style={`border-radius:${designPxToRpx(module.picRadius ?? 0)};`}>
                                    <View className="item-bg" style={`background-image:url(${imageFormat(pic.picUrl)});background-size:${module.picFillType || "cover"};`} />
                                    <View className="item-content">
                                        {module.subTitle?.showTitle && (
                                            <Text
                                                className="item-title"
                                                style={commonStyle.moduleSubTitle.textColor + commonStyle.moduleSubTitle.textFontSize + commonStyle.moduleSubTitle.textBlod}
                                            >
                                                {t(pic.picTitle || "")}
                                            </Text>
                                        )}
                                        <Text className="item-desc" style={`color:${module.subTitleColor || "#999999"};`}>
                                            {t(pic.picDesc || "")}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}

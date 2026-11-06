import { useMemo } from "react";
import { Text, View } from "@tarojs/components";

import { formatFrame } from "@/components/modules";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function TitleAd({ module }: Props) {
    const { frame } = module;

    const frameFormat = useMemo(() => {
        return formatFrame(frame ?? {});
    }, [frame]);

    const allFormat = useMemo(() => {
        return {
            descColor: `color: ${module?.title?.descColor};`,
            moreColor: `color: ${module?.title?.moreColor};`,
            titleColor: `color: ${module?.title?.titleColor};font-weight: ${module?.title?.titleWeight || "normal"};`
        };
    }, [module?.title]);

    return (
        <View
            className={`module-ad-con  module-title_ad  ad-title_align__${module?.title?.titleAlign}`}
            style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom}
        >
            <View className="module-ad-content" style={frameFormat.backgroundColor + " " + frameFormat.boxRadius}>
                <View className="title-ad-warp">
                    <View className="title-ad-con">
                        <View className="title-ad-item">
                            <View className="item-content">
                                <View className={`image-ad-title ad-title_style__${module?.title?.titleStyle}`}>
                                    <View className="image-ad-title-l">
                                        <View className="image-ad-title-h" style={allFormat.titleColor}>
                                            {t(module.title.titleText)}
                                        </View>
                                        <View className="image-ad-title-d" style={allFormat.descColor}>
                                            {t(module.title.descText)}
                                        </View>
                                    </View>
                                    {module.title.showMore == 1 && (
                                        <View className="image-ad-title-r">
                                            {/* 旧版为 navigator :url="module.title.moreLink[0]"，React 端按项目惯例改为点击跳转 */}
                                            <View
                                                className="more-link"
                                                style={allFormat.moreColor}
                                                onClick={() => {
                                                    module.title.moreLink?.[0] && redirect({ url: module.title.moreLink[0] });
                                                }}
                                            >
                                                <View className="flex align-center">
                                                    <Text>{t("查看更多")}</Text>
                                                    <Text className="iconfont-h5 icon-youjiantou" />
                                                </View>
                                            </View>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

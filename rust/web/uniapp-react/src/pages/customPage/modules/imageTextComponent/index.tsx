import { useMemo } from "react";
import { Image, View } from "@tarojs/components";

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

export default function ImageTextComponent({ module }: Props) {
    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    }, [module.moduleStyle, module.contentStyle, module.subTitle]);

    return (
        <View
            className="module-ad-con"
            style={
                commonStyle.moduleStyle.boxPaddingBottom +
                commonStyle.moduleStyle.boxPaddingTop +
                commonStyle.moduleStyle.boxPaddingBottom +
                commonStyle.moduleStyle.boxPadding +
                commonStyle.moduleStyle.backgroundSize +
                commonStyle.moduleStyle.backgroundImage
            }
        >
            <View
                className="module-ad-content"
                style={
                    commonStyle.moduleContentStyle.backgroundImage +
                    commonStyle.moduleContentStyle.backgroundSize +
                    commonStyle.moduleContentStyle.boxRadius2 +
                    commonStyle.moduleContentStyle.boxShadow +
                    commonStyle.moduleContentStyle.innerPadding +
                    commonStyle.moduleContentStyle.backgroundColor
                }
            >
                <View className="imagetext">
                    <View
                        className="image-box"
                        style={`border: ${module.picBorder}px solid ${module.picBorderColor}; border-radius: ${designPxToRpx(module.picRadius)}`}
                        onClick={() => {
                            if (urlFormat(module.picUrl?.picLink)) {
                                redirect({ url: urlFormat(module.picUrl?.picLink) });
                            }
                        }}
                    >
                        <Image mode="widthFix" className="img" src={imageFormat(module.picUrl?.picUrl)} />
                    </View>
                    <View className="intro-box">
                        <View
                            className="title"
                            style={`color: ${module.titColor}; text-align:  ${module.titTextAlignment}; margin-bottom: ${designPxToRpx(module.titMarginBottom)}`}
                        >
                            {t(module.title)}
                        </View>
                        <View className="intro" style={`color: ${module.descColor}; text-align: ${module.descTextAlignment}`}>
                            {t(module.description)}
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

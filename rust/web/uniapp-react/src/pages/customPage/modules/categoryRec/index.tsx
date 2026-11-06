import { useMemo, useRef } from "react";
import { Image, View } from "@tarojs/components";

import { designPxToRpx, formatCommonStyle } from "@/components/modules";
import { urlFormat, imageFormat } from "@/utils/format";
import { redirect } from "@/utils";
import { useAnimation } from "@/hooks/useDecorate";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function CategoryRec({ module }: Props) {
    // React 版用组件根节点 ref 替代 Vue getCurrentInstance()，供 IntersectionObserver 圈定观察范围
    const rootRef = useRef<any>(null);
    const { animationFormat, transitionDuration } = useAnimation(".item-box", module.animation, rootRef);

    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    }, [module.moduleStyle, module.contentStyle, module.subTitle]);

    const itemPadding = useMemo(() => {
        const padding = designPxToRpx(module.categoryPadding);
        return padding ? `padding: ${padding} 30rpx;` : "";
    }, [module.categoryPadding]);

    const borderStyle = useMemo(() => {
        let str = "";
        if (Number(module.catBorder) === 1) {
            str = `border: ${module.catBorderWidth || 1}px solid ${module.catBorderColor || "#ffffff"};`;
        }
        return str;
    }, [module.catBorder, module.catBorderWidth, module.catBorderColor]);

    return (
        <View
            ref={rootRef}
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
                    commonStyle.moduleContentStyle.boxRadius +
                    commonStyle.moduleContentStyle.boxShadow +
                    commonStyle.moduleContentStyle.innerPadding +
                    (module.contentStyle?.paddingTop ? commonStyle.moduleContentStyle.paddingTop : "")
                }
            >
                <View className="categoryrec">
                    <View className="item-box">
                        {(module.categoryList ?? []).map((item: any, index: number) => (
                            <View
                                key={index}
                                className="li"
                                style={animationFormat + transitionDuration(index) + `border-radius: ${designPxToRpx(module.radius)};background-color:${module.backgroundColor}`}
                                onClick={() => {
                                    if (urlFormat(item.link)) {
                                        redirect({ url: urlFormat(item.link) });
                                    }
                                }}
                            >
                                <View
                                    className="item"
                                    style={itemPadding + `border-radius: ${designPxToRpx(module.radius)}; background-color:${item.backgroundColor};` + borderStyle}
                                >
                                    {item.catPic?.picUrl ? <Image className="img" mode="heightFix" src={imageFormat(item.catPic.picUrl)} /> : null}
                                    <View
                                        className="tit"
                                        style={`font-size: ${designPxToRpx(module.subTitle?.titleFontSize)}; font-weight: ${module.subTitle?.titleFontBold}; color: ${
                                            item.titleColor ? item.titleColor : module.subTitle?.titleColor
                                        }`}
                                    >
                                        {t(item.title)}
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
}

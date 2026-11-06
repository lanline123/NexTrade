import { useMemo, useRef } from "react";
import { View } from "@tarojs/components";

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

export default function CategoryNav({ module }: Props) {
    // React 版用组件根节点 ref 替代 Vue getCurrentInstance()，供 IntersectionObserver 圈定观察范围
    const rootRef = useRef<any>(null);
    const { animationFormat, transitionDuration } = useAnimation(".category-nav", module.animation, rootRef);

    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    }, [module.moduleStyle, module.contentStyle, module.subTitle]);

    const itemStyle = useMemo(() => {
        let str = `flex-grow:0;flex-basis:${module.rowNum ? 100 / module.rowNum : 25}%;`;
        if (module.listStyleType === "slide") {
            str += `flex-shrink: 0;`;
        }
        return str;
    }, [module.rowNum, module.listStyleType]);

    const imgStyle = useMemo(() => {
        return `padding-top:${module.picPercent}%;width:${module.picPercent}%;border-radius:${designPxToRpx(module.radius)};background-size:${module.picFillType};`;
    }, [module.picPercent, module.radius, module.picFillType]);

    const handleLink = (data: any, title?: string) => {
        if (!urlFormat(data, title)) return;
        console.log(data, 999);
        if (data.path === "article") {
            redirect({
                url: urlFormat(data, title) + "&notBottom=1"
            });
        } else {
            redirect({
                url: urlFormat(data, title)
            });
        }
    };

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
                    commonStyle.moduleContentStyle.innerPadding
                }
            >
                <View className={`category-nav decorate-slide-box ${module.listStyleType}`}>
                    {(module.categoryList ?? []).map((item: any, index: number) => (
                        <View
                            key={index}
                            className="category-nav-item"
                            style={animationFormat + transitionDuration(index) + itemStyle}
                            onClick={() => handleLink(item.picLink, item.picTitle)}
                        >
                            <View className="item-box" style={`padding:${designPxToRpx(module.categoryPadding)};`}>
                                <View className="category-nav-item-img" style={`background-image:url(${imageFormat(item.picUrl)});` + imgStyle} />
                                {module.subTitle?.showTitle && (
                                    <View
                                        className="category-nav-item-text line1"
                                        style={commonStyle.moduleSubTitle.textBlod + commonStyle.moduleSubTitle.textColor + commonStyle.moduleSubTitle.textFontSize}
                                    >
                                        {t(item.picTitle ?? "")}
                                    </View>
                                )}
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

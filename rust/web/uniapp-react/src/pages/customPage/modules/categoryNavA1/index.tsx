import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToRpx, formatCommonStyle } from "@/components/modules";
import { urlFormat, imageFormat } from "@/utils/format";
import { redirect, getElementRect } from "@/utils";
import { useAnimation } from "@/hooks/useDecorate";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function CategoryNavA1({ module }: Props) {
    // React 版用组件根节点 ref 替代 Vue getCurrentInstance()，供 IntersectionObserver/选择器查询圈定范围
    const rootRef = useRef<any>(null);
    const { animationFormat, transitionDuration } = useAnimation(".category-nav", module.animation, rootRef);

    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    }, [module.moduleStyle, module.contentStyle, module.subTitle]);

    const imgStyle = useMemo(() => {
        return `padding-top:${module.picPercent}%;width:${module.picPercent}%;border-radius:${designPxToRpx(module.radius)};background-size:${module.picFillType};`;
    }, [module.picPercent, module.radius, module.picFillType]);

    // Vue ref 同步读写 → React「state + ref 镜像」：itemWidth/flexWidth 由 boxWidth 驱动渲染
    const [boxWidthState, setBoxWidthState] = useState(0);
    const boxWidthRef = useRef(0);
    const setBoxWidth = (value: number) => {
        boxWidthRef.current = value;
        setBoxWidthState(value);
    };

    const itemWidth = useMemo(() => {
        let num = 0;
        if (module.rowNum === "custom") {
            num = Number((boxWidthState * module.rowPicPercent * 0.01).toFixed(2));
        } else {
            num = Number((boxWidthState / module.rowNum).toFixed(2));
        }
        return num;
    }, [boxWidthState, module.rowNum, module.rowPicPercent]);

    const itemStyle = useMemo(() => {
        let str = `flex-shrink: 0;`;
        if (itemWidth > 0) {
            str += `width:${itemWidth}px;`;
        }
        return str;
    }, [itemWidth]);

    const flexWidth = useMemo(() => {
        let num = 0;
        switch (module.listStyleType) {
            case "slide2":
                num = itemWidth * Math.ceil((module.categoryList?.length ?? 0) / 2);
                return num;
            case "slide":
                num = itemWidth * (module.categoryList?.length ?? 0);
                return num;
            default:
                return `auto`;
        }
    }, [itemWidth, module.listStyleType, module.categoryList]);

    const getBoxWidth = async () => {
        const res = await getElementRect(".category-nav", rootRef.current);
        setBoxWidth(res?.width || 0);
    };

    // 对应旧 onMounted
    useEffect(() => {
        getBoxWidth();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // uni.onWindowResize → Taro.onWindowResize；onUnmounted 清理
    useEffect(() => {
        const windowResizeCallback = () => {
            getBoxWidth();
        };
        Taro.onWindowResize(windowResizeCallback);
        return () => {
            Taro.offWindowResize(windowResizeCallback);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleLink = (data: any, title?: string) => {
        if (!urlFormat(data, title)) return;
        redirect({
            url: urlFormat(data, title)
        });
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
                    commonStyle.moduleContentStyle.innerPadding +
                    commonStyle.moduleContentStyle.paddingBottom +
                    commonStyle.moduleContentStyle.paddingTop +
                    commonStyle.moduleContentStyle.paddingLeftRight
                }
            >
                <View className="category-nav">
                    <ScrollView scrollX className="scroll-box">
                        <View className={` decorate-slide-box ${module.listStyleType}`} style={`width:${flexWidth}px`}>
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
                    </ScrollView>
                </View>
            </View>
        </View>
    );
}

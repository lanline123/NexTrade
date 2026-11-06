import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToRpx, formatCommonStyle, copyArray } from "@/components/modules";
import { urlFormat, imageFormat } from "@/utils/format";
import { redirect, getElementRect } from "@/utils";
import { useImgInfo } from "@/hooks/useDecorate";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function SlideLargeImage({ module }: Props) {
    // React 版用组件根节点 ref 替代 Vue getCurrentInstance()/template ref，供选择器查询圈定范围
    const rootRef = useRef<any>(null);

    const list = useMemo(() => {
        if (module.picList) {
            return copyArray(module.picList, 5);
        }
        return [];
    }, [module.picList]);

    // 旧 useImgInfo 只传 imgUrl（selector 未传），immediate 挂载时 updateImgInfo；这里同样只取 imgratio
    const { imgratio, getImgratio } = useImgInfo();

    const commonStyle = useMemo(() => {
        return formatCommonStyle(
            module.moduleStyle ?? {
                boxMarginTop: 5,
                boxMarginBottom: 0,
                boxMargin: 10,
                backgroundColor: "",
                backgroundPic: {
                    picUrl: "",
                    picThumb: ""
                },
                backgroundPicFillType: "cover"
            },
            module.contentStyle ?? {
                paddingTop: 0,
                paddingBottom: 0,
                paddingLeftRight: 0,
                padding: 0,
                boxRadiusTop: 0,
                boxRadiusBottom: 0,
                gradientType: "upDown",
                gradientColorA: "#ffffff",
                gradientColorB: "#ffffff",
                backgroundPic: {
                    picUrl: "",
                    picThumb: ""
                },
                backgroundPicFillType: "cover",
                boxShadow: 0
            },
            module.subTitle ?? {}
        );
    }, [module.moduleStyle, module.contentStyle, module.subTitle]);

    const [boxWidth, setBoxWidth] = useState(0);
    const itemWidth = useMemo(() => {
        return boxWidth / module.rowNum;
    }, [boxWidth, module.rowNum]);
    // touchmove 闭包内读最新值（对应旧 itemWidth.value 的同步读取）
    const itemWidthRef = useRef(0);
    itemWidthRef.current = itemWidth;

    const slidelargeBoxStyle = useMemo(() => {
        return `width: ${itemWidth * module.picList?.length}px; display: flex; animation-duration: ${module.slidingSpeed}s; position: relative; top: 0px; left: 0px;`;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [itemWidth, module.picList, module.slidingSpeed]);

    // Vue reactive touchInfo 中 touch/translateX 驱动渲染，用 state；startX/endX 仅回调内读写，用 ref
    const [touching, setTouching] = useState(false);
    const [translateX, setTranslateX] = useState(0);
    const touchInfo = useRef({
        startX: 0,
        endX: 0
    });

    const slidelargeAnimationStyle = useMemo(() => {
        return `transform: translateX(${translateX}px);animation-play-state:  ${module.slidingEffect === "manual" || touching ? "paused" : "running"};`;
    }, [translateX, touching, module.slidingEffect]);

    const itemStyle = useMemo(() => {
        return `margin-right: ${designPxToRpx(module.picMargin)}; background: none; border-radius: ${designPxToRpx(module.picRadius)}; position: relative; overflow: hidden;`;
    }, [module.picMargin, module.picRadius]);

    const imgStyle = useMemo(() => {
        return `width: 100%;height: 0px;padding-top: ${imgratio * 100}%;border-bottom-left-radius: 0px;border-bottom-right-radius: 0px;background-size: cover;background-repeat: no-repeat;background-position: center center;`;
    }, [imgratio]);

    const designMargin = (top: unknown, horizontal: unknown, bottom: unknown) => {
        const values = [top, horizontal, bottom].map(designPxToRpx);
        return values.every(Boolean) ? `margin: ${values.join(" ")};` : "";
    };

    const textStyle = useMemo(() => {
        return {
            picTextBox: `background: ${module.picTitleDesc?.backgroundColor ? module.picTitleDesc.backgroundColor : "none"};text-align: ${module.picTitleDesc?.textAlignment};`,
            picTextMargin: designMargin(module.picTitleDesc?.marginTop, module.picTitleDesc?.marginLeft, module.picTitleDesc?.marginBottom),
            picTextTitle: `color: ${module.picTitleDesc?.titleColor}; font-size: ${designPxToRpx(module.picTitleDesc?.titleFontSize)}; font-weight: ${
                module.picTitleDesc?.titleFontWeight
            }; overflow: hidden`,
            picTextDesc: `margin-top: 12rpx; font-size: ${designPxToRpx(module.picTitleDesc?.descFontSize)};font-weight: ${
                module.picTitleDesc?.descFontWeight
            };color: ${module.picTitleDesc?.descColor};overflow: hidden;`
        };
    }, [module.picTitleDesc]);

    const titleStyle = useMemo(() => {
        return {
            titleBox: `text-align: ${module.moduleTitle?.textAlignment};${designMargin(
                module.moduleTitle?.titleMarginTop,
                module.moduleTitle?.titleMarginLeft,
                module.moduleTitle?.titleMarginBottom
            )}`,
            title: `font-size: ${designPxToRpx(module.moduleTitle?.titleFontSize)}; font-weight: ${module.moduleTitle?.titleFontWeight};color: ${
                module.moduleTitle?.titleColor
            };`,
            subTitle: `font-size: ${designPxToRpx(module.moduleTitle?.subFontTitleSize)}; margin-top: 16rpx; font-weight: ${
                module.moduleTitle?.subFontTitleWeight
            };color: ${module.moduleTitle?.subFontTitleColor};`
        };
    }, [module.moduleTitle]);

    const getBoxWidth = async () => {
        const res = await getElementRect(".slidelarge-image", rootRef.current);
        setBoxWidth(res?.width ?? 0);
    };

    // 对应旧 onMounted
    useEffect(() => {
        getBoxWidth();
        // 旧 useImgInfo immediate：挂载时 updateImgInfo（getImgratio + getHeght，此处未传 selector）
        getImgratio(imageFormat(module.picList[0].picUrl));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // uni.onWindowResize → Taro.onWindowResize；onUnmounted 清理
    useEffect(() => {
        const windowResizeCallback = () => {
            getImgratio(imageFormat(module.picList[0].picUrl));
            getBoxWidth();
        };
        Taro.onWindowResize(windowResizeCallback);
        return () => {
            Taro.offWindowResize(windowResizeCallback);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const touchstart = (e: any) => {
        setTouching(true);
        touchInfo.current.startX = e.touches[0].clientX;
    };

    const touchmove = (e: any) => {
        const moveNum = Number((e.touches[0].clientX - touchInfo.current.startX).toFixed(2));
        if (Math.abs(moveNum) > itemWidthRef.current * module.picList?.length) {
            setTranslateX(moveNum % (itemWidthRef.current * module.picList?.length));
        } else {
            setTranslateX(moveNum);
        }
    };

    const touchend = () => {
        setTouching(false);
    };

    const handleLink = (data: any) => {
        if (!urlFormat(data)) return;
        redirect({
            url: urlFormat(data)
        });
    };
    void handleLink;

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
                <View className="slidelarge-image">
                    {module.moduleTitle && module.moduleTitle.titlePosition === "top" && (
                        // 注意：与旧模板一致，此处 titleText/subTitleText 未经过 $t，仅 bottom 区做了翻译
                        <View style={titleStyle.titleBox}>
                            <View style={titleStyle.title}>{module.moduleTitle?.titleText}</View>
                            <View style={titleStyle.subTitle}>{module.moduleTitle?.subTitleText}</View>
                        </View>
                    )}
                    <View
                        style={`margin-top: ${module.picMarginTop}%; width: 100%; z-index: 1; overflow: hidden;`}
                        onTouchStart={touchstart}
                        onTouchEnd={touchend}
                        onTouchMove={touchmove}
                    >
                        <View style={slidelargeBoxStyle}>
                            <View
                                className={module.slidingEffect === "auto" ? "slidelarge-image-box" : ""}
                                style={slidelargeBoxStyle + slidelargeAnimationStyle}
                            >
                                {list.map((item: any, index: number) => (
                                    <View
                                        key={index}
                                        style={`width: ${itemWidth}px; flex-shrink: 0`}
                                        onClick={() => {
                                            urlFormat(item.picLink) && redirect({ url: urlFormat(item.picLink) });
                                        }}
                                    >
                                        <View style={itemStyle}>
                                            <View style={imgStyle + `background-image: url(${imageFormat(item.picUrl)});`} />
                                            {module.picTitleDesc?.show == 1 && (
                                                <View
                                                    style={
                                                        textStyle.picTextBox +
                                                        `${
                                                            module.picTitleDesc.fontPosition === "internal"
                                                                ? "position: absolute;left: 0;right: 0;bottom: 0;padding: 20rpx 30rpx;"
                                                                : ""
                                                        }` +
                                                        `${module.picTitleDesc.fontPosition !== "internal" ? textStyle.picTextMargin : ""}`
                                                    }
                                                >
                                                    <View style={textStyle.picTextTitle}>{t(item.picTitle ?? "")}</View>
                                                    <View style={textStyle.picTextDesc}>{t(item.picDesc ?? "")}</View>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                    {module.moduleTitle && module.moduleTitle.titlePosition === "bottom" && (
                        <View style={titleStyle.titleBox}>
                            <View style={titleStyle.title}>{t(module.moduleTitle?.titleText)}</View>
                            <View style={titleStyle.subTitle}>{t(module.moduleTitle?.subTitleText)}</View>
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

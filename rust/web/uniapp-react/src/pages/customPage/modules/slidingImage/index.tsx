import { useEffect, useMemo, useRef, useState } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { designPxToRpx, formatCommonStyle, gradientMap, copyArray } from "@/components/modules";
import { urlFormat, imageFormat } from "@/utils/format";
import { redirect, getElementRect } from "@/utils";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function SlidingImage({ module }: Props) {
    // React 版用组件根节点 ref 替代 Vue getCurrentInstance()，供选择器查询圈定范围
    const rootRef = useRef<any>(null);

    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle, {} as any, module.subTitle);
    }, [module.moduleStyle, module.subTitle]);

    const list = useMemo(() => {
        if (module.picList) {
            return copyArray(module.picList, 3);
        }
        return [];
    }, [module.picList]);

    const itemStyle = useMemo(() => {
        return `margin-right: ${designPxToRpx(module.picMargin)};padding: ${designPxToRpx(module.picPadding)};border-radius: ${designPxToRpx(module.picRadius)};`;
    }, [module.picMargin, module.picPadding, module.picRadius]);

    const imgStyle = useMemo(() => {
        return `padding-top: 87.5%;border-radius: ${designPxToRpx(module.picRadius)};background-size: ${module.picFillType};`;
    }, [module.picRadius, module.picFillType]);

    const isEvenOrOdd = (num: number) => {
        if (Math.abs(num) % 2 === 0) {
            return true;
        }
    };

    // Vue reactive/ref 均为同步读写；这里 translateX/duration/number/boxWidth 既要驱动渲染，
    // 又会被 setInterval 闭包与 touch 回调读写，统一「state + ref 镜像」双写
    const [translateXState, setTranslateXState] = useState(0);
    const translateXRef = useRef(0);
    const setTranslateX = (value: number) => {
        translateXRef.current = value;
        setTranslateXState(value);
    };

    const [durationState, setDurationState] = useState("500ms");
    const durationRef = useRef("500ms");
    const setDuration = (value: string) => {
        durationRef.current = value;
        setDurationState(value);
    };

    const [boxWidthState, setBoxWidthState] = useState(0);
    const boxWidthRef = useRef(0);

    const [numberState, setNumberState] = useState(0);
    const numberRef = useRef(0);
    const setNumber = (value: number) => {
        numberRef.current = value;
        setNumberState(value);
    };

    const itemWidth = useMemo(() => {
        return boxWidthState * module.picWidth * 0.01;
    }, [boxWidthState, module.picWidth]);
    // 闭包内读最新值（对应旧 itemWidth.value 的同步读取）
    const itemWidthRef = useRef(0);
    itemWidthRef.current = itemWidth;

    const timerRef = useRef<any>(null);

    const next = () => {
        const nextNumber = numberRef.current + 1;
        setNumber(nextNumber);
        if (nextNumber === module.picList.length) {
            setTranslateX(translateXRef.current + itemWidthRef.current);
            setTimeout(() => {
                setDuration("0ms");
                setNumber(0);
                setTranslateX(boxWidthRef.current);
            }, 450);
        } else {
            if (durationRef.current === "0ms") {
                setDuration("500ms");
            }
            setTranslateX(translateXRef.current + itemWidthRef.current);
        }
    };

    const prev = () => {
        const nextNumber = numberRef.current - 1;
        setNumber(nextNumber);
        if (Math.abs(nextNumber) === module.picList.length) {
            setTranslateX(translateXRef.current - itemWidthRef.current);
            setTimeout(() => {
                setDuration("0ms");
                setNumber(0);
                setTranslateX(boxWidthRef.current);
            }, 450);
        } else {
            if (durationRef.current === "0ms") {
                setDuration("500ms");
            }
            setTranslateX(translateXRef.current - itemWidthRef.current);
        }
    };

    // Vue reactive touchInfo → useRef 对象（同一次触摸序列内同步读写，无需触发渲染）
    const touchInfo = useRef({
        startX: 0, // 触摸起始位置的X坐标
        moveX: 0, // 移动时的X坐标
        endX: 0, // 触摸结束位置的X坐标
        disX: 0 // 水平方向的距离
    });

    const touchstart = (e: any) => {
        touchInfo.current.startX = e.touches[0].pageX;
        stopSliding();
    };
    const touchend = (e: any) => {
        // 记录触摸结束的位置
        touchInfo.current.endX = e.changedTouches[0].pageX;
        // 计算水平位移距离
        touchInfo.current.disX = touchInfo.current.startX - touchInfo.current.endX;
        // 判断左右滑动
        if (Math.abs(touchInfo.current.disX) > 20) {
            // 设置滑动阈值
            if (touchInfo.current.disX > 0) {
                next();
            } else {
                prev();
            }
        } else {
            // 如果位移距离小于阈值，则不认为是滑动
        }
        // 重置起始位置
        touchInfo.current.startX = 0;
        touchInfo.current.endX = 0;
        touchInfo.current.disX = 0;
        startSliding();
    };

    const startSliding = () => {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            next();
        }, module.interval * 1000);
    };
    const stopSliding = () => {
        if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
        }
    };

    const [loading, setLoading] = useState(true);
    const getInfo = async () => {
        const res = await getElementRect(".slidingImage", rootRef.current);
        if (res) {
            boxWidthRef.current = res.width;
            setBoxWidthState(res.width);
            setTranslateX(res.width);
            setLoading(false);
            if (module.autoPlay == 1) {
                startSliding();
            }
        }
    };

    // 对应旧 onMounted
    useEffect(() => {
        getInfo();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // uni.onWindowResize → Taro.onWindowResize；onUnmounted 清理（含停止自动轮播定时器）
    useEffect(() => {
        const windowResizeCallback = () => {
            getInfo();
        };
        Taro.onWindowResize(windowResizeCallback);
        return () => {
            Taro.offWindowResize(windowResizeCallback);
            stopSliding();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
                <View className="slidingImage">
                    {!loading && (
                        <View
                            className="slidingImage-box"
                            style={`transition-duration: ${durationState}; transform: translateX(-${translateXState}px)`}
                            onClick={() => next()}
                            onTouchStart={touchstart}
                            onTouchEnd={touchend}
                        >
                            {list.map((item: any, index: number) => (
                                <View
                                    className="item-box"
                                    key={index}
                                    style={`width: ${itemWidth}px`}
                                    onClick={() => {
                                        urlFormat(item.picLink) && redirect({ url: urlFormat(item.picLink) });
                                    }}
                                >
                                    <View
                                        className="item"
                                        style={
                                            itemStyle +
                                            `${
                                                module.backgroundGradientType === "purity"
                                                    ? `background-color:${item?.gradientColorA};`
                                                    : `background-image:linear-gradient(${gradientMap[module.backgroundGradientType]},${item?.gradientColorA},${
                                                          item?.gradientColorA
                                                      });`
                                            }transform: scale(${isEvenOrOdd(index) === isEvenOrOdd(numberState) ? 1 : module.picReducePercent});`
                                        }
                                    >
                                        <View className="fox-title">
                                            <View className="img" style={imgStyle + `background-image:url(${imageFormat(item.picUrl)})`} />
                                            {module.showDesc == 1 && (
                                                <View
                                                    className="desc line1"
                                                    style={
                                                        `color: ${module.descColor};` +
                                                        `${
                                                            module.backgroundGradientType === "purity"
                                                                ? `background-color:${item?.gradientColorA};`
                                                                : `background-image:linear-gradient(${gradientMap[module.backgroundGradientType]},${
                                                                      item?.gradientColorA
                                                                  },${item?.gradientColorA});`
                                                        }`
                                                    }
                                                >
                                                    {t(item.picDesc)}
                                                </View>
                                            )}
                                        </View>
                                        {module.subTitle?.showTitle && (
                                            <View
                                                className="title line2"
                                                style={commonStyle.moduleSubTitle.textFontSize + commonStyle.moduleSubTitle.textBlod + commonStyle.moduleSubTitle.textColor}
                                            >
                                                {t(item.picTitle ?? "")}
                                            </View>
                                        )}
                                    </View>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

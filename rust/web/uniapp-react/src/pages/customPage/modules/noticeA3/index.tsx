import { useMemo } from "react";
import { Image, Swiper, SwiperItem, Text, View } from "@tarojs/components";

import { designPxToRpx, formatCommonStyle } from "@/components/modules";
import { redirect } from "@/utils";
import { imageFormat, urlFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function NoticeA3({ module }: Props) {
    const commonStyle = useMemo(() => formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}), [module]);

    const noticeList = useMemo(() => module.noticeList || [], [module.noticeList]);

    const onClickItem = (item: any) => {
        const url = urlFormat(item.link);
        if (url) redirect({ url });
    };

    const wrapStyle = useMemo(() => {
        if (Number(module.showBorder) === 1 && module.borderColor) {
            return `border: 1px solid ${module.borderColor};`;
        }
        return "";
    }, [module.showBorder, module.borderColor]);

    const bodyStyle = useMemo(() => {
        if (module.contentBgColor) {
            return `background-color: ${module.contentBgColor};`;
        }
        return "";
    }, [module.contentBgColor]);

    const headerImgStyle = useMemo(() => {
        return `width: ${designPxToRpx(module.headerImageWidth || 48)}; height: auto;`;
    }, [module.headerImageWidth]);

    const textStyle = useMemo(() => {
        return `color: ${module.textColor || "#666666"};`;
    }, [module.textColor]);

    return (
        <View
            className="module-ad-con module-notice-a3"
            style={
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
                    commonStyle.moduleContentStyle.backgroundColor +
                    commonStyle.moduleContentStyle.backgroundImage +
                    commonStyle.moduleContentStyle.backgroundSize +
                    commonStyle.moduleContentStyle.boxRadius2 +
                    commonStyle.moduleContentStyle.boxShadow +
                    commonStyle.moduleContentStyle.paddingTopBottom +
                    commonStyle.moduleContentStyle.paddingLeftRight +
                    wrapStyle
                }
            >
                {noticeList.length > 0 && (
                    <View className="notice-a3-wrap">
                        {Number(module.showHeader) === 1 && module.headerImage?.picUrl && (
                            <View className="notice-a3-header">
                                <Image src={imageFormat(module.headerImage.picUrl)} mode="widthFix" style={headerImgStyle} />
                                <View className="notice-a3-divider" />
                            </View>
                        )}
                        <View className="notice-a3-body" style={bodyStyle}>
                            {noticeList.length === 1 ? (
                                <View className="notice-a3-item" onClick={() => onClickItem(noticeList[0])}>
                                    {Number(module.showPrefix) === 1 && noticeList[0].prefix && (
                                        <Text className="notice-a3-prefix">{t(noticeList[0].prefix)}</Text>
                                    )}
                                    <Text className="notice-a3-text" style={textStyle}>
                                        {t(noticeList[0].title)}
                                    </Text>
                                </View>
                            ) : (
                                <Swiper className="notice-a3-swiper" vertical circular autoplay interval={3000} duration={500} indicatorDots={false}>
                                    {noticeList.map((item, index) => (
                                        <SwiperItem key={index}>
                                            <View className="notice-a3-item" onClick={() => onClickItem(item)}>
                                                {Number(module.showPrefix) === 1 && item.prefix && (
                                                    <Text className="notice-a3-prefix">{t(item.prefix)}</Text>
                                                )}
                                                <Text className="notice-a3-text" style={textStyle}>
                                                    {t(item.title)}
                                                </Text>
                                            </View>
                                        </SwiperItem>
                                    ))}
                                </Swiper>
                            )}
                        </View>
                    </View>
                )}
            </View>
        </View>
    );
}

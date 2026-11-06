import { useMemo } from "react";
import { Image, Swiper, SwiperItem, View } from "@tarojs/components";

import { formatCommonStyle } from "@/components/modules";
import { redirect } from "@/utils";
import { imageFormat, urlFormat } from "@/utils/format";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function MixedNotice({ module }: Props) {
    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    }, [module]);

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
                    commonStyle.moduleContentStyle.boxRadius +
                    commonStyle.moduleContentStyle.boxShadow +
                    commonStyle.moduleContentStyle.innerPadding
                }
            >
                <View className="mixed-notice">
                    <View className="notices">
                        {module.noticeGroups.map((item: any, index: number) => (
                            <View className="notices-item-box" key={index}>
                                {item.notices.length === 1 ? (
                                    item.notices.map((subItem: any, subIndex: number) => (
                                        <View
                                            className="notices-item"
                                            key={subIndex}
                                            onClick={() => {
                                                subItem.picLink && redirect({ url: urlFormat(subItem.picLink) });
                                            }}
                                        >
                                            <View className="notices-item-img">
                                                <Image src={imageFormat(subItem.picUrl)} />
                                            </View>
                                            <View className="notices-item-content">
                                                <View className="content-title">{subItem.picTitle}</View>
                                                <View className="content-subtitle">{subItem.picDesc}</View>
                                            </View>
                                        </View>
                                    ))
                                ) : (
                                    // 旧 tig-swiper（dot=false 分支）等价展开：
                                    // height="80rpx"、circular、无指示点、autoplay 默认 true、interval 默认 3000、vertical、duration=800
                                    <Swiper
                                        style={{ height: "80rpx" }}
                                        circular
                                        indicatorDots={false}
                                        autoplay
                                        interval={3000}
                                        vertical
                                        duration={800}
                                    >
                                        {item.notices.map((notice: any, noticeIndex: number) => (
                                            <SwiperItem key={noticeIndex}>
                                                <View
                                                    className="notices-item"
                                                    onClick={() => {
                                                        notice.picLink && redirect({ url: urlFormat(notice.picLink) });
                                                    }}
                                                >
                                                    <View className="notices-item-img">
                                                        <Image src={imageFormat(notice.picUrl)} />
                                                    </View>
                                                    <View className="notices-item-content">
                                                        <View className="content-title">{notice.picTitle}</View>
                                                        <View className="content-subtitle">{notice.picDesc}</View>
                                                    </View>
                                                </View>
                                            </SwiperItem>
                                        ))}
                                    </Swiper>
                                )}
                            </View>
                        ))}
                    </View>
                </View>
            </View>
        </View>
    );
}

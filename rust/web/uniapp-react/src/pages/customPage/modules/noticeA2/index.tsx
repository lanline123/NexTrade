import { useMemo, useState } from "react";
import { Image, Text, View } from "@tarojs/components";

import { copyArray, designPxToRpx, formatCommonStyle } from "@/components/modules";
import { redirect } from "@/utils";
import { imageFormat, urlFormat } from "@/utils/format";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function NoticeA2({ module }: Props) {
    const [show, setShow] = useState(true);

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
    }, [module]);

    const list = useMemo(() => {
        if (module.noticeContent) {
            return copyArray(module.noticeContent, 3);
        }
        return [];
    }, [module.noticeContent]);

    const width = useMemo(() => {
        let str = "width:auto";
        if (module.noticeContent && module.nociceEffect === "scroll") {
            const { digits, chineseChars, englishLetters, englishSymbols, chineseSymbols } = countCharacters(module.noticeContent);
            str = `width: ${designPxToRpx(digits * 8 + chineseChars * 14 + englishLetters * 8 + englishSymbols * 4 + chineseSymbols * 14 + 20)};`;
            return str;
        }
        return str;
    }, [module.noticeContent, module.nociceEffect]);

    const onClickNotice = () => {
        const url = urlFormat(module.nociceLink);
        if (url) redirect({ url });
    };

    function countCharacters(str: string) {
        const result = {
            digits: 0,
            chineseChars: 0,
            englishLetters: 0,
            englishSymbols: 0,
            chineseSymbols: 0
        };

        for (let i = 0; i < str.length; i++) {
            const char = str[i];

            // 检测数字
            if (/\d/.test(char)) {
                result.digits++;
            }
            // 检测汉字
            else if (/[\u4e00-\u9fa5]/.test(char)) {
                result.chineseChars++;
            }
            // 检测英文字母
            else if (/[a-zA-Z]/.test(char)) {
                result.englishLetters++;
            }
            // 检测英文符号
            else if (/[!"#$%&'()*+,-./:;<=>?@[\\\]^_`{|}~]/.test(char)) {
                result.englishSymbols++;
            }
            // 检测中文符号
            else if (/[\u3000-\u303f\u309b-\u309f\u30fb\uff00-\uffef]/.test(char)) {
                result.chineseSymbols++;
            }
        }

        return result;
    }

    if (!(show && list.length)) {
        return null;
    }

    return (
        <View
            className="module-ad-con"
            style={commonStyle.moduleStyle.boxPaddingTopBottom + commonStyle.moduleStyle.boxPadding + commonStyle.moduleStyle.backgroundColor}
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
                    commonStyle.moduleContentStyle.paddingLeftRight
                }
            >
                <View className="main">
                    <View className="headlines" style="width: calc(100% + 0px)">
                        {module.noticeIconType !== "hide" && (
                            <View className="headlines-icon">
                                <Image
                                    className={`headlines-iconImg ${module.noticeIconType === "default" ? "default-icon" : ""}`}
                                    src={imageFormat(module.iconPic?.picUrl)}
                                    mode={(module.noticeIconType === "default" ? "" : "heightFix") as any}
                                />
                            </View>
                        )}

                        <View className="headlines-container" onClick={onClickNotice}>
                            {module.nociceEffect === "scroll" && (
                                <View style={width}>
                                    <View
                                        className="headlines-text"
                                        style={`justify-content:left; color:${module.contentColor}; animation-duration: ${module.scrollSpeed}s;`}
                                    >
                                        {list.map((item, index) => (
                                            <View className="headlines-item" key={index}>
                                                {t(item)}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            )}
                            {module.nociceEffect === "still" && (
                                <View style={width}>
                                    <View className="" style={`justify-content:${module.textAlignment}; color:${module.contentColor};`}>
                                        <View className="headlines-item">{t(module.noticeContent)}</View>
                                    </View>
                                </View>
                            )}
                        </View>
                        {Number(module.closeIcon) === 1 && (
                            <View className="cross" onClick={() => setShow(false)}>
                                <Text className="iconfont-h5 icon-chacha" style={`color:${module.contentColor};`} />
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </View>
    );
}

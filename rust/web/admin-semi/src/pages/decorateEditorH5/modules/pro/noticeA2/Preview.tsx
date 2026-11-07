/**
 * 商城公告2 预览（移植自 view/admin editor/modules/mobilePro/noticeA2/Preview.vue）
 *
 * scroll 模式：内容按字符宽度估算宽度后横向 marquee 滚动（copyArray 重复 3 份）。
 */
import { useMemo } from "react";
import { cssText, imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatCommonStyle } from "../../../contract/sharedDefaults";
import { noticeA2Defaults } from "./index";
import "./Preview.css";

/** 与旧 Preview.vue countCharacters 相同的字宽估算：宽度 = 数字8 + 汉字14 + 字母8 + 英符号4 + 中符号14 + 20 */
const estimateWidth = (text: string): number => {
    let digits = 0;
    let chineseChars = 0;
    let englishLetters = 0;
    let englishSymbols = 0;
    let chineseSymbols = 0;
    for (const char of text) {
        if (/\d/.test(char)) digits++;
        else if (/[\u4e00-\u9fa5]/.test(char)) chineseChars++;
        else if (/[a-zA-Z]/.test(char)) englishLetters++;
        else if (/[\u4e00-\u9fa5\u3000-\u303f\uff00-\uffef]/.test(char)) chineseSymbols++;
        else englishSymbols++;
    }
    return digits * 8 + chineseChars * 14 + englishLetters * 8 + englishSymbols * 4 + chineseSymbols * 14 + 20;
};

export default function NoticeA2Preview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, noticeA2Defaults);
        return merged;
    }, [data]);

    const commonStyle = formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    const isScroll = module.nociceEffect === "scroll";
    const list = module.noticeContent && isScroll ? [module.noticeContent, module.noticeContent, module.noticeContent] : [];
    const widthStyle = isScroll && module.noticeContent ? { width: `${estimateWidth(module.noticeContent)}px` } : { width: "auto" };

    return (
        <div
            className="module-ad-con"
            style={cssText(commonStyle.moduleStyle.boxPaddingTopBottom, commonStyle.moduleStyle.boxPadding, commonStyle.moduleStyle.backgroundColor)}
        >
            <div
                className="module-ad-content"
                style={cssText(commonStyle.moduleContentStyle.backgroundColor, commonStyle.moduleContentStyle.backgroundImage, commonStyle.moduleContentStyle.backgroundSize, commonStyle.moduleContentStyle.boxRadius2, commonStyle.moduleContentStyle.boxShadow, commonStyle.moduleContentStyle.paddingTopBottom, commonStyle.moduleContentStyle.paddingLeftRight)}
            >
                <div className="main">
                    <div className="headlines" style={{ width: "calc(100% + 0px)" }}>
                        {module.noticeIconType !== "hide" && (
                            <div className="headlines-icon">
                                <img
                                    className="headlines-iconImg"
                                    style={module.noticeIconType === "default" ? { padding: 5 } : undefined}
                                    src={imageFormat(module.iconPic?.picUrl)}
                                    alt=""
                                />
                            </div>
                        )}
                        <div className="headlines-container">
                            {isScroll ? (
                                <div style={widthStyle}>
                                    <div
                                        className="headlines-text is-scroll"
                                        style={{ justifyContent: "left", color: module.contentColor, animationDuration: `${module.scrollSpeed}s` }}
                                    >
                                        {list.map((item, index) => (
                                            <div className="headlines-item" key={index}>
                                                {item}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <div style={widthStyle}>
                                    <div style={{ justifyContent: module.textAlignment, color: module.contentColor, display: "flex" }}>
                                        <div className="headlines-item">{module.noticeContent}</div>
                                    </div>
                                </div>
                            )}
                        </div>
                        {Boolean(module.closeIcon) && (
                            <div className="cross">
                                <span style={{ color: module.contentColor }}>✕</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

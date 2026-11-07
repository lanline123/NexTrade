/**
 * 商城公告3 预览（移植自 view/admin editor/modules/mobilePro/noticeA3/Preview.vue）
 *
 * 头图 + 竖直轮播公告（3s 自动切换），支持前缀标签/边框/内容底色。
 */
import { useEffect, useMemo, useState } from "react";
import { imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatCommonStyle } from "../../../contract/sharedDefaults";
import { noticeA3Defaults } from "./index";
import "./Preview.css";

export default function NoticeA3Preview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, noticeA3Defaults);
        return merged;
    }, [data]);

    const commonStyle = formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {});
    const noticeList: Array<{ title?: string; prefix?: string }> = module.noticeList || [];
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        setCurrentIndex(0);
        if (noticeList.length <= 1) return;
        const timer = window.setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % noticeList.length);
        }, 3000);
        return () => window.clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [noticeList.length]);

    const currentItem = noticeList[currentIndex] || noticeList[0];
    const wrapStyle: React.CSSProperties =
        Number(module.showBorder) === 1 && module.borderColor ? { border: `1px solid ${module.borderColor}` } : {};
    const bodyStyle: React.CSSProperties = module.contentBgColor ? { backgroundColor: module.contentBgColor } : {};

    return (
        <div
            className="module-ad-con module-notice-a3"
            style={{
                ...commonStyle.moduleStyle.boxPaddingTop,
                ...commonStyle.moduleStyle.boxPaddingBottom,
                ...commonStyle.moduleStyle.boxPadding,
                ...commonStyle.moduleStyle.backgroundSize,
                ...commonStyle.moduleStyle.backgroundImage,
            }}
        >
            <div
                className="module-ad-content"
                style={{
                    ...commonStyle.moduleContentStyle.backgroundColor,
                    ...commonStyle.moduleContentStyle.backgroundImage,
                    ...commonStyle.moduleContentStyle.backgroundSize,
                    ...commonStyle.moduleContentStyle.boxRadius2,
                    ...commonStyle.moduleContentStyle.boxShadow,
                    ...commonStyle.moduleContentStyle.paddingTopBottom,
                    ...commonStyle.moduleContentStyle.paddingLeftRight,
                    ...wrapStyle,
                }}
            >
                {noticeList.length === 0 ? (
                    <div className="notice-a3-empty">
                        <div className="desc">点击添加公告内容</div>
                    </div>
                ) : (
                    <div className="notice-a3-wrap">
                        {Number(module.showHeader) === 1 && module.headerImage?.picUrl && (
                            <div className="notice-a3-header">
                                <img src={imageFormat(module.headerImage.picUrl)} alt="" style={{ width: `${module.headerImageWidth}px`, height: "auto" }} />
                                <div className="notice-a3-divider" />
                            </div>
                        )}
                        <div className="notice-a3-body" style={bodyStyle}>
                            <div className="notice-a3-scroll">
                                <div className="notice-a3-item" key={currentIndex}>
                                    {Number(module.showPrefix) === 1 && currentItem?.prefix && (
                                        <span className="notice-a3-prefix">{currentItem.prefix}</span>
                                    )}
                                    <span className="notice-a3-text" style={{ color: module.textColor || "#666666" }}>
                                        {currentItem?.title}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

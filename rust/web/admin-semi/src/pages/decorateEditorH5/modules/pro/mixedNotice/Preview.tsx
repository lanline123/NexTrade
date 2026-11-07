/**
 * 公告混排 预览（移植自 view/admin editor/modules/mobilePro/mixedNotice/Preview.vue）
 *
 * 每组一条公告时静态展示，多条时横向 Swiper 轮播（图 + 标题 + 卖点副标题）。
 */
import { useMemo, useState } from "react";
import { Swiper, SwiperItem } from "@nutui/nutui-react";
import { cssText, imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatCommonStyle } from "../../../contract/sharedDefaults";
import { mixedNoticeDefaults } from "./index";
import "./Preview.css";

interface NoticeItem {
    picUrl?: string;
    picTitle?: string;
    picDesc?: string;
}

export default function MixedNoticePreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, mixedNoticeDefaults);
        return merged;
    }, [data]);

    const commonStyle = formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {});
    const groups: Array<{ notices?: NoticeItem[] }> = module.noticeGroups || [];
    const [slideIndex, setSlideIndex] = useState(0);
    const totalSlides = groups.reduce((sum, g) => sum + Math.max(0, (g.notices?.length ?? 0) - 1), 0);

    const renderItem = (notice: NoticeItem, key: React.Key) => (
        <div className="notices-item" key={key}>
            <div className="notices-item-img">
                <img src={imageFormat(notice.picUrl)} alt="" />
            </div>
            <div className="notices-item-content">
                <div className="content-title" style={{ color: module.moduleColor?.titleColor }}>
                    {notice.picTitle}
                </div>
                <div className="content-subtitle" style={{ color: module.moduleColor?.sellingPointColor }}>
                    {notice.picDesc}
                </div>
            </div>
        </div>
    );

    return (
        <div
            className="module-ad-con"
            style={cssText(commonStyle.moduleStyle.boxPaddingBottom, commonStyle.moduleStyle.boxPaddingTop, commonStyle.moduleStyle.boxPadding, commonStyle.moduleStyle.backgroundSize, commonStyle.moduleStyle.backgroundImage)}
        >
            <div
                className="module-ad-content"
                style={cssText(commonStyle.moduleContentStyle.backgroundImage, commonStyle.moduleContentStyle.backgroundSize, commonStyle.moduleContentStyle.boxRadius, commonStyle.moduleContentStyle.boxShadow, commonStyle.moduleContentStyle.innerPadding)}
            >
                <div className="mixed-notice">
                    <div className="notices">
                        {groups.map((group, index) => {
                            const notices = group.notices || [];
                            return (
                                <div className="notices-item-box" key={index}>
                                    {notices.length <= 1 ? (
                                        notices.map((notice, subIndex) => renderItem(notice, subIndex))
                                    ) : (
                                        <Swiper
                                            autoplay={3000}
                                            loop={notices.length > 1}
                                            indicator={totalSlides > 0 ? undefined : false}
                                            onChange={(i: number) => setSlideIndex(i)}
                                        >
                                            {notices.map((notice, subIndex) => (
                                                <SwiperItem key={subIndex}>{renderItem(notice, subIndex)}</SwiperItem>
                                            ))}
                                        </Swiper>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * 首焦轮播A2 预览（移植自 view/admin editor/modules/mobilePro/bannerA2/Preview.vue）
 *
 * 背景 = 当前轮播图放大模糊 + 渐变遮罩；顶部定位 + 搜索框；下方圆角轮播。
 */
import { useMemo, useState } from "react";
import { Swiper, SwiperItem } from "@nutui/nutui-react";
import { cssText, imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatCommonStyle } from "../../../contract/sharedDefaults";
import { bannerA2Defaults } from "./index";
import "./Preview.css";

export default function BannerA2Preview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, bannerA2Defaults);
        return merged;
    }, [data]);

    const commonStyle = formatCommonStyle(module.moduleStyle ?? {});
    const bannerContent = module.bannerContent || {};
    const bannerStyle = module.bannerStyle || {};
    const picList: any[] = bannerContent.picList || [];
    const [realIndex, setRealIndex] = useState(0);
    const bgUrl = picList[realIndex]?.picUrl || picList[0]?.picUrl || "";

    const searchStyle: React.CSSProperties = {
        background: bannerStyle.searchBackgroundColor || "#fff",
        color: bannerStyle.searchFontColor || "#999",
        height: `${bannerStyle.searchHeight ?? 34}px`,
        borderRadius: `${bannerStyle.searchRadius ?? 20}px`,
    };

    return (
        <div className="module-ad-con ad-pic_type__2">
            {bgUrl ? (
                <>
                    <div className="banner-bg">
                        <img src={imageFormat(bgUrl)} alt="" />
                    </div>
                    <div className="bg-gradient" />
                </>
            ) : null}
            <div
                style={{
                    ...cssText(
                        commonStyle.moduleStyle.boxPaddingBottom,
                        commonStyle.moduleStyle.boxPaddingTop,
                        commonStyle.moduleStyle.boxPadding,
                        commonStyle.moduleStyle.backgroundSize,
                        commonStyle.moduleStyle.backgroundImage,
                    ),
                    position: "relative",
                }}
            >
                <div className="module-ad-content" style={{ marginTop: `${module.moduleStyle?.bannerMarginTop ?? 0}px` }}>
                    <div className="Banner">
                        <div className="bar">
                            <div className="search-top">
                                <div className="area-select-box">北京市</div>
                                {Number(module.searchContent?.showSearch) === 1 ? (
                                    <div className="search" style={searchStyle}>
                                        <span className="search-icon" style={{ color: bannerStyle.searchIconColor }}>
                                            🔍
                                        </span>
                                        <div className="search-input" style={{ color: bannerStyle.searchFontColor }}>
                                            {module.searchContent?.searchText}
                                        </div>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                        <div className="image-ad-warp">
                            <div
                                className={`image-ad-con pagination-bullet${bannerContent.picPageType}`}
                                style={{ borderRadius: `${bannerContent.picRadius}px`, overflow: "hidden" }}
                            >
                                <Swiper
                                    autoplay={3000}
                                    loop={picList.length > 1}
                                    onChange={(i: number) => setRealIndex(i)}
                                    indicator={false}
                                >
                                    {picList.map((item, i) => (
                                        <SwiperItem key={i}>
                                            <div className="image-ad-item" style={{ borderRadius: `${bannerContent.picRadius}px`, overflow: "hidden" }}>
                                                <img className="item-img" src={imageFormat(item.picUrl)} alt="" />
                                            </div>
                                        </SwiperItem>
                                    ))}
                                </Swiper>
                                {picList.length > 1 ? (
                                    <div className="banner-a2-dots">
                                        {picList.map((_, i) => (
                                            <i
                                                key={i}
                                                style={{
                                                    background: i === realIndex ? bannerContent.swiperPageColor || "#fff" : bannerContent.indicatorColor || "rgba(255,255,255,0.5)",
                                                }}
                                            />
                                        ))}
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

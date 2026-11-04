/**
 * 图片广告1 预览（移植自 view/admin editor/modules/mobile/imageAd/Preview.vue）
 *
 * 结构/类名与 Vue 版逐一致（module-ad-con / image-ad-warp / image-ad-con / image-ad-item），
 * 样式由移植的全局 module.css 提供；轮播使用 NutUI Swiper。
 */
import { useMemo, useState } from "react";
import { Swiper, SwiperItem } from "@nutui/nutui-react";
import CommonTitle from "../../../shared/CommonTitle";
import { cssText, imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatFrame } from "../../../contract/sharedDefaults";
import { imageAdDefaults } from "./index";

export default function ImageAdPreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, imageAdDefaults);
        return merged;
    }, [data]);

    const frameFormat = formatFrame(module.frame ?? {});
    const imgPaddingStyle = cssText(`padding:${module.imgPadding}px;`);
    const swiperPageColor = module.swiperPageColor || "#333";
    const columns = module.swiperPreView || 1;

    // NutUI 分页指示器：与 uniapp 端小圆点一致（active 高亮 swiperPageColor）
    const [slideIndex, setSlideIndex] = useState(0);
    const renderDots = (count: number) => (
        <div className="image-ad-dots">
            {Array.from({ length: count }).map((_, i) => (
                <i key={i} style={{ background: i === slideIndex ? swiperPageColor : "rgba(255,255,255,0.7)" }} />
            ))}
        </div>
    );

    // 分组轮播：按 swiperPreView 切片（与 Vue 版 getSwiperList 一致）
    const swiperList = useMemo(() => {
        const list: any[][] = [];
        const itemNum = module.swiperPreView || 1;
        const picList: any[] = module.picList || [];
        const count = Math.ceil(picList.length / itemNum);
        for (let index = 0; index < count; index++) {
            list.push(picList.slice(index * itemNum, (index + 1) * itemNum));
        }
        return list;
    }, [module.picList, module.swiperPreView]);

    return (
        <div
            className={
                "module-ad-con module-image_ad " +
                " ad-pic_type__" +
                module.picType +
                " ad-pic_page_type__" +
                module.picPageType +
                " ad-radio_style__" +
                module.picRadioStyle +
                " "
            }
            style={cssText(frameFormat.boxPadding, frameFormat.boxPaddingTop, frameFormat.boxPaddingBottom)}
        >
            <div className="module-ad-content" style={cssText(frameFormat.backgroundColor, frameFormat.boxRadius)}>
                {module.title?.showTitle ? <CommonTitle data={module.title} /> : null}
                {!module.picList || module.picList.length === 0 ? (
                    <div className="module-ad-empty empty-image_ad">
                        <div className="image-empty-bg" />
                        <div className="desc">点击添加图片广告</div>
                    </div>
                ) : null}
                {module.picType == 2 ? (
                    <div className="image-ad-warp" style={cssText(frameFormat.innerPadding)}>
                        <div className="image-ad-con">
                            {module.swiperPreView && module.swiperPreView == 1 ? (
                                <Swiper
                                    autoplay={3000}
                                    loop={module.picList.length > 1}
                                    onChange={(i: number) => setSlideIndex(i)}
                                    indicator={renderDots(module.picList.length)}
                                >
                                    {(module.picList as any[]).map((item, i) => (
                                        <SwiperItem key={i}>
                                            <div className="image-ad-item">
                                                <div className="item-content" style={imgPaddingStyle}>
                                                    <div className="item-img-a">
                                                        <img className="item-img" src={imageFormat(item.picUrl)} alt="" />
                                                    </div>
                                                </div>
                                            </div>
                                        </SwiperItem>
                                    ))}
                                </Swiper>
                            ) : (
                                <Swiper
                                    autoplay={3000}
                                    loop={swiperList.length > 1}
                                    onChange={(i: number) => setSlideIndex(i)}
                                    indicator={renderDots(swiperList.length)}
                                >
                                    {swiperList.map((group, gi) => (
                                        <SwiperItem key={gi}>
                                            <div
                                                className="swiper-main"
                                                style={{
                                                    display: "grid",
                                                    gridTemplateColumns: `repeat(${columns}, 1fr)`,
                                                    columnGap: `${module.imgPadding}px`,
                                                    boxSizing: "border-box",
                                                    width: "100%"
                                                }}
                                            >
                                                {group.map((subItem, si) => (
                                                    <div key={si}>
                                                        <div className="image-ad-item">
                                                            <div className="item-content" style={imgPaddingStyle}>
                                                                <div className="item-img-a">
                                                                    <img className="item-img" src={imageFormat(subItem.picUrl)} alt="" />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </SwiperItem>
                                    ))}
                                </Swiper>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="image-ad-warp" style={cssText(frameFormat.innerPadding)}>
                        <div className="image-ad-con">
                            {(module.picList as any[])?.map?.((pic, key) => (
                                <div className="image-ad-item" key={key}>
                                    <div className="item-content" style={imgPaddingStyle}>
                                        <div className="item-img-a">
                                            <img className="item-img" src={imageFormat(pic.picUrl)} alt="" />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

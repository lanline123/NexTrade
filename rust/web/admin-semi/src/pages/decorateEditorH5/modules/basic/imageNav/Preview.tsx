/**
 * 图文导航 预览（移植自 view/admin editor/modules/mobile/imageNav/Preview.vue）
 *
 * 结构/类名与 Vue 版逐一致（img-nav-pic / imagenav-main / imagenav-main-item /
 * imagenav-item-img / img-radius / img-height / imagenav-item-text / swiper-main / swiper-item）；
 * 样式由移植的全局 module.css + 本模块 Preview.css 提供（grid 模板列/行随 rowNum/colNum 内联）。
 */
import { useMemo, useState } from "react";
import { Swiper, SwiperItem } from "@nutui/nutui-react";
import { cssText, imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatFrame } from "../../../contract/sharedDefaults";
import { imageNavDefaults } from "./index";
import "./Preview.css";

export default function ImageNavPreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, imageNavDefaults);
        return merged;
    }, [data]);

    const frameFormat = formatFrame(module.frame ?? {});
    const swiperPageColor = module.swiperPageColor || "#333";
    const rowNum = module.rowNum;
    const colNum = module.colNum;
    const imgPadding = module.imgPadding;

    // NutUI 分页指示器：与 uniapp 端小圆点一致（active 高亮 swiperPageColor）
    const [slideIndex, setSlideIndex] = useState(0);
    const renderDots = (count: number) => (
        <div className="image-ad-dots">
            {Array.from({ length: count }).map((_, i) => (
                <i key={i} style={{ background: i === slideIndex ? swiperPageColor : "rgba(255,255,255,0.7)" }} />
            ))}
        </div>
    );

    // 滑动分页：按 rowNum * colNum 切片（与 Vue 版 getSwiperList 一致）
    const swiperList = useMemo(() => {
        if (module.navType === 1) return [];
        const list: any[][] = [];
        const itemNum = module.rowNum && module.colNum ? module.rowNum * module.colNum : 0;
        const picList: any[] = module.picList || [];
        const count = Math.ceil(picList.length / itemNum);
        for (let index = 0; index < count; index++) {
            list.push(picList.slice(index * itemNum, (index + 1) * itemNum));
        }
        return list;
    }, [module.navType, module.picList, module.rowNum, module.colNum]);

    return (
        <div
            className={
                "img-nav-pic module-ad-con module-image_ad ad-pic_type__2" +
                " ad-pic_page_type__" +
                module.picPageType +
                " ad-radio_style__" +
                module.radioStyle +
                " "
            }
            style={cssText(frameFormat.boxPadding, frameFormat.boxPaddingTop, frameFormat.boxPaddingBottom)}
        >
            <div className="module-ad-content" style={cssText(frameFormat.innerPadding, frameFormat.backgroundColor, frameFormat.boxRadius)}>
                {!module.picList || module.picList.length === 0 ? (
                    <div className="module-ad-empty empty-image_ad">
                        <div className="image-empty-bg" />
                        <div className="desc">点击添加图文导航</div>
                    </div>
                ) : (
                    <>
                        {module.navType === 1 ? (
                            <div
                                className="imagenav-main"
                                style={{
                                    display: "grid",
                                    gridTemplateColumns: `repeat(${rowNum}, 1fr)`,
                                    gridTemplateRows: `repeat(${colNum}, 1fr)`,
                                    columnGap: `${imgPadding}px`
                                }}
                            >
                                {(module.picList as any[]).map((item, index) => (
                                    <div className="imagenav-main-item" key={index}>
                                        {module.navStyle === 1 || module.navStyle === 2 ? (
                                            <img
                                                className={"imagenav-item-img img-radius" + (module.navStyle === 2 ? " img-height" : "")}
                                                src={imageFormat(item.picUrl)}
                                                alt=""
                                            />
                                        ) : null}
                                        {module.navStyle === 1 || module.navStyle === 3 ? <div className="imagenav-item-text">{item.picTitle}</div> : null}
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="image-ad-warp">
                                <div className="image-ad-con">
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
                                                        gridTemplateColumns: `repeat(${rowNum}, 1fr)`,
                                                        columnGap: `${imgPadding}px`
                                                    }}
                                                >
                                                    {group.map((subItem, index) => (
                                                        <div className="swiper-item" key={index}>
                                                            {module.navStyle === 1 || module.navStyle === 2 ? (
                                                                <img className="img-radius" src={imageFormat(subItem.picUrl)} alt="" />
                                                            ) : null}
                                                            {module.navStyle === 1 || module.navStyle === 3 ? (
                                                                <div className="imagenav-item-text">{subItem.picTitle}</div>
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            </SwiperItem>
                                        ))}
                                    </Swiper>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

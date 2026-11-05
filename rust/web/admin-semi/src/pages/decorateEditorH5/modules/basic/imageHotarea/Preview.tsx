/**
 * 热图绘制 预览（移植自 view/admin editor/modules/mobile/imageHotarea/Preview.vue）
 *
 * 结构/类名与 Vue 版逐一致（module-image_hotarea / image-hotarea-warp / item-content-hotatrea /
 * item-img-bg / image-hotarea-link / area_box_con_text）。
 * 热区框：绝对定位 div，按容器实际宽度 / 500（绘制区域原始宽度 px）等比换算
 * width/height/top/left（与 Vue 版 updateWidth/resize 逻辑一致），不修改 store 数据。
 * 热区样式（半透明蓝框/遮罩）来自移植的全局 module.css / decorate.css。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import CommonTitle from "../../../shared/CommonTitle";
import { cssText, imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatFrame } from "../../../contract/sharedDefaults";
import { imageHotareaDefaults } from "./index";

/** 绘制区域原始宽度 px（与 Vue 版常量一致） */
const BASE_WIDTH = 500;

export default function ImageHotareaPreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, imageHotareaDefaults);
        return merged;
    }, [data]);

    const frameFormat = formatFrame(module.frame ?? {});
    const imgPaddingStyle = cssText(`padding:${module.imgPadding}px;`);

    const containerRef = useRef<HTMLDivElement | null>(null);
    const [containerWidth, setContainerWidth] = useState(0);
    // 与 Vue 版 updateWidth 一致：挂载/数据变化/窗口 resize 时测量容器宽度
    useEffect(() => {
        const updateWidth = () => {
            if (containerRef.current) {
                setContainerWidth(containerRef.current.offsetWidth);
            }
        };
        updateWidth();
        window.addEventListener("resize", updateWidth);
        return () => {
            window.removeEventListener("resize", updateWidth);
        };
    }, [module.picList]);

    const resize = (size: number) => {
        return (containerWidth / BASE_WIDTH) * size;
    };

    return (
        <div className={"module-ad-con module-image_hotarea module-image_ad"} style={cssText(frameFormat.boxPadding, frameFormat.boxPaddingTop, frameFormat.boxPaddingBottom)}>
            <div className="module-ad-content" style={cssText(frameFormat.backgroundColor, frameFormat.boxRadius)}>
                {!module.picList || module.picList?.length === 0 ? (
                    <div className="module-ad-empty empty-image_ad">
                        <div className="image-empty-bg" />
                        <div className="desc">点击添加热图绘制</div>
                    </div>
                ) : null}
                {module.title?.showTitle ? <CommonTitle data={module.title} /> : null}
                <div className="image-ad-warp image-hotarea-warp" style={cssText(frameFormat.innerPadding)}>
                    <div className="image-ad-con" ref={containerRef}>
                        {(module.picList as any[])?.map?.((pic, index) => (
                            <div className="image-ad-item" key={index}>
                                <div className="item-content" style={imgPaddingStyle}>
                                    <div className="item-content-hotatrea">
                                        <img className="item-img-bg" alt={pic.picTitle} src={imageFormat(pic.picUrl)} style={{ display: "block" }} />
                                        {(pic.hotarea as any[])?.map?.((picHotarea, idx) => (
                                            <div
                                                key={idx}
                                                className="image-hotarea-link"
                                                style={{
                                                    width: resize(picHotarea.width ?? 0) + "px",
                                                    height: resize(picHotarea.height ?? 0) + "px",
                                                    top: resize(picHotarea.top ?? 0) + "px",
                                                    left: resize(picHotarea.left ?? 0) + "px"
                                                }}
                                            >
                                                <span className="area_box_con_text">{picHotarea.link?.name}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * 图片橱窗 预览（移植自 view/admin editor/modules/mobilePro/imageShowcase/Preview.vue）
 */
import { useMemo } from "react";
import { imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatCommonStyle } from "../../../contract/sharedDefaults";
import { imageShowcaseDefaults, imageShowcasePaddingMap } from "./index";
import "./Preview.css";

export default function ImageShowcasePreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, imageShowcaseDefaults);
        return merged;
    }, [data]);

    const commonStyle = formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {});

    const picList: any[] = module.picList || [];
    const rowNum = Number(module.rowNum ?? 4);
    const gap = Number(module.imgPadding ?? 0);
    // fixed 用 grid；scroll 超出行数时横向滑动
    const isScroll = module.listStyle === "scroll" && picList.length > rowNum;

    const itemStyle: React.CSSProperties = isScroll
        ? { flex: `0 0 calc((100% - ${(rowNum - 1) * gap}px) / ${rowNum})`, marginRight: `${gap}px` }
        : {};

    const ratioPadding = imageShowcasePaddingMap[module.picRatio ?? "default"] || "";
    const imageBoxStyle: React.CSSProperties = {
        position: "relative",
        borderRadius: `${module.picRadius ?? 0}px`,
        boxShadow: Number(module.boxShadow) === 1 ? "0 2px 8px rgba(0, 0, 0, 0.06)" : "none",
        overflow: "hidden",
        ...(ratioPadding ? { paddingTop: ratioPadding, height: 0 } : {}),
    };
    const imageStyle: React.CSSProperties =
        (module.picRatio ?? "default") === "default"
            ? { width: "100%", height: "auto", display: "block" }
            : { position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "block", objectFit: module.picFillType ?? "cover" };

    return (
        <div
            className="module-ad-con module-image_showcase"
            style={{
                ...commonStyle.moduleStyle.boxPaddingTop,
                ...commonStyle.moduleStyle.boxPaddingBottom,
                ...commonStyle.moduleStyle.boxPadding,
                ...commonStyle.moduleStyle.backgroundColor,
                ...commonStyle.moduleStyle.backgroundImage,
                ...commonStyle.moduleStyle.backgroundSize,
            }}
        >
            <div
                className="module-ad-content"
                style={{
                    ...commonStyle.moduleContentStyle.backgroundImage,
                    ...commonStyle.moduleContentStyle.backgroundSize,
                    ...commonStyle.moduleContentStyle.boxRadius2,
                    ...commonStyle.moduleContentStyle.boxShadow,
                    ...commonStyle.moduleContentStyle.innerPadding,
                    ...commonStyle.moduleContentStyle.backgroundColor,
                }}
            >
                {picList.length === 0 ? (
                    <div className="module-ad-empty empty-image_ad">
                        <div className="image-empty-bg" />
                        <div className="desc">点击添加图片</div>
                    </div>
                ) : (
                    <div className={`image-showcase-list ${isScroll ? "is-scroll" : "is-fixed"}`} style={isScroll ? { display: "flex", overflowX: "auto" } : { display: "grid", gridTemplateColumns: `repeat(${rowNum}, 1fr)`, gap: `${gap}px` }}>
                        {picList.map((pic, key) => (
                            <div className="image-showcase-item" key={key} style={itemStyle}>
                                <div className="item-image-box" style={imageBoxStyle}>
                                    <img className="item-image" src={imageFormat(pic.picUrl)} style={imageStyle} alt="" />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

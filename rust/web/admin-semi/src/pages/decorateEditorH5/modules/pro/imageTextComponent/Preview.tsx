/**
 * 图文介绍 预览（移植自 view/admin editor/modules/mobilePro/imageTextComponent/Preview.vue）
 */
import { useMemo } from "react";
import { imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatCommonStyle } from "../../../contract/sharedDefaults";
import { imageTextComponentDefaults } from "./index";
import "./Preview.css";

export default function ImageTextComponentPreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, imageTextComponentDefaults);
        return merged;
    }, [data]);

    const commonStyle = formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});

    return (
        <div
            className="module-ad-con"
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
                    ...commonStyle.moduleContentStyle.backgroundImage,
                    ...commonStyle.moduleContentStyle.backgroundSize,
                    ...commonStyle.moduleContentStyle.boxRadius2,
                    ...commonStyle.moduleContentStyle.boxShadow,
                    ...commonStyle.moduleContentStyle.innerPadding,
                    ...commonStyle.moduleContentStyle.backgroundColor,
                }}
            >
                <div className="imagetext">
                    <div
                        className="image-box"
                        style={{ border: `${module.picBorder}px solid ${module.picBorderColor}`, borderRadius: `${module.picRadius}px` }}
                    >
                        <img className="img" src={imageFormat(module.picUrl?.picUrl)} alt="" />
                    </div>
                    <div className="intro-box">
                        <div
                            className="title"
                            style={{ color: module.titColor, textAlign: module.titTextAlignment, marginBottom: `${module.titMarginBottom}px` }}
                        >
                            {module.title}
                        </div>
                        <div className="intro" style={{ color: module.descColor, textAlign: module.descTextAlignment }}>
                            {module.description}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

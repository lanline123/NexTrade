/**
 * 个性商品 预览（忠实还原旧版 mobilePro/customProduct/Preview.vue：仅容器占位文本）
 */
import { useMemo } from "react";
import { cssText } from "../../../shared/format";
import { mergeDefaultModule, formatCommonStyle } from "../../../contract/sharedDefaults";
import { customProductDefaults } from "./index";

export default function CustomProductPreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, customProductDefaults);
        return merged;
    }, [data]);

    const commonStyle = formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});

    return (
        <div
            className="module-ad-con"
            style={cssText(commonStyle.moduleStyle.boxPaddingBottom, commonStyle.moduleStyle.boxPaddingTop, commonStyle.moduleStyle.boxPadding, commonStyle.moduleStyle.backgroundSize, commonStyle.moduleStyle.backgroundImage)}
        >
            <div
                className="module-ad-content"
                style={cssText(commonStyle.moduleContentStyle.backgroundImage, commonStyle.moduleContentStyle.backgroundSize, commonStyle.moduleContentStyle.boxRadius2, commonStyle.moduleContentStyle.boxShadow, commonStyle.moduleContentStyle.innerPadding)}
            >
                个性商品
            </div>
        </div>
    );
}

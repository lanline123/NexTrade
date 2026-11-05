/**
 * 空白辅助 预览（移植自 view/admin whiteBlank/Preview.vue）
 */
import { useMemo } from "react";
import { cssText } from "../../../shared/format";
import { mergeDefaultModule } from "../../../contract/sharedDefaults";
import { whiteBlankDefaults } from "./index";

export default function WhiteBlankPreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, whiteBlankDefaults);
        return merged;
    }, [data]);

    return (
        <div className="module-ad-con module-image_hotarea">
            <div className="module-ad-content">
                <div style={cssText(`background-color: ${module.backgroundColor};`, `height: ${module.blankHeight}px;`)} />
            </div>
        </div>
    );
}

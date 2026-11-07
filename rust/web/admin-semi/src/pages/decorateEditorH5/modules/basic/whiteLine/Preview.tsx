/**
 * 分割线 预览（移植自 view/admin whiteLine/Preview.vue，类名与结构逐一致）
 */
import { useMemo } from "react";
import { cssText } from "../../../shared/format";
import { mergeDefaultModule, formatFrame } from "../../../contract/sharedDefaults";
import { whiteLineDefaults } from "./index";
import "./Preview.css";

import { useI18n } from '../../../../../i18n';
export default function WhiteLinePreview({ data }: { data: Record<string, any> }) {
    const { t } = useI18n();
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, whiteLineDefaults);
        return merged;
    }, [data]);

    const frameFormat = formatFrame(module.frame ?? {});

    return (
        <div className="module-ad-con module-image_hotarea" style={cssText(frameFormat.boxPadding, frameFormat.boxPaddingTop, frameFormat.boxPaddingBottom)}>
            <div className="module-ad-content" style={cssText(frameFormat.backgroundColor, frameFormat.boxRadius)}>
                {Object.values(module).length === 0 ? (
                    <div className="module-ad-empty empty-image_ad">
                        <div className="image-empty-bg" />
                        <div className="desc">{t('空白分割线')}</div>
                    </div>
                ) : (
                    <div className="white-line-warp">
                        <div className="white-line-con">
                            {module.lineType === 2 ? (
                                <div
                                    className={
                                        "white-line-item" +
                                        (module?.lineStyle === 2 ? " white-line-item2" : "") +
                                        (module?.lineStyle === 3 ? " white-line-item3" : "")
                                    }
                                >
                                    <div className="item-content">
                                        <div className="item-line" />
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

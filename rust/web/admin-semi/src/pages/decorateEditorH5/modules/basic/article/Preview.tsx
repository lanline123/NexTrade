/**
 * 文章列表 预览（移植自 view/admin article/Preview.vue：moduleStyle/contentStyle 容器占位）
 */
import { useMemo } from "react";
import { cssText } from "../../../shared/format";
import { mergeDefaultModule, formatCommonStyle } from "../../../contract/sharedDefaults";
import { articleDefaults } from "./index";

import { useI18n } from '../../../../../i18n';
export default function ArticlePreview({ data }: { data: Record<string, any> }) {
    const { t } = useI18n();
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, articleDefaults);
        return merged;
    }, [data]);

    const commonStyle = formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});

    return (
        <div
            className="module-ad-con"
            style={cssText(
                commonStyle.moduleStyle.boxPaddingBottom,
                commonStyle.moduleStyle.boxPaddingTop,
                commonStyle.moduleStyle.boxPaddingBottom,
                commonStyle.moduleStyle.boxPadding,
                commonStyle.moduleStyle.backgroundSize,
                commonStyle.moduleStyle.backgroundImage
            )}
        >
            <div
                className="module-ad-content"
                style={cssText(
                    commonStyle.moduleContentStyle.backgroundImage,
                    commonStyle.moduleContentStyle.backgroundSize,
                    commonStyle.moduleContentStyle.boxRadius2,
                    commonStyle.moduleContentStyle.boxShadow,
                    commonStyle.moduleContentStyle.innerPadding
                )}
            >{t('文章列表')}</div>
        </div>
    );
}

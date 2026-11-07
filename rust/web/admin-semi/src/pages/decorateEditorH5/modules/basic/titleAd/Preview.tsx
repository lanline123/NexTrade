/**
 * 文本标题 预览（移植自 view/admin titleAd/Preview.vue，类名与结构逐一致）
 */
import { useMemo } from "react";
import { cssText } from "../../../shared/format";
import { mergeDefaultModule, formatFrame } from "../../../contract/sharedDefaults";
import { titleAdDefaults } from "./index";
import "./Preview.css";

import { useI18n } from '../../../../../i18n';
export default function TitleAdPreview({ data }: { data: Record<string, any> }) {
    const { t } = useI18n();
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, titleAdDefaults);
        return merged;
    }, [data]);

    const frameFormat = formatFrame(module.frame ?? {});
    const title = module?.title ?? {};
    const allFormat = {
        descColor: `color: ${title?.descColor};`,
        moreColor: `color: ${title?.moreColor};`,
        titleColor: `color: ${title?.titleColor};font-weight: ${title?.titleWeight || "normal"};`
    };
    const paddingStyle = `padding-left: ${module.frame?.leftAndRightPadding}px;padding-right: ${module.frame?.leftAndRightPadding}px;`;

    return (
        <div
            className={"module-ad-con module-title_ad ad-title_align__" + (module?.title?.titleAlign ?? 1)}
            style={cssText(frameFormat.boxPadding, frameFormat.boxPaddingTop, frameFormat.boxPaddingBottom)}
        >
            <div className="module-ad-content" style={cssText(frameFormat.backgroundColor, frameFormat.boxRadius)}>
                <div className="title-ad-warp" style={cssText(paddingStyle)}>
                    <div className="title-ad-con">
                        <div className="title-ad-item">
                            <div className="item-content">
                                <div className={"image-ad-title ad-title_style__" + (title?.titleStyle ?? 1)}>
                                    <div className="image-ad-title-l">
                                        <div className="image-ad-title-h" style={cssText(allFormat.titleColor)}>
                                            {title?.titleText}
                                        </div>
                                        <div className="image-ad-title-d" style={cssText(allFormat.descColor)}>
                                            {title?.descText}
                                        </div>
                                    </div>
                                    {title?.showMore === 1 ? (
                                        <div className="image-ad-title-r">
                                            <span style={cssText(allFormat.moreColor)}>{t('更多')}</span>
                                            <i className="iconfont-h5 icon-youjiantou h5-arrow-right" style={cssText(allFormat.moreColor)} />
                                        </div>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

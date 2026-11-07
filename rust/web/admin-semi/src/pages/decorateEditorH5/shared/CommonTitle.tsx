/**
 * 模块通用标题（移植自 view/admin src/modules/src/commonTitle/View.vue）
 *
 * 类名与样式 hook 与 Vue 版逐一致（image-ad-title 系列），样式由全局 module.css 提供。
 */
import { useMemo } from "react";
import { formatTitle } from "../contract/sharedDefaults";
import { cssText, productImage } from "./format";

import { useI18n } from '../../../i18n';
interface TitleData {
    showTitle?: number;
    titleStyle?: number;
    titleAlign?: number;
    titleBackground?: string;
    titleBackground2?: string;
    titleBackgroundPic?: { picUrl?: string; picThumb?: string };
    titleRadius?: number;
    titleText?: string;
    titleColor?: string;
    titleWeight?: string;
    descText?: string;
    descColor?: string;
    showMore?: number;
    moreType?: number;
    countdownLabel?: string;
    moreLink?: any[];
    moreColor?: string;
    format?: Record<string, string>;
}

export default function CommonTitle({ data }: { data: TitleData }) {
    const { t } = useI18n();
    const title = data ?? ({} as TitleData);
    const titleFormat = useMemo(() => formatTitle(title), [title]);
    const titleBackgroundImage = productImage(title.titleBackgroundPic);

    if (!title.showTitle) return null;

    return (
        <div
            className={"image-ad-title ad-title_style__" + (title.titleStyle ?? 1)}
            style={cssText(titleFormat.titleBackground, titleFormat.titleRadius)}
        >
            <div className="image-ad-title-l">
                {titleBackgroundImage ? <img className="image-ad-title-img" src={titleBackgroundImage} alt="" /> : null}
                <div className="image-ad-title-h" style={{ color: title.titleColor, fontWeight: title.titleWeight as any }}>
                    {title.titleText}
                </div>
                <div className="image-ad-title-d" style={{ color: title.descColor }}>
                    {title.descText}
                </div>
            </div>
            {!!title.showMore && (
                <div className="image-ad-title-r">
                    <div className="more-link" style={{ color: title?.moreColor }}>
                        <span style={{ color: title?.moreColor }}>{t('更多')}</span>
                        <i className="iconfont-h5 icon-youjiantou h5-arrow-right" style={{ color: title?.moreColor }} />
                    </div>
                </div>
            )}
        </div>
    );
}

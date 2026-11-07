/**
 * 类目导航 预览（移植自 view/admin editor/modules/mobilePro/categoryNav/Preview.vue）
 */
import { useMemo } from "react";
import { imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatCommonStyle } from "../../../contract/sharedDefaults";
import { categoryNavDefaults } from "./index";
import "./Preview.css";

export default function CategoryNavPreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, categoryNavDefaults);
        return merged;
    }, [data]);

    const commonStyle = formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    const categoryList: any[] = module.categoryList || [];
    const itemStyle: React.CSSProperties = {
        flexGrow: 0,
        flexBasis: `${module.rowNum ? 100 / module.rowNum : 25}%`,
        ...(module.listStyleType === "slide" ? { flexShrink: 0 } : {}),
    };
    const imgStyle: React.CSSProperties = {
        paddingTop: `${module.picPercent}%`,
        width: `${module.picPercent}%`,
        borderRadius: `${module.radius}px`,
        backgroundSize: module.picFillType,
    };
    const subTitle = commonStyle.moduleSubTitle || {};

    return (
        <div
            className="module-ad-con"
            style={{
                ...commonStyle.moduleStyle.boxPaddingBottom,
                ...commonStyle.moduleStyle.boxPaddingTop,
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
                    ...commonStyle.moduleContentStyle.boxRadius,
                    ...commonStyle.moduleContentStyle.boxShadow,
                    ...commonStyle.moduleContentStyle.innerPadding,
                }}
            >
                <div className={`category-nav decorate-slide-box ${module.listStyleType}`}>
                    {categoryList.map((item, index) => (
                        <div className="category-nav-item" key={index} style={itemStyle}>
                            <div className="item-box" style={{ padding: `${module.categoryPadding}px` }}>
                                <div className="category-nav-item-img" style={{ backgroundImage: `url(${imageFormat(item.picUrl)})`, ...imgStyle }} />
                                {module.subTitle?.showTitle ? (
                                    <p className="category-nav-item-text" style={{ ...(subTitle.textBlod || {}), ...(subTitle.textColor || {}), ...(subTitle.textFontSize || {}) }}>
                                        {item.picTitle}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

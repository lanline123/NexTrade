/**
 * 分类推荐 预览（移植自 view/admin editor/modules/mobilePro/categoryRec/Preview.vue）
 *
 * 横向圆角胶囊分类卡（图 + 标题），每项可覆盖标题色/背景色，支持边框。
 */
import { useMemo } from "react";
import { imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatCommonStyle } from "../../../contract/sharedDefaults";
import { categoryRecDefaults } from "./index";
import "./Preview.css";

export default function CategoryRecPreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, categoryRecDefaults);
        return merged;
    }, [data]);

    const commonStyle = formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {}, module.subTitle ?? {});
    const categoryList: any[] = module.categoryList || [];
    const borderStyle: React.CSSProperties =
        Number(module.catBorder) === 1
            ? { border: `${module.catBorderWidth || 1}px solid ${module.catBorderColor || "#ffffff"}` }
            : {};

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
                <div className="category-rec">
                    <div className="ul">
                        {categoryList.map((item, index) => (
                            <div
                                className="li"
                                key={index}
                                style={{ borderRadius: `${module.radius}px`, backgroundColor: module.backgroundColor }}
                            >
                                <div
                                    className="item"
                                    style={{
                                        padding: `${module.categoryPadding}px 15px`,
                                        borderRadius: `${module.radius}px`,
                                        backgroundColor: item.backgroundColor,
                                        ...borderStyle,
                                    }}
                                >
                                    <img className="img" src={imageFormat(item.catPic?.picUrl)} alt="" />
                                    <div
                                        className="tit"
                                        style={{
                                            fontSize: `${module.subTitle?.titleFontSize}px`,
                                            fontWeight: module.subTitle?.titleFontBold,
                                            color: item.titleColor || module.subTitle?.titleColor,
                                        }}
                                    >
                                        {item.title}
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

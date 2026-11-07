/**
 * 标签导航 预览（移植自 view/admin editor/modules/mobilePro/tagNav/Preview.vue）
 *
 * 水滴形标签（右上尖角 50% 0 50% 50%），按 index%6 循环渐变色。
 */
import { useMemo } from "react";
import { mergeDefaultModule, formatCommonStyle } from "../../../contract/sharedDefaults";
import { tagNavDefaults } from "./index";
import "./Preview.css";

export default function TagNavPreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, tagNavDefaults);
        return merged;
    }, [data]);

    const commonStyle = formatCommonStyle(module.moduleStyle ?? {});
    const groupList: Array<{ title?: string }> = module.groupList || [];
    const isEmpty = groupList.length === 0;

    const itemStyle = (index: number): React.CSSProperties => {
        const colors: Array<{ colorA?: string; colorB?: string }> = module.categoryColors ?? [];
        const c = colors.length ? colors[index % colors.length] : {};
        const a = c.colorA || "#cccccc";
        const b = c.colorB || c.colorA || "#cccccc";
        const size = 32 + Number(module.groupPadding ?? 10) * 2;
        return {
            backgroundImage: `linear-gradient(to bottom, ${a}, ${b})`,
            borderRadius: "50% 0 50% 50%",
            width: `${size}px`,
            height: `${size}px`,
            marginRight: `${module.groupGap ?? 10}px`,
        };
    };

    const textStyle: React.CSSProperties = {
        color: module.titleColor || "#ffffff",
        fontWeight: Number(module.textWeight ?? 700),
    };

    return (
        <div
            className="module-ad-con module-tag_nav"
            style={{
                ...commonStyle.moduleStyle.boxPaddingTop,
                ...commonStyle.moduleStyle.boxPaddingBottom,
                ...commonStyle.moduleStyle.boxPadding,
                ...commonStyle.moduleStyle.backgroundColor,
                ...commonStyle.moduleStyle.backgroundImage,
                ...commonStyle.moduleStyle.backgroundSize,
            }}
        >
            {isEmpty ? (
                <div className="module-ad-empty">
                    <div className="desc">点击添加标签</div>
                </div>
            ) : (
                <div className="tag-nav-scroll">
                    {groupList.map((group, index) => (
                        <div className="tag-nav-item" key={index} style={itemStyle(index)}>
                            <span className="tag-nav-text" style={textStyle}>
                                {group.title}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

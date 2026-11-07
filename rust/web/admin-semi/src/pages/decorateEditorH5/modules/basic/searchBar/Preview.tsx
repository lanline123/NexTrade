/**
 * 商品搜索 预览（移植自 view/admin editor/modules/mobile/searchBar/Preview.vue）
 *
 * 类名与 Vue 版逐一致（module-search_bar / searchBar-warp / item-search-form）。
 */
import { useMemo } from "react";
import { cssText } from "../../../shared/format";
import { mergeDefaultModule, formatFrame } from "../../../contract/sharedDefaults";
import { searchBarDefaults } from "./index";

export default function SearchBarPreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, searchBarDefaults);
        return merged;
    }, [data]);

    const frameFormat = formatFrame(module.frame ?? {});
    const itemBackgroundColor = cssText(`background-color:${module.frame?.itemBackgroundColor || ""};`);
    const itemHeight = cssText(`height:${module.frame?.itemHeight ?? 35}px;`);
    const itemBorderRadius = cssText(`border-radius:${module.frame?.itemRadius ?? 3}px;`);
    const textColor = cssText(`color:${module.frame?.textColor || ""};`);

    return (
        <div className="module-ad-con module-search_bar" style={cssText(frameFormat.boxPadding, frameFormat.boxPaddingTop, frameFormat.boxPaddingBottom)}>
            <div className="module-ad-content" style={cssText(frameFormat.backgroundColor, frameFormat.boxRadius)}>
                <div className="searchBar-warp">
                    <div className="searchBar-con">
                        <div className="searchBar-item">
                            <div className="item-content">
                                <div className="item-search-con">
                                    <div className="item-search-form" style={{ ...itemBackgroundColor, ...itemHeight, ...itemBorderRadius, ...textColor }}>
                                        <svg viewBox="0 0 1024 1024" width="18" height="18" fill="#999" style={{ marginLeft: 10, flexShrink: 0 }}>
                                            <path d="M448 768A320 320 0 1 0 448 128a320 320 0 0 0 0 640z m297.6 43.3a448 448 0 1 1 66.7-66.7l194 194a48 48 0 0 1-67.9 67.9l-192.8-195.2z" />
                                        </svg>
                                        <div className="item-search-input">{module.text}</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

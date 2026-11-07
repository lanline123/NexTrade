/**
 * 商品搜索2 预览（移植自 view/admin editor/modules/mobile/searchBar2/Preview.vue，跨境版样式）
 *
 * 类名与 Vue 版逐一致（oversea-sousuo-box / oversea-sousuo）。
 */
import { useMemo } from "react";
import { cssText } from "../../../shared/format";
import { mergeDefaultModule, formatFrame } from "../../../contract/sharedDefaults";
import { searchBar2Defaults } from "./index";
import "./Preview.css";

export default function SearchBar2Preview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, searchBar2Defaults);
        return merged;
    }, [data]);

    const frameFormat = formatFrame(module.frame ?? {});
    const itemHeight = cssText(`height:${module.frame?.itemHeight ?? 35}px;`);
    const itemBorderRadius = cssText(`border-radius:${module.frame?.itemRadius ?? 3}px;`);

    return (
        <div
            className="module-ad-con module-search_bar"
            style={cssText(frameFormat.boxPadding, frameFormat.boxPaddingTop, frameFormat.boxPaddingBottom, frameFormat.backgroundColor)}
        >
            <div className="module-ad-content" style={cssText(`background-color:${module.frame?.itemBackgroundColor || "#fff"};`)}>
                <div className="oversea-sousuo-box">
                    <div className="oversea-sousuo" style={{ ...itemHeight, ...itemBorderRadius }}>
                        <div className="placeholder-text">{module.text}</div>
                        <div className="sousuo-icon">
                            <svg viewBox="0 0 1024 1024" width="16" height="16" fill="currentColor" style={{ display: "block" }}>
                                <path d="M448 768A320 320 0 1 0 448 128a320 320 0 0 0 0 640z m297.6 43.3a448 448 0 1 1 66.7-66.7l194 194a48 48 0 0 1-67.9 67.9l-192.8-195.2z" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

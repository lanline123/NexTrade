/**
 * 公告 预览（移植自 view/admin notice/Preview.vue，类名与滚动动画逐一致）
 */
import { useMemo } from "react";
import { cssText, imageFormat } from "../../../shared/format";
import { mergeDefaultModule, defaultFrame, formatFrame, copyArray } from "../../../contract/sharedDefaults";
import { noticeDefaults } from "./index";
import "./Preview.css";

export default function NoticePreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        // 旧 View.vue 渲染时的全局副作用，原样保留（契约）
        defaultFrame.backgroundColor = "transparent";
        mergeDefaultModule(merged, noticeDefaults);
        merged.icoPic.picUrl = "https://oss.tigshop.com/img/gallery/202508/1754895669bP3iJSUiXSBoRB1VQq.png";
        return merged;
    }, [data]);

    const frameFormat = formatFrame(module.frame ?? {});
    const list = module.text ? copyArray(module.text, 3) : [];
    const itemFormat = {
        itemBackgroundColor: `background-color:${module?.frame?.itemBackgroundColor};`,
        itemRadius: `border-radius:${module?.frame?.itemRadius}px;`,
        itemHeight: `height:${module?.frame?.itemHeight}px;`,
        textColor: `color:${module?.frame?.textColor};`
    };

    return (
        <div className="module-ad-con module-notice" style={cssText(frameFormat.boxPadding, frameFormat.boxPaddingTop, frameFormat.boxPaddingBottom)}>
            <div className="notice-ad-warp">
                <div className="notice-con" style={cssText(frameFormat.backgroundColor, frameFormat.boxRadius, itemFormat.itemRadius)}>
                    <div className="notice-item">
                        <div className="item-content">
                            <div className="item-notice-con" style={cssText(itemFormat.itemBackgroundColor, itemFormat.itemHeight)}>
                                <div className="item-notice-ico">
                                    <img src={imageFormat(module?.icoPic.picUrl)} alt="" />
                                </div>
                                <div className="item-notice-list">
                                    {module.nociceEffect === "scroll" ? (
                                        <div className="item-notice-input scroll-animation" style={cssText(itemFormat.textColor)}>
                                            {list.map((item: string, index: number) => (
                                                <div className="headlines-item" key={index}>
                                                    {item}
                                                </div>
                                            ))}
                                        </div>
                                    ) : null}
                                    {module.nociceEffect === "still" ? (
                                        <div className="item-notice-input" style={cssText(itemFormat.textColor)}>
                                            <div className="headlines-item">{module?.text}</div>
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

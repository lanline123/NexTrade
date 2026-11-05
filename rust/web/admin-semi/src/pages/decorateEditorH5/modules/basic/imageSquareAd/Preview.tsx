/**
 * 图片魔方 预览（移植自 view/admin editor/modules/mobile/imageSquareAd/Preview.vue）
 *
 * 结构/类名与 Vue 版逐一致（module-ad-con / image-square-layout / grid-layout-2 / grid-layout-3 / image-ad-item）；
 * 根节点 class 串保留 Vue 版原文（ad-pic_type__ 后无值，逐字保留）；布局专属样式见 Preview.css。
 */
import { useMemo } from "react";
import CommonTitle from "../../../shared/CommonTitle";
import { cssText, imageFormat } from "../../../shared/format";
import { mergeDefaultModule, formatFrame } from "../../../contract/sharedDefaults";
import { imageSquareAdDefaults } from "./index";
import "./Preview.css";

function SquareItem({ pic, imgPadding }: { pic?: Record<string, any>; imgPadding: string }) {
    return (
        <div className="image-ad-item">
            <div className="item-content" style={cssText(imgPadding)}>
                <div className="item-img-a">
                    <img className="item-img" src={imageFormat(pic?.picUrl)} alt="" />
                </div>
            </div>
        </div>
    );
}

export default function ImageSquareAdPreview({ data }: { data: Record<string, any> }) {
    const module = useMemo(() => {
        const merged = JSON.parse(JSON.stringify(data ?? {}));
        mergeDefaultModule(merged, imageSquareAdDefaults);
        return merged;
    }, [data]);

    const frameFormat = formatFrame(module.frame ?? {});
    const imgPadding = "padding:" + module.imgPadding + "px;";
    const picList: any[] = module.picList || [];

    return (
        <div
            className={
                "module-ad-con module-image_ad " +
                " ad-pic_type__" +
                " ad-pic_page_type__" +
                module.picPageType +
                " ad-radio_style__" +
                module.picRadioStyle +
                " "
            }
            style={cssText(frameFormat.boxPadding, frameFormat.boxPaddingTop, frameFormat.boxPaddingBottom)}
        >
            <div className="module-ad-content" style={cssText(frameFormat.backgroundColor, frameFormat.boxRadius)}>
                {module.title?.showTitle ? <CommonTitle data={module.title} /> : null}
                {picList.length === 0 ? (
                    <div className="module-ad-empty empty-image_ad">
                        <div className="image-empty-bg" />
                        <div className="desc">点击添加模块图片广告</div>
                    </div>
                ) : (
                    <div className="image-ad-warp" style={cssText(frameFormat.innerPadding)}>
                        <div className="image-ad-con">
                            {module.picType == 5 ? (
                                // 左一右二
                                <div className="image-square-layout">
                                    <SquareItem pic={picList[0]} imgPadding={imgPadding} />
                                    <div className="grid-layout-2">
                                        <SquareItem pic={picList[1]} imgPadding={imgPadding} />
                                        <SquareItem pic={picList[2]} imgPadding={imgPadding} />
                                    </div>
                                </div>
                            ) : module.picType == 7 ? (
                                // 上一下二
                                <div className="image-square-layout2">
                                    <SquareItem pic={picList[0]} imgPadding={imgPadding} />
                                    <div className="grid-layout-2">
                                        <SquareItem pic={picList[1]} imgPadding={imgPadding} />
                                        <SquareItem pic={picList[2]} imgPadding={imgPadding} />
                                    </div>
                                </div>
                            ) : module.picType == 6 ? (
                                // 左一右三
                                <div className="image-square-layout image-square-layout3">
                                    <SquareItem pic={picList[0]} imgPadding={imgPadding} />
                                    <div className="grid-layout-2">
                                        <div>
                                            <SquareItem pic={picList[1]} imgPadding={imgPadding} />
                                        </div>
                                        <div className="grid-layout-3">
                                            <SquareItem pic={picList[2]} imgPadding={imgPadding} />
                                            <SquareItem pic={picList[3]} imgPadding={imgPadding} />
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                // 一行两个 / 一行三个 / 一行四个 / 左二右二
                                <div className={"image-square-layout-" + module.picType}>
                                    {picList.map((pic, key) => (
                                        <SquareItem key={key} pic={pic} imgPadding={imgPadding} />
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

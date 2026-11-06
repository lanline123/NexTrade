import { useMemo } from "react";
import { Image, View } from "@tarojs/components";

import { designPxToRpx, formatCommonStyle, imageShowcasePaddingMap } from "@/components/modules";
import { imageFormat, urlFormat } from "@/utils/format";
import { redirect } from "@/utils";

import "./index.scss";

interface Props {
    module: any;
    moduleIndex?: number;
    index?: number;
}

export default function ImageShowcase({ module }: Props) {
    const commonStyle = useMemo(() => {
        return formatCommonStyle(module.moduleStyle ?? {}, module.contentStyle ?? {});
    }, [module.moduleStyle, module.contentStyle]);

    // Fallback defaults aligned with admin's defaultImageShowcase
    // (Tigshop-Admin/src/views/decorate/decorate/src/modules/index.ts).
    // Admin's mergeDefaultModule normally fills these on save, but mobile keeps
    // the same fallback so legacy / partial payloads render identically to canvas.
    const rowNum = useMemo(() => Number(module.rowNum) || 4, [module.rowNum]);
    const gap = useMemo(() => {
        const v = module.imgPadding;
        return v === undefined || v === null ? 4 : Number(v) || 0;
    }, [module.imgPadding]);
    const picRatio = useMemo(() => module.picRatio ?? "default", [module.picRatio]);
    const picFillType = useMemo(() => module.picFillType ?? "cover", [module.picFillType]);
    const picRadius = useMemo(() => {
        const v = module.picRadius;
        return v === undefined || v === null ? 8 : Number(v) || 0;
    }, [module.picRadius]);
    const boxShadow = useMemo(() => {
        const v = module.boxShadow;
        return v === undefined || v === null ? true : v === 1;
    }, [module.boxShadow]);

    const renderListStyle = useMemo(() => {
        if (module.listStyle !== "scroll") return "fixed";
        return (module.picList?.length ?? 0) > rowNum ? "scroll" : "fixed";
    }, [module.listStyle, module.picList, rowNum]);

    const getItemStyle = (idx: number) => {
        const i = Number(idx);
        const n = rowNum;
        const g = gap;
        const basis = `calc((100% - ${designPxToRpx((n - 1) * g)}) / ${n})`;
        let style = `flex: 0 0 ${basis};`;
        const total = module.picList?.length ?? 0;
        if (renderListStyle === "scroll") {
            const isLast = i === total - 1;
            if (!isLast && g) style += `margin-right:${designPxToRpx(g)};`;
        } else {
            const lastCol = (i + 1) % n === 0;
            const lastRow = Math.ceil((i + 1) / n) === Math.ceil(total / n);
            if (!lastCol && g) style += `margin-right:${designPxToRpx(g)};`;
            if (!lastRow && g) style += `margin-bottom:${designPxToRpx(g)};`;
        }
        return style;
    };

    const imageBoxStyle = useMemo(() => {
        const radius = designPxToRpx(picRadius);
        const padTop = imageShowcasePaddingMap[picRatio] || "";
        const shadow = boxShadow ? "0 4rpx 16rpx rgba(0, 0, 0, 0.06)" : "none";
        let style = `position:relative;border-radius:${radius};box-shadow:${shadow};overflow:hidden;`;
        if (padTop) style += `padding-top:${padTop};height:0;`;
        return style;
    }, [picRadius, picRatio, boxShadow]);

    const imageMode = useMemo(() => (picFillType === "contain" ? "aspectFit" : "aspectFill"), [picFillType]);

    if (!(module.picList && module.picList.length > 0)) {
        return null;
    }

    return (
        <View
            className="module-ad-con module-image_showcase"
            style={
                commonStyle.moduleStyle.boxPaddingTop +
                commonStyle.moduleStyle.boxPaddingBottom +
                commonStyle.moduleStyle.boxPadding +
                commonStyle.moduleStyle.backgroundColor +
                commonStyle.moduleStyle.backgroundImage +
                commonStyle.moduleStyle.backgroundSize
            }
        >
            <View
                className="module-ad-content"
                style={
                    commonStyle.moduleContentStyle.backgroundImage +
                    commonStyle.moduleContentStyle.backgroundSize +
                    commonStyle.moduleContentStyle.boxRadius2 +
                    commonStyle.moduleContentStyle.boxShadow +
                    commonStyle.moduleContentStyle.innerPadding +
                    commonStyle.moduleContentStyle.backgroundColor
                }
            >
                {module.picList && module.picList.length > 0 && (
                    <View className={`image-showcase-list ${renderListStyle === "scroll" ? "is-scroll" : "is-fixed"}`}>
                        {module.picList.map((pic: any, idx: number) => (
                            <View
                                key={idx}
                                className="image-showcase-item"
                                style={getItemStyle(idx)}
                                onClick={() => {
                                    urlFormat(pic.picLink) && redirect({ url: urlFormat(pic.picLink) });
                                }}
                            >
                                <View className="item-image-box" style={imageBoxStyle}>
                                    {picRatio === "default" ? (
                                        <Image className="item-image" mode="widthFix" src={imageFormat(pic.picUrl)} />
                                    ) : (
                                        <Image className="item-image item-image-ratio" mode={imageMode} src={imageFormat(pic.picUrl)} />
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>
                )}
            </View>
        </View>
    );
}

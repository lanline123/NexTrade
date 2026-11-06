import { useMemo } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import ImageSearchEntry from "@/components/imageSearchEntry";
import { designPxToRpx, formatFrame } from "@/components/modules";
import { t } from "@/utils/i18n";

import "./index.scss";

interface Props {
    module: any;
}

/** 搜索栏模块（自旧 modules/searchBar/index.vue 移植） */
export default function SearchBar({ module }: Props) {
    const frame = module?.frame;
    const frameFormat = useMemo(() => formatFrame(frame), [frame]);
    const allFormat = useMemo(
        () => ({
            itemBackgroundColor: `background-color: ${module?.frame?.itemBackgroundColor};`,
            itemHeight: `height: ${designPxToRpx(module?.frame?.itemHeight)};`,
            itemBorderRadius: `border-radius: ${designPxToRpx(module?.frame?.itemRadius)};`,
            textColor: `color: ${module?.frame?.textColor};`
        }),
        [module]
    );

    const search = () => {
        Taro.navigateTo({
            url: "/pages/search/index"
        }).catch(() => {});
    };

    return (
        <View
            className="module-ad-con module-search_bar"
            style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom}
        >
            <View className="module-ad-content" style={frameFormat.backgroundColor + " " + frameFormat.boxRadius}>
                <View className="searchBar-warp">
                    <View className="searchBar-con">
                        <View className="searchBar-item">
                            <View className="item-content">
                                <View className="item-search-con">
                                    <View
                                        className="item-search-form"
                                        style={allFormat.itemBackgroundColor + allFormat.itemBorderRadius + allFormat.itemHeight + allFormat.textColor}
                                        onClick={search}
                                    >
                                        <View className="iconfont-h5 icon-sousuo" />
                                        <View className="item-search-input">{t(module?.text ?? "")}</View>
                                        <ImageSearchEntry />
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

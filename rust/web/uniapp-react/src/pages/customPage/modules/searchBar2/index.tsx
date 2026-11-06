import { useMemo } from "react";
import { View } from "@tarojs/components";

import ImageSearchEntry from "@/components/imageSearchEntry";
import { designPxToRpx, formatFrame } from "@/components/modules";
import { redirect } from "@/utils";

import "./index.scss";

interface Props {
    module: any;
}

// TODO(B6)：以图搜图可用性判断随图搜子系统迁移（旧版读 store/imageSearch.isAvailable(shopId)）
const hasImageSearch = false;

/** 跨境风搜索栏模块（自旧 modules/searchBar2/index.vue 移植） */
export default function SearchBar2({ module }: Props) {
    const frame = module?.frame;
    const frameFormat = useMemo(() => formatFrame(frame), [frame]);
    const allFormat = useMemo(
        () => ({
            itemBackgroundColor: `background-color: ${module?.frame?.itemBackgroundColor};`,
            itemHeight: `height: ${designPxToRpx(module?.frame?.itemHeight)};`,
            itemBorderRadius: `border-radius: ${designPxToRpx(module?.frame?.itemRadius)};`
        }),
        [module]
    );

    return (
        <View
            className="module-ad-con module-search_bar"
            style={frameFormat.boxPadding + frameFormat.boxPaddingTop + frameFormat.boxPaddingBottom + frameFormat.backgroundColor}
        >
            <View className="module-ad-content" style={allFormat.itemBackgroundColor}>
                <View className="oversea-sousuo-box" onClick={() => redirect({ url: "/pages/search/index" })}>
                    <View className="oversea-sousuo" style={allFormat.itemHeight + allFormat.itemBorderRadius}>
                        {/* 有相机入口时放大镜移到左侧，相机占右侧 */}
                        {hasImageSearch && <View className="iconfont-h5 icon-sousuo2 search-icon-left" />}
                        <View className="placeholder-text">{module?.text}</View>
                        <View className="sousuo-icon">
                            <ImageSearchEntry color="#1a1a1a" flushRight />
                            {!hasImageSearch && <View className="iconfont-h5 icon-sousuo2" />}
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

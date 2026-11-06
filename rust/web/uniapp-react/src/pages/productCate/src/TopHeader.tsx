import { useEffect, useRef } from "react";
import { View, Text, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";

import ImageSearchEntry from "@/components/imageSearchEntry";
import { useConfigStore } from "@/store/config";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./TopHeader.scss";

interface Props {
    /** 搜索框占位文字（来自分类页装修配置） */
    placeholder?: string;
    /** 定位方式：分类页须用 fixed，避免 layout overflow 裁切 sticky */
    position?: "sticky" | "static" | "fixed";
}

/**
 * 分类页海外皮肤头部（自旧 pages/productCate/src/topHeader.vue 移植）
 *
 * TODO(MIGRATION)：旧版把搜索栏放进 mainHeader（overseas 皮肤公共头，596 行）的 navbar 插槽；
 * mainHeader 尚未随 B6 批次移植，这里以固定定位白底条等价承载 slot 内容，
 * 并实测自身高度写入 configStore.commonHeaderHeight（对齐 mainHeader 的占位契约）。
 */
export default function TopHeader({ placeholder = "", position = "fixed" }: Props) {
    const configStoreSetCommonHeaderHeight = useConfigStore((s) => s.setCommonHeaderHeight);
    // TODO(MIGRATION)：旧 useImageSearchStore().available 控制「放大镜移左/搜索图标在右」；
    // 以图搜图子系统未移植，按不可用分支渲染（右侧放大镜图标 + ImageSearchEntry 占位）。
    const imageSearchAvailable = false;

    const headerRef = useRef<HTMLDivElement>(null);
    const measuredRef = useRef(false);

    const placeholderText = (() => {
        const v = (placeholder ?? "").trim();
        return v.length > 0 ? v : t("搜索");
    })();

    // 对齐 mainHeader 的占位契约：实测 common-header 高度供 fixed 二级头部计算偏移
    useEffect(() => {
        if (measuredRef.current) return;
        measuredRef.current = true;
        setTimeout(() => {
            Taro.createSelectorQuery()
                .select(".cate-top-header")
                .boundingClientRect((rect: any) => {
                    if (rect && rect.height) {
                        configStoreSetCommonHeaderHeight(Number(rect.height) || 0);
                    }
                })
                .exec();
        }, 100);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toSearch = () => {
        Taro.navigateTo({
            url: "/pages/search/index"
        });
    };

    const handleIcon = () => {
        if (process.env.TARO_ENV === "h5") {
            history.back();
        } else {
            Taro.navigateBack();
        }
    };

    return (
        <View className="cate-top-header" style={{ position }} ref={headerRef as any}>
            <View className="search-bar-box">
                <View className="iconfont icon-houtui" onClick={handleIcon} />
                <View className="search-input" onClick={toSearch}>
                    {/* 有相机入口时放大镜移到左侧，相机占右侧 */}
                    {imageSearchAvailable && <Text className="iconfont-h5 icon-sousuo2 search-input__icon" />}
                    <Text className="search-input__text">{t(placeholderText)}</Text>
                    <ImageSearchEntry color="#1a1a1a" flushRight />
                </View>
                {!imageSearchAvailable && (
                    <View className="sousuo-icon" onClick={toSearch}>
                        <Image src={staticResource("home/oversea_sousuo.png")} />
                    </View>
                )}
            </View>
        </View>
    );
}

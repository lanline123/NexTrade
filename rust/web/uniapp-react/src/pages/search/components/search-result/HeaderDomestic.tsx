import { useEffect, useMemo, useRef, useState } from "react";
import { ScrollView, Text, View } from "@tarojs/components";

import type { filterSeleted } from "@/types/search/search";
import { t } from "@/utils/i18n";
import ImageSearchEntry from "@/components/imageSearchEntry";

import TagRowDomestic from "./TagRowDomestic";

import "./HeaderDomestic.scss";

/** 搜索框内组合标签参数（与旧组件 HeaderFilterParams 同形；字段覆盖 TagFilterParams 所需的 intro/attrs/min/max） */
export interface HeaderFilterParams {
    keyword?: string;
    sort?: string;
    order?: string;
    min?: string | number;
    max?: string | number;
    cat?: number;
    shopCategoryId?: number | string;
    couponId?: number;
    intro?: string;
    attrs?: { attrName: string; attrValue: string[] }[];
}

interface Props {
    /** 是否显示以图搜图入口；门店名称搜索不显示 */
    showImageSearch?: boolean;
    /** 店铺内搜索时透传给以图搜图 */
    shopId?: number | string;
    keyword?: string;
    filterParams: HeaderFilterParams;
    brandName?: string;
    couponName?: string;
    treeList?: filterSeleted[];
    introList?: Record<string, string>;
    /** 跨境头不带返回时，在搜索框左侧展示返回 */
    showBack?: boolean;
    /** 对应旧 emit("toSearch") */
    onToSearch?: () => void;
    /** 对应旧 emit("back") */
    onBack?: () => void;
    /** 对应旧 emit("delete", type) */
    onDelete?: (type: string) => void;
    /** 对应旧 emit("deleteAttr", index) */
    onDeleteAttr?: (index: number) => void;
    /** 对应旧 emit("deleteCategory", index) */
    onDeleteCategory?: (index: number) => void;
}

/**
 * 国内版搜索结果头（自旧 header-domestic.vue 移植）：
 * 标签 + 关键词一行横滑展示，点击进搜索页；右侧以图搜图入口与「搜索」按钮。
 */
export default function HeaderDomestic({
    showImageSearch = false,
    shopId,
    keyword = "",
    filterParams,
    brandName = "",
    couponName = "",
    treeList = [],
    introList = {},
    showBack = false,
    onToSearch,
    onBack,
    onDelete,
    onDeleteAttr,
    onDeleteCategory
}: Props) {
    const hasVisibleTags = useMemo(() => {
        const fp = filterParams;
        if (fp.intro && introList[fp.intro]) return true;
        if (couponName) return true;
        if (brandName) return true;
        if (fp.attrs?.length) return true;
        if (fp.max || fp.min) return true;
        if (treeList?.length) return true;
        return false;
    }, [filterParams, brandName, couponName, treeList, introList]);

    const [combinedScrollLeft, setCombinedScrollLeft] = useState(0);
    // setTimeout 句柄，避免组件卸载后 setState（对应旧 nextTick 回调）
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const scrollCombinedToEnd = () => {
        setCombinedScrollLeft(0);
        if (scrollTimerRef.current) {
            clearTimeout(scrollTimerRef.current);
        }
        // 对应旧 nextTick(() => { combinedScrollLeft = 99999 })
        scrollTimerRef.current = setTimeout(() => {
            setCombinedScrollLeft(99999);
        }, 0);
    };

    useEffect(() => {
        return () => {
            if (scrollTimerRef.current) {
                clearTimeout(scrollTimerRef.current);
            }
        };
    }, []);

    // 对应旧 watch(keyword) + watch(filterParams 相关字段, { deep: true })
    useEffect(() => {
        scrollCombinedToEnd();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyword]);

    useEffect(() => {
        scrollCombinedToEnd();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        JSON.stringify([
            filterParams.intro,
            filterParams.attrs,
            filterParams.min,
            filterParams.max,
            brandName,
            couponName,
            treeList
        ])
    ]);

    return (
        <View className="header-domestic">
            <View className={`header acea-row row-center-wrapper ${showBack ? "header--with-back" : ""}`}>
                {showBack ? (
                    <View
                        className="product-nav-left product-nav-icon"
                        onClick={() => {
                            onBack?.();
                        }}
                    >
                        <Text className="iconfont-h5 icon-fanhui" />
                    </View>
                ) : null}
                <View className="acea-row row-between-wrapper input input-wrap">
                    <ScrollView
                        className="input-combined-scroll"
                        scrollX
                        enableFlex
                        scrollLeft={combinedScrollLeft}
                        showScrollbar={false}
                        onClick={(e) => {
                            e.stopPropagation();
                            onToSearch?.();
                        }}
                    >
                        <View className="input-combined-inner">
                            <TagRowDomestic
                                filterParams={filterParams}
                                brandName={brandName}
                                couponName={couponName}
                                treeList={treeList}
                                introList={introList}
                                embedded
                                inRow
                                onDelete={(type) => onDelete?.(type)}
                                onDeleteAttr={(index) => onDeleteAttr?.(index)}
                                onDeleteCategory={(index) => onDeleteCategory?.(index)}
                            />
                            {!keyword && !hasVisibleTags ? <View className="txt">{t("请输入搜索内容")}</View> : null}
                            {keyword ? (
                                <View className="keyword-inline">
                                    <Text className="keyword-text">{keyword}</Text>
                                </View>
                            ) : null}
                        </View>
                    </ScrollView>
                    {showImageSearch ? <ImageSearchEntry shopId={typeof shopId === "number" ? shopId : undefined} /> : null}
                    <View
                        className="search-btn"
                        onClick={() => {
                            onToSearch?.();
                        }}
                    >
                        {t("搜索")}
                    </View>
                </View>
            </View>
        </View>
    );
}

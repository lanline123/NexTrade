import { useMemo } from "react";
import { Text, View } from "@tarojs/components";

import type { attrsData, filterSeleted } from "@/types/search/search";
import { t } from "@/utils/i18n";

import "./TagRowDomestic.scss";

/** 搜索框内标签参数（与旧组件 TagFilterParams 同形） */
export interface TagFilterParams {
    intro?: string;
    attrs?: attrsData[];
    max?: string | number | null;
    min?: string | number | null;
}

interface Props {
    filterParams: TagFilterParams;
    brandName?: string;
    couponName?: string;
    treeList?: filterSeleted[];
    introList?: Record<string, string>;
    /** 嵌入搜索框内：透明底、收紧间距 */
    embedded?: boolean;
    /** 与关键词同一行、横向排列不换行 */
    inRow?: boolean;
    /** 对应旧 emit("delete", type) */
    onDelete?: (type: string) => void;
    /** 对应旧 emit("deleteAttr", index) */
    onDeleteAttr?: (index: number) => void;
    /** 对应旧 emit("deleteCategory", index) */
    onDeleteCategory?: (index: number) => void;
}

/**
 * 国内版搜索框内标签行（自旧 tag-row-domestic.vue 移植）：
 * 新品/热销/精品、优惠券、品牌、属性、价格区间、分类路径，点标签删除对应条件。
 */
export default function TagRowDomestic({
    filterParams,
    brandName = "",
    couponName = "",
    treeList = [],
    introList = {},
    embedded = false,
    inRow = false,
    onDelete,
    onDeleteAttr,
    onDeleteCategory
}: Props) {
    const hasVisibleTags = useMemo(() => {
        const fp = filterParams;
        const introKey = fp.intro != null ? String(fp.intro) : "";
        if (introKey && introList[introKey]) return true;
        if (couponName) return true;
        if (brandName) return true;
        if (fp.attrs?.length) return true;
        if (fp.max || fp.min) return true;
        if (treeList.length) return true;
        return false;
    }, [filterParams, brandName, couponName, treeList, introList]);

    if (!hasVisibleTags) {
        // 对应旧根节点 v-if="hasVisibleTags"
        return null;
    }

    return (
        <View className={`tag-row-domestic ${embedded ? "embedded" : ""} ${inRow ? "in-row" : ""}`}>
            <View className="tag-row">
                <View className="tag-list">
                    {filterParams.intro && introList[filterParams.intro] ? (
                        <View
                            className="tag-item mr10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.("intro");
                            }}
                        >
                            <Text>{introList[filterParams.intro]}</Text>
                            <Text className="iconfont-h5 icon-chacha tag-icon" />
                        </View>
                    ) : null}

                    {couponName ? (
                        <View
                            className="tag-item mr10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.("couponInfo");
                            }}
                        >
                            <Text>
                                {t("优惠券")}: {couponName}
                            </Text>
                            <Text className="iconfont-h5 icon-chacha tag-icon" />
                        </View>
                    ) : null}

                    {brandName ? (
                        <View
                            className="tag-item mr10 brand"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.("brand");
                            }}
                        >
                            <Text>{brandName}</Text>
                            <Text className="iconfont-h5 icon-chacha tag-icon" />
                        </View>
                    ) : null}

                    {(filterParams.attrs ?? []).map((item, index) => (
                        <View
                            key={item.attrName}
                            className="tag-item mr10 brand"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteAttr?.(index);
                            }}
                        >
                            <Text>
                                {item.attrName}:{item.attrValue.map((value) => (
                                    <Text key={value}>{value}</Text>
                                ))}
                            </Text>
                            <Text className="iconfont-h5 icon-chacha tag-icon" />
                        </View>
                    ))}

                    {filterParams.max || filterParams.min ? (
                        <View
                            className="tag-item mr10"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete?.("price");
                            }}
                        >
                            <Text>
                                {filterParams.min || 0} - {filterParams.max || 0}
                            </Text>
                            <Text className="iconfont-h5 icon-chacha tag-icon" />
                        </View>
                    ) : null}

                    {/* 分类路径：框内横滑展示整条路径（含当前选中的二级/末级） */}
                    {treeList.map((item, index) => (
                        <View
                            key={index}
                            className="flex align-center"
                            onClick={(e) => {
                                e.stopPropagation();
                                onDeleteCategory?.(index);
                            }}
                        >
                            <View className="tag-item">
                                <Text>{item.categoryName}</Text>
                                <Text className="iconfont-h5 icon-chacha tag-icon" />
                            </View>
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

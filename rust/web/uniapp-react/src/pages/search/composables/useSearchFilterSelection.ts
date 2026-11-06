/**
 * 搜索筛选公共工具 / composables（自旧 pages/search/composables 移植为 React 版）
 * 国内抽屉、海外弹层、品牌/属性面板共用品牌切换与属性多选逻辑。
 * 旧版基于 Vue ref 原地 mutate；React 版改为「传旧数组、返回新数组」的纯函数，
 * 页面用 setState 接住返回值。
 */
import { useCallback, useState } from "react";

import type { Brand, attrsData } from "@/types/search/search";

/** 属性值可能是字符串或 { value, count } 对象 */
export function getAttrOptionText(value: { value?: string } | string): string {
    return typeof value === "string" ? value : value?.value || "";
}

/** 切换品牌 ID 选中态（返回新数组） */
export function toggleBrandId(brandIds: number[], brandId: number): number[] {
    const index = brandIds.indexOf(brandId);
    if (index !== -1) {
        return [...brandIds.slice(0, index), ...brandIds.slice(index + 1)];
    }
    return [...brandIds, brandId];
}

export function isAttrSelected(attrs: attrsData[], attrName: string, value: string): boolean {
    const attr = attrs.find((item) => item.attrName === attrName);
    return attr ? attr.attrValue.includes(value) : false;
}

/** 切换属性值选中态；取消后若该属性无值则移除整项（返回新数组） */
export function toggleAttrValue(attrs: attrsData[], attrName: string, value: string): attrsData[] {
    const attrIndex = attrs.findIndex((item) => item.attrName === attrName);
    if (attrIndex > -1) {
        const valueIndex = attrs[attrIndex].attrValue.indexOf(value);
        if (valueIndex > -1) {
            const nextValue = [...attrs[attrIndex].attrValue.slice(0, valueIndex), ...attrs[attrIndex].attrValue.slice(valueIndex + 1)];
            if (nextValue.length === 0) {
                return [...attrs.slice(0, attrIndex), ...attrs.slice(attrIndex + 1)];
            }
            return attrs.map((item, i) => (i === attrIndex ? { ...item, attrValue: nextValue } : item));
        }
        return attrs.map((item, i) => (i === attrIndex ? { ...item, attrValue: [...item.attrValue, value] } : item));
    }
    return [...attrs, { attrName, attrValue: [value] }];
}

/** 基于 brandIds state 的品牌点击切换（对应旧 useBrandSelection） */
export function useBrandSelection(brandIds: number[], setBrandIds: (next: number[]) => void) {
    const onChangeBrand = useCallback(
        (item: Brand) => {
            setBrandIds(toggleBrandId(brandIds, item.brandId));
        },
        [brandIds, setBrandIds]
    );
    return { onChangeBrand };
}

/** 基于 attrs state 的属性多选（对应旧 useAttrsSelection） */
export function useAttrsSelection(attrs: attrsData[], setAttrs: (next: attrsData[]) => void) {
    const checkSelected = useCallback((attrName: string, value: string) => isAttrSelected(attrs, attrName, value), [attrs]);
    const onAttrClick = useCallback(
        (attrName: string, value: string) => {
            setAttrs(toggleAttrValue(attrs, attrName, value));
        },
        [attrs, setAttrs]
    );
    return {
        isAttrSelected: checkSelected,
        onAttrClick
    };
}

/**
 * 区块展开/收起（品牌、属性分组等）
 * @param defaultExpanded true=未写入时视为展开；false=默认收起
 */
export function useSectionExpand(defaultExpanded = false) {
    const [expandMap, setExpandMap] = useState<Record<string, boolean>>({});

    const isExpanded = useCallback(
        (key: string): boolean => {
            if (expandMap[key] === undefined) {
                return defaultExpanded;
            }
            return expandMap[key];
        },
        [expandMap, defaultExpanded]
    );

    const toggleExpand = useCallback(
        (key: string) => {
            setExpandMap((prev) => ({ ...prev, [key]: !(prev[key] ?? defaultExpanded) }));
        },
        [defaultExpanded]
    );

    const resetExpand = useCallback(
        (keys: string[] = [], expanded = defaultExpanded) => {
            const map: Record<string, boolean> = {};
            keys.forEach((key) => {
                map[key] = expanded;
            });
            setExpandMap(map);
        },
        [defaultExpanded]
    );

    return {
        expandMap,
        isExpanded,
        toggleExpand,
        resetExpand
    };
}

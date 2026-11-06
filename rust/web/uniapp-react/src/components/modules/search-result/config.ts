/**
 * 移动端搜索结果模块 - 默认配置
 *
 * 必须与 Tigshop-Admin `editor/modules/mobileSearch/mobileSearchResult/types.ts`
 * 的 mobileSearchResultDefaults 完全一致，否则后台预览与前台渲染会出现差异。
 */

import type { SearchResultModuleData } from "./types";

export const searchResultDefaults: SearchResultModuleData = {
    searchResultType: 1,
    backgroundColor: "#f5f5f5",
    searchItemBackgroundColor: "#ffffff",
    searchItemPaddingLeftRight: 10,
    itemBackgroundColor: "#ffffff",
    themeColor: "#ff4d4f",
    showShopTag: true,
    showSales: true,
    showCartButton: true,
    showCoupon: true,
    layoutStyle: 1,
    listStyle: 1,
    productTitleColor: "#333333",
    productTitleLine: 2,
    priceColor: "#ff4d4f",
    buyBtnStyle: 1,
    margin: 0,
    padding: 10,
    paddingTopBottom: 10,
    paddingLeftRight: 10,
    moduleRadius: 0,
    productImageRadius: 4,
    storeShowRating: 1,
    storeShowMinOrder: 1,
    storeShowDeliveryFee: 1,
    storeShowDistance: 1,
    storeShowFollow: 1,
    storeShowProductName: 1,
    storeProductNameRow: 1,
    storeShowProductPrice: 1,
    storeProductGap: 8,
    storeGap: 10,
    storePaddingTopBottom: 12,
    storePaddingLeftRight: 12,
    storeCardRadius: 8,
    storeLogoRadius: 50,
    storeShopTitleColor: "#1a1a1a",
    storeShopTitleFontSize: 15,
    storeShopTitleFontBold: 700
};

/** 兼容后端历史字符串布尔（"true"/"false"/"1"/"0"）与真实 boolean/number */
const toBool = (v: unknown, fallback: boolean): boolean => {
    if (v === undefined || v === null || v === "") return fallback;
    if (typeof v === "boolean") return v;
    if (typeof v === "number") return v !== 0;
    if (typeof v === "string") {
        const s = v.trim().toLowerCase();
        if (s === "true" || s === "1") return true;
        if (s === "false" || s === "0") return false;
    }
    return fallback;
};

/** 兼容后端历史数字字符串（"1"）与真实 number */
const toNum = (v: unknown, fallback: number): number => {
    if (v === undefined || v === null || v === "") return fallback;
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : fallback;
};

/**
 * 合并后端配置与默认值，并把布尔/数字字段归一化成真实类型。
 * C 端 getDecorateModule 曾对 JSON 做 convertKeysToCamelCase + asText，标量会变成字符串；
 * 即便后端已修，仍需兜底历史脏数据与未发版环境。
 */
export const mergeConfig = (data?: Partial<SearchResultModuleData> | null): SearchResultModuleData => {
    const raw = (data ?? {}) as Record<string, unknown>;
    return {
        ...searchResultDefaults,
        ...raw,
        showShopTag: toBool(raw.showShopTag, searchResultDefaults.showShopTag!),
        showSales: toBool(raw.showSales, searchResultDefaults.showSales!),
        showCartButton: toBool(raw.showCartButton, searchResultDefaults.showCartButton!),
        showCoupon: toBool(raw.showCoupon, searchResultDefaults.showCoupon!),
        layoutStyle: toNum(raw.layoutStyle, searchResultDefaults.layoutStyle!) as 1 | 2,
        listStyle: toNum(raw.listStyle, searchResultDefaults.listStyle!) as 1 | 2,
        productTitleLine: toNum(raw.productTitleLine, searchResultDefaults.productTitleLine!) as 1 | 2,
        buyBtnStyle: toNum(raw.buyBtnStyle, searchResultDefaults.buyBtnStyle!),
        searchItemPaddingLeftRight: toNum(raw.searchItemPaddingLeftRight, searchResultDefaults.searchItemPaddingLeftRight!),
        margin: toNum(raw.margin, searchResultDefaults.margin!),
        padding: toNum(raw.padding, searchResultDefaults.padding!),
        paddingTopBottom: toNum(raw.paddingTopBottom, toNum(raw.padding, searchResultDefaults.paddingTopBottom!)),
        paddingLeftRight: toNum(raw.paddingLeftRight, toNum(raw.padding, searchResultDefaults.paddingLeftRight!)),
        moduleRadius: toNum(raw.moduleRadius, searchResultDefaults.moduleRadius!),
        productImageRadius: toNum(raw.productImageRadius, searchResultDefaults.productImageRadius!),
        searchResultType: toNum(raw.searchResultType, searchResultDefaults.searchResultType!) as 1 | 2,
        storeShowRating: toNum(raw.storeShowRating, searchResultDefaults.storeShowRating!),
        storeShowMinOrder: toNum(raw.storeShowMinOrder, searchResultDefaults.storeShowMinOrder!),
        storeShowDeliveryFee: toNum(raw.storeShowDeliveryFee, searchResultDefaults.storeShowDeliveryFee!),
        storeShowDistance: toNum(raw.storeShowDistance, searchResultDefaults.storeShowDistance!),
        storeShowFollow: toNum(raw.storeShowFollow, searchResultDefaults.storeShowFollow!),
        storeShowProductName: toNum(raw.storeShowProductName, searchResultDefaults.storeShowProductName!),
        storeProductNameRow: toNum(raw.storeProductNameRow, searchResultDefaults.storeProductNameRow!) as 1 | 2,
        storeShowProductPrice: toNum(raw.storeShowProductPrice, searchResultDefaults.storeShowProductPrice!),
        storeProductGap: toNum(raw.storeProductGap, searchResultDefaults.storeProductGap!),
        storeGap: toNum(raw.storeGap, searchResultDefaults.storeGap!),
        storePaddingTopBottom: toNum(raw.storePaddingTopBottom, searchResultDefaults.storePaddingTopBottom!),
        storePaddingLeftRight: toNum(raw.storePaddingLeftRight, searchResultDefaults.storePaddingLeftRight!),
        storeCardRadius: toNum(raw.storeCardRadius, searchResultDefaults.storeCardRadius!),
        storeLogoRadius: toNum(raw.storeLogoRadius, searchResultDefaults.storeLogoRadius!),
        storeShopTitleFontSize: toNum(raw.storeShopTitleFontSize, searchResultDefaults.storeShopTitleFontSize!),
        storeShopTitleFontBold: toNum(raw.storeShopTitleFontBold, searchResultDefaults.storeShopTitleFontBold!)
    };
};

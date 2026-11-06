/**
 * 分类中心V2模块 - 默认配置
 * 默认值与后台 mobileCateCenter/cateCenterV2 Edit.vue 中的 defaultModule 保持一致
 * 自旧 components/modules/cate-center/cate-center-v2/config.ts 原样移植
 */

import { t } from "@/utils/i18n";
import type { CateCenterV2Data } from "./types";

/** V2 模块默认值 */
export const cateCenterV2Defaults: CateCenterV2Data = {
    searchPlaceholder: t("搜索商品"),
    styleType: 2,
    subTabStyle: 1,
    textAlign: 1,
    textWeight: 1,
    goodsNameRow: 2,
    showName: 1,
    buyBtnStyle: 1,
    // 颜色一律留空：空串表示跟随主题色 / 原默认色，保证老数据视觉零变化
    themeColor: "",
    sideBgColor: "",
    sideTextColor: "",
    sideActiveTextColor: "",
    sideActiveBgColor: "",
    sideIndicatorColor: "",
    subTabTextColor: "",
    subTabBgColor: "",
    subTabActiveTextColor: "",
    subTabActiveBgColor: "",
    goodsListBgColor: "",
    productTitleColor: "",
    priceColor: "",
    buyBtnColor: ""
};

/** 颜色字段 → CSS 变量名 */
const COLOR_VARS: Array<[keyof CateCenterV2Data, string]> = [
    ["themeColor", "--cate-theme"],
    ["sideBgColor", "--cate-side-bg"],
    ["sideTextColor", "--cate-side-text"],
    ["sideActiveTextColor", "--cate-side-active-text"],
    ["sideActiveBgColor", "--cate-side-active-bg"],
    ["sideIndicatorColor", "--cate-side-indicator"],
    ["subTabTextColor", "--cate-subtab-text"],
    ["subTabBgColor", "--cate-subtab-bg"],
    ["subTabActiveTextColor", "--cate-subtab-active-text"],
    ["subTabActiveBgColor", "--cate-subtab-active-bg"],
    ["goodsListBgColor", "--cate-goods-bg"],
    ["productTitleColor", "--cate-title"],
    ["priceColor", "--cate-price"],
    ["buyBtnColor", "--cate-buy-btn"]
];

/**
 * 装修颜色 → CSS 变量：只下发配置过的字段，未配置的走样式里的 fallback（主题色或原硬编码值）
 */
export const buildCateCenterV2Vars = (config: CateCenterV2Data): Record<string, string> => {
    const vars: Record<string, string> = {};
    COLOR_VARS.forEach(([field, name]) => {
        const value = config[field];
        if (value) vars[name] = String(value);
    });
    return vars;
};

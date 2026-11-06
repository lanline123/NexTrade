/**
 * 分类中心V1模块 - 默认配置
 * 默认值与后台 mobileCateCenter/cateCenterV1 Edit.vue 中的 defaultModule 保持一致
 * 自旧 components/modules/cate-center/cate-center-v1/config.ts 原样移植
 */

import { t } from "@/utils/i18n";
import type { CateCenterV1Data } from "./types";

/** V1 模块默认值 */
export const cateCenterV1Defaults: CateCenterV1Data = {
    searchPlaceholder: t("点击搜索商品信息"),
    showCategoryName: true,
    showRecommend: true,
    recommendText: t("推荐"),
    // 颜色一律留空：空串表示跟随主题色 / 原默认色，保证老数据视觉零变化
    themeColor: "",
    sideBgColor: "",
    sideTextColor: "",
    sideActiveTextColor: "",
    sideActiveBgColor: "",
    groupTitleColor: "",
    categoryNameColor: ""
};

/** 颜色字段 → CSS 变量名 */
const COLOR_VARS: Array<[keyof CateCenterV1Data, string]> = [
    ["themeColor", "--cate-theme"],
    ["sideBgColor", "--cate-side-bg"],
    ["sideTextColor", "--cate-side-text"],
    ["sideActiveTextColor", "--cate-side-active-text"],
    ["sideActiveBgColor", "--cate-side-active-bg"],
    ["groupTitleColor", "--cate-group-title"],
    ["categoryNameColor", "--cate-name"]
];

/**
 * 装修颜色 → CSS 变量：只下发配置过的字段，未配置的走样式里的 fallback（主题色或原硬编码值）
 */
export const buildCateCenterV1Vars = (config: CateCenterV1Data): Record<string, string> => {
    const vars: Record<string, string> = {};
    COLOR_VARS.forEach(([field, name]) => {
        const value = config[field];
        if (value) vars[name] = String(value);
    });
    return vars;
};

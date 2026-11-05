/**
 * 装修编辑器口径常量（与 view/admin editor/config/constants.ts 逐字段一致）
 */

/** 装修类型 */
export const DecorateType = {
    /** 移动端 */
    MOBILE: 1,
    /** PC 首页 */
    PC_HOME: 2,
    /** PC 自定义页 */
    PC_CUSTOM: 3
} as const;

export type DecorateTypeValue = (typeof DecorateType)[keyof typeof DecorateType];

/** 移动端页面类型 */
export const PageType = {
    /** 首页 */
    HOME: 1,
    /** 会员中心 */
    MEMBER: 2,
    /** 分类中心 */
    CATE_CENTER: 4,
    /** 登录页 */
    LOGIN: 5,
    /** 搜索页 */
    SEARCH: 6,
    /** 商品详情页 */
    PRODUCT_DETAIL: 8
} as const;

export type PageTypeValue = (typeof PageType)[keyof typeof PageType];

/** 模块分类目录（= 旧架构 url 六类） */
export type ModuleUrl =
    | "mobile"
    | "mobilePro"
    | "mobilePromotion"
    | "mobileMember"
    | "mobileCateCenter"
    | "mobileProductDetail"
    | "mobileLogin"
    | "mobileSearch";

/** 工具栏分组（对应 view/admin ToolBar 的 collapse 分区） */
export type ToolbarGroup = "basic" | "other" | "live" | "advanced" | "member" | "cateCenter" | "productDetail" | "searchResult" | "loginConfig";

/** 页面上下文规则：key = `${decorateType}-${pageType}`，对应旧 ToolBar 的硬编码面板 */
interface PageContextRule {
    allowedGroups: ToolbarGroup[];
}

const PAGE_CONTEXT_RULES: Record<string, PageContextRule> = {
    "1-1": { allowedGroups: ["basic", "other", "live", "advanced"] },
    "1-2": { allowedGroups: ["member"] },
    "1-3": { allowedGroups: ["basic", "other", "live"] },
    "1-4": { allowedGroups: ["cateCenter"] },
    "1-8": { allowedGroups: ["productDetail"] },
    "1-5": { allowedGroups: ["loginConfig"] },
    "1-6": { allowedGroups: ["searchResult"] }
};

const DEFAULT_RULE: PageContextRule = { allowedGroups: ["basic", "other"] };

export function resolveContextRule(decorateType: DecorateTypeValue, pageType: number): PageContextRule {
    const rule = PAGE_CONTEXT_RULES[`${decorateType}-${pageType}`];
    if (rule) return rule;
    if (decorateType !== DecorateType.MOBILE) return DEFAULT_RULE;
    return DEFAULT_RULE;
}

/** 获取模块的工具栏分组（优先 toolbarGroup，否则按 url 映射） */
export function getModuleToolbarGroup(url: string, toolbarGroup?: ToolbarGroup): ToolbarGroup {
    if (toolbarGroup) return toolbarGroup;
    switch (url) {
        case "mobile":
            return "basic";
        case "mobilePromotion":
            return "other";
        case "mobilePro":
            return "advanced";
        case "mobileMember":
            return "member";
        case "mobileCateCenter":
            return "cateCenter";
        case "mobileProductDetail":
            return "productDetail";
        case "mobileLogin":
            return "loginConfig";
        case "mobileSearch":
            return "searchResult";
        default:
            return "basic";
    }
}

/** 获取当前上下文可用的工具栏分组 */
export function getAvailableToolbarGroups(decorateType: DecorateTypeValue, pageType: number): ToolbarGroup[] {
    return resolveContextRule(decorateType, pageType).allowedGroups;
}

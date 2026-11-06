import { useMemo } from "react";
import { isOverseas } from "@/utils";

/** 商品详情呈现风格（与后台装修 A1 / A2 / A3 保持一致） */
export type ProductStyle = "A1" | "A2" | "A3";

export interface UseProductStyleOptions {
    /**
     * 后台装修配置的商详风格字段（与 Tigshop-Admin 对齐后传入）
     * 未配置时为空，按模块 type / 运行环境兜底
     * （对应旧 Ref<ProductStyle | string | undefined>，React 下直接传值）
     */
    decorateStyle?: ProductStyle | string | undefined;
    /**
     * 装修模块 type：productDetailA1 / A2 / A3
     * decorateStyle 缺失时用于反推风格
     */
    moduleType?: string | undefined;
}

export interface UseProductStyleReturn {
    /** 当前商详风格 */
    productStyle: ProductStyle;
    /** 是否 vortmall 标准风 */
    isVortmallStyle: boolean;
    /** 是否 o2o 门店风 */
    isO2oStyle: boolean;
    /** 是否 overseas 卡片风 */
    isOverseasStyle: boolean;
}

/** 模块 type → 后台风格值映射（接口未回 decorateStyle 时用 type 反推） */
const MODULE_TYPE_STYLE_MAP: Record<string, ProductStyle> = {
    productDetailA1: "A1",
    productDetailA2: "A2",
    productDetailA3: "A3"
};

/**
 * 商品详情风格决策 Hook（自 uniapp pages/product/composables/useProductStyle.ts 移植）
 *
 * @description 统一商详三风格（A1 / A2 / A3）的选择入口：
 * 1. 优先读后台装修配置指定的风格（decorateStyle）；
 * 2. 其次用模块 type 反推（productDetailA1/A2/A3）；
 * 3. 再无配置时按运行环境兜底——跨境走 A3，其余走 A2 门店风（默认基座）。
 * 平台差异（条件编译）与风格维度正交，不在此处理。
 */
export function useProductStyle(options: UseProductStyleOptions = {}): UseProductStyleReturn {
    const { decorateStyle = undefined, moduleType = undefined } = options;

    const productStyle = useMemo<ProductStyle>(() => {
        // H5 本地预览可通过 uiStyle=A1/A2/A3 切换，不改后台装修配置（对应旧 #ifdef H5）
        if (process.env.NODE_ENV !== "production" && process.env.TARO_ENV === "h5" && typeof window !== "undefined") {
            const previewStyle = new URLSearchParams(window.location.search).get("uiStyle");
            if (previewStyle === "A1" || previewStyle === "A2" || previewStyle === "A3") {
                return previewStyle;
            }
        }
        const configured = decorateStyle;
        if (configured === "A1" || configured === "A2" || configured === "A3") {
            return configured;
        }
        const fromType = moduleType ? MODULE_TYPE_STYLE_MAP[moduleType] : undefined;
        if (fromType) return fromType;
        if (isOverseas()) return "A3";
        return "A2";
    }, [decorateStyle, moduleType]);

    const isVortmallStyle = productStyle === "A1";
    const isO2oStyle = productStyle === "A2";
    const isOverseasStyle = productStyle === "A3";

    return {
        productStyle,
        isVortmallStyle,
        isO2oStyle,
        isOverseasStyle
    };
}

export default useProductStyle;

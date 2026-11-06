import type { CSSProperties } from "react";

/**
 * 装修模块通用 frame 字段（自旧 utils/decorateFrame.ts 移植）
 * 单位均为 px（前端使用时 ×2 转 rpx）
 */
export interface FrameConfig {
    backgroundColor?: string;
    boxRadius?: number;
    innerPadding?: number;
    boxPadding?: number;
    boxPaddingTop?: number;
    boxPaddingBottom?: number;
    [key: string]: any;
}

/** 子模块 props.data 中可能包含的 frame */
export interface ModuleDataWithFrame {
    frame?: FrameConfig;
    /** 兼容历史协议字段 */
    moduleStyle?: Record<string, any>;
    [key: string]: any;
}

interface FrameDefaults {
    backgroundColor?: string;
    boxRadius?: number;
    innerPadding?: number;
    boxPadding?: number;
    boxPaddingTop?: number;
    boxPaddingBottom?: number;
}

/** px → rpx（装修边距统一口径：Admin 存 px，前端 ×2 转 rpx） */
export const px2rpx = (px: number) => `${px * 2}rpx`;

/** 宽松转数字：空/非法回退 fallback（传 NaN 可用于"取不到就跳过"场景） */
export const toNumber = (val: any, fallback: number): number => {
    if (val === undefined || val === null || val === "") return fallback;
    const n = typeof val === "number" ? val : parseFloat(String(val));
    return Number.isFinite(n) ? n : fallback;
};

/** 兼容性字段读取：优先 frame，回退 moduleStyle 历史字段 */
const readFrame = (data: ModuleDataWithFrame | undefined): FrameConfig => {
    const frame = (data?.frame || {}) as FrameConfig;
    const legacy = (data?.moduleStyle || {}) as Record<string, any>;
    return {
        backgroundColor: frame.backgroundColor ?? legacy.backgroundColor,
        boxRadius: frame.boxRadius ?? legacy.borderRadius,
        innerPadding: frame.innerPadding ?? legacy.padding,
        boxPadding: frame.boxPadding ?? legacy.marginX,
        boxPaddingTop: frame.boxPaddingTop ?? legacy.marginTop,
        boxPaddingBottom: frame.boxPaddingBottom ?? legacy.marginBottom
    };
};

/**
 * 把 frame 字段转成 CSS 变量对象，供 style 使用
 * （命名沿用旧 composable 的 useFrameVars，实际是纯函数）
 *
 * 输出变量：
 *   --dec-bg-color
 *   --dec-border-radius
 *   --dec-inner-padding
 *   --dec-box-padding
 *   --dec-box-padding-top
 *   --dec-box-padding-bottom
 */
export const useFrameVars = (data: ModuleDataWithFrame | undefined, defaults: FrameDefaults = {}): CSSProperties => {
    const frame = readFrame(data);
    const bgColor = frame.backgroundColor || defaults.backgroundColor || "transparent";
    const radius = toNumber(frame.boxRadius, defaults.boxRadius ?? 0);
    const inner = toNumber(frame.innerPadding, defaults.innerPadding ?? 0);
    const boxPad = toNumber(frame.boxPadding, defaults.boxPadding ?? 0);
    const boxPadTop = toNumber(frame.boxPaddingTop, defaults.boxPaddingTop ?? 0);
    const boxPadBottom = toNumber(frame.boxPaddingBottom, defaults.boxPaddingBottom ?? 0);

    return {
        "--dec-bg-color": bgColor,
        "--dec-border-radius": px2rpx(radius),
        "--dec-inner-padding": px2rpx(inner),
        "--dec-box-padding": px2rpx(boxPad),
        "--dec-box-padding-top": px2rpx(boxPadTop),
        "--dec-box-padding-bottom": px2rpx(boxPadBottom)
    } as CSSProperties;
};

/** 读取已规范化后的 frame（数字字段保留原始数值，便于在脚本中判断） */
export const useFrame = (data: ModuleDataWithFrame | undefined, defaults: FrameDefaults = {}): Required<FrameDefaults> & { backgroundColor: string } => {
    const frame = readFrame(data);
    return {
        backgroundColor: frame.backgroundColor || defaults.backgroundColor || "",
        boxRadius: toNumber(frame.boxRadius, defaults.boxRadius ?? 0),
        innerPadding: toNumber(frame.innerPadding, defaults.innerPadding ?? 0),
        boxPadding: toNumber(frame.boxPadding, defaults.boxPadding ?? 0),
        boxPaddingTop: toNumber(frame.boxPaddingTop, defaults.boxPaddingTop ?? 0),
        boxPaddingBottom: toNumber(frame.boxPaddingBottom, defaults.boxPaddingBottom ?? 0)
    };
};
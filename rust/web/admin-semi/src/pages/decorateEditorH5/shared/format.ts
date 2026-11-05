/**
 * 预览图片/链接格式化（对齐 view/admin utils/format 的 editor 侧用法）
 *
 * 与 admin-semi decoratePc 预览的差异：storageUrl 可由编辑器页加载时注入
 * （setting/config/getAdmin 下发的云存储 URL），相对路径图片仍可正确回显。
 */
import type React from "react";

interface PicSource {
    picUrl?: string;
    picThumb?: string;
    picLarge?: string;
}

let storageUrl = "";

export function setStorageUrl(url: string) {
    storageUrl = url || "";
}

export function getStorageUrl(): string {
    return storageUrl;
}

export function imageFormat(path: string | undefined): string {
    if (!path) return "";
    if (path.includes("http")) return path;
    return storageUrl + path;
}

/** 按 picUrl > picThumb > picLarge 取图，不拼接域名 */
export function pickPic(source: PicSource | null | undefined): string {
    return source?.picUrl || source?.picThumb || source?.picLarge || "";
}

export function productImage(source: PicSource | null | undefined): string {
    return imageFormat(pickPic(source));
}

/** 价格格式化（保留两位小数，与 formatPrice 行为一致） */
export function priceFormat(price: string | number | undefined | null): string {
    if (price === undefined || price === null || price === "") return "";
    const num = Number(price);
    if (Number.isNaN(num)) return String(price);
    return num.toFixed(2);
}

/**
 * 把 Vue 版预览使用的 "k:v;k:v;" 样式串转换为 React CSSProperties。
 * 保持与 view/admin 预览完全相同的样式表达式，避免逐条改写出错。
 */
export function cssText(...parts: Array<string | undefined | false | null>): React.CSSProperties {
    const out: Record<string, string> = {};
    for (const part of parts) {
        if (!part) continue;
        for (const decl of part.split(";")) {
            const idx = decl.indexOf(":");
            if (idx === -1) continue;
            const key = decl.slice(0, idx).trim();
            const value = decl.slice(idx + 1).trim();
            if (!key || !value) continue;
            // kebab-case -> camelCase
            const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
            out[camel] = value;
        }
    }
    return out as React.CSSProperties;
}

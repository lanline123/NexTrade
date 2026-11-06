import { useCallback, useEffect, useRef, useState } from "react";

import { batchActiveStyle } from "@/api/product/productStyle";
import type { ProductActiveStyleVO } from "@/types/product/productStyle";

/**
 * 商品样式（边框/活动背景）hook（自旧 useProductStyle.ts composable 移植）
 * 监听商品列表变化，自动批量获取商品生效样式并合并到 styleMap
 */
export function useProductStyle(productList: any[]) {
    const [styleMap, setStyleMap] = useState<Record<number, ProductActiveStyleVO>>({});
    const lastFetchedKeyRef = useRef("");

    const fetchStyles = useCallback(async (products: any[]) => {
        if (!products || products.length === 0) return;
        const ids = products
            .map((p: any) => p.productId || p.id)
            .filter(Boolean)
            .join(",");
        if (!ids) return;
        try {
            const result = await batchActiveStyle(ids);
            if (result && typeof result === "object") {
                setStyleMap((prev) => ({ ...prev, ...result }));
            }
        } catch {
            // 样式获取失败不影响主流程
        }
    }, []);

    useEffect(() => {
        if (!productList || productList.length === 0) {
            setStyleMap({});
            lastFetchedKeyRef.current = "";
            return;
        }
        const ids = productList
            .map((p: any) => p.productId || p.id)
            .filter(Boolean)
            .join(",");
        if (!ids) {
            setStyleMap({});
            lastFetchedKeyRef.current = "";
            return;
        }
        if (ids !== lastFetchedKeyRef.current) {
            setStyleMap({});
            lastFetchedKeyRef.current = ids;
            void fetchStyles(productList);
        }
    }, [productList, fetchStyles]);

    const resetStyles = useCallback(() => {
        setStyleMap({});
        lastFetchedKeyRef.current = "";
    }, []);

    return { styleMap, fetchStyles, resetStyles };
}

export default useProductStyle;

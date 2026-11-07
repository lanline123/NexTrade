/**
 * 装修预览商品列表 hook（与 view/admin product/Preview.vue _getproductList 语义一致）
 *
 * productSelectType: 1 指定商品(ids) / 2 按分类(categoryId+size) / 3 按标签(introType+size)。
 * 未配置来源时不请求接口、不渲染列表（与 PcProductPreview useProductList 一致）。
 */
import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../../../api";

export interface DecorateProductItem {
    productId?: number;
    productName?: string;
    productBrief?: string;
    productPrice?: number | string;
    picUrl?: string;
    picThumb?: string;
    [key: string]: any;
}

const sortRecordsByIds = (
    records: DecorateProductItem[],
    ids: Array<string | number>,
): DecorateProductItem[] => {
    const order = ids.map((v) => String(v));
    if (order.length === 0) return records;
    const map = new Map<string, DecorateProductItem>();
    records.forEach((r) => map.set(String(r.productId ?? r.id ?? ''), r));
    const sorted: DecorateProductItem[] = [];
    order.forEach((id) => {
        const hit = map.get(id);
        if (hit) sorted.push(hit);
    });
    records.forEach((r) => {
        const key = String(r.productId ?? r.id ?? '');
        if (key && !order.includes(key)) sorted.push(r);
    });
    return sorted;
};

export function useDecorateProductList(products: Record<string, any> | undefined | null): DecorateProductItem[] {
    const [productList, setProductList] = useState<DecorateProductItem[]>([]);
    const productsKey = useMemo(() => JSON.stringify(products ?? null), [products]);

    useEffect(() => {
        let alive = true;
        const run = async () => {
            if (!products) {
                if (alive) setProductList([]);
                return;
            }
            const param: Record<string, any> = {};
            const type = Number(products.productSelectType || 0);
            if (!type) {
                if (alive) setProductList([]);
                return;
            }
            if (type === 1 && (!products.productIds || products.productIds.length === 0)) {
                if (alive) setProductList([]);
                return;
            }
            if (type === 2 && (products.productCategoryId === undefined || products.productCategoryId === null || products.productCategoryId === '')) {
                if (alive) setProductList([]);
                return;
            }
            if (type === 3 && (!products.productTag || String(products.productTag).trim() === '')) {
                if (alive) setProductList([]);
                return;
            }
            if (type === 1) {
                const idArr = Array.isArray(products.productIds)
                    ? products.productIds
                    : String(products.productIds).split(',').filter(Boolean);
                param.ids = idArr.join(',');
                param.size = idArr.length || 15;
            } else {
                param.page = 1;
                if (type === 2) {
                    param.categoryId = products.productCategoryId;
                } else {
                    param.introType = products.productTag;
                }
                param.size = products.productNumber ?? 15;
            }
            try {
                const result = await apiGet<{ records?: DecorateProductItem[]; list?: DecorateProductItem[] }>(
                    '/product/product/list',
                    { productStatus: 1, checkStatus: 1, ...param },
                );
                if (!alive) return;
                const records = (result.records || result.list || []) as DecorateProductItem[];
                if (Number(products.productSelectType) === 1 && Array.isArray(products.productIds)) {
                    setProductList(sortRecordsByIds(records, products.productIds));
                } else {
                    setProductList(records);
                }
            } catch {
                if (alive) setProductList([]);
            }
        };
        void run();
        return () => {
            alive = false;
        };
    }, [productsKey]);

    return productList;
}

/**
 * 商品分享链接工具（自旧 uniapp src/utils/productShare.ts 移植）
 */

/** O2O 门店参数解析（当前与 uniapp 版一致：恒不解析，保留扩展位） */
export const resolveProductShopId = (value: unknown, o2o: boolean): number | undefined => {
    return undefined;
};

/** 使用已解析的门店替换链接中的旧店铺参数，保留其他参数及锚点。 */
export const normalizeProductShareUrl = (url: string, shopId?: number): string => {
    if (!url) return url;
    const hashIndex = url.indexOf("#");
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : "";
    const main = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
    const queryIndex = main.indexOf("?");
    const path = queryIndex >= 0 ? main.slice(0, queryIndex) : main;
    const params = queryIndex >= 0 ? main.slice(queryIndex + 1).split("&").filter(Boolean) : [];
    const remaining = params.filter((param) => decodeURIComponent(param.split("=")[0]) !== "shopId");
    if (shopId !== undefined) remaining.push(`shopId=${shopId}`);
    return `${path}${remaining.length ? `?${remaining.join("&")}` : ""}${hash}`;
};

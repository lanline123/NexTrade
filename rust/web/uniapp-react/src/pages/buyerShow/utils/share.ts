/**
 * 买家秀分享链接构建
 *
 * H5 下当前地址栏可能带着预览态、入口来源等参数，直接拿 location.href 去分享会把这些参数一起扩散出去，
 * 因此统一丢弃原有查询串，只按白名单重建定位买家秀所必需的参数。
 */

const BUYER_SHOW_DETAIL_PATH = "/pages/buyerShow/buyerShowDetail";

/**
 * hash 路由模式下页面路径与参数都在 hash 里，同样只保留白名单参数
 */
function buildHash(hash: string, query: Record<string, string>): string {
    const path = hash.slice(1).split("?")[0];
    const search = new URLSearchParams(query).toString();
    return search ? `#${path}?${search}` : `#${path}`;
}

/**
 * 构建买家秀详情页分享链接
 * @param buyerShowId 买家秀 id
 * @param h5Domain 非 H5 端拼接分享链接用的 H5 域名
 * @returns 分享链接，非 H5 端未配置域名时返回空串
 */
export function buildBuyerShowShareUrl(buyerShowId: string | number, h5Domain = ""): string {
    // 白名单：分享链接只携带买家秀 id
    const query: Record<string, string> = { buyerShowId: String(buyerShowId) };

    if (process.env.TARO_ENV === "h5") {
        try {
            const current = new URL(window.location.href);
            const url = new URL(current.origin + current.pathname);
            if (current.hash) {
                url.hash = buildHash(current.hash, query);
            } else {
                Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
            }
            return url.toString();
        } catch (error) {
            console.error(error);
            return `${BUYER_SHOW_DETAIL_PATH}?buyerShowId=${buyerShowId}`;
        }
    }

    if (!h5Domain) return "";
    try {
        const url = new URL(`${h5Domain}${BUYER_SHOW_DETAIL_PATH}`);
        Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value));
        return url.toString();
    } catch (error) {
        console.error(error);
        return `${h5Domain}${BUYER_SHOW_DETAIL_PATH}?buyerShowId=${buyerShowId}`;
    }
}
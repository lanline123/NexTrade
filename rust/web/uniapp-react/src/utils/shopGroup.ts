/** 页面参数可能保留一层 URI 编码，只解码一次，避免破坏标题中的百分号。 */
export function decodeGroupQuery(value: unknown): string {
    const text = String(value ?? "");
    try {
        return decodeURIComponent(text);
    } catch {
        return text;
    }
}

/** 保留显式的分组参数，非法参数不能退回全量列表。 */
export function groupListParams(query: Record<string, any>, shopType: 1 | 2) {
    if (Object.prototype.hasOwnProperty.call(query, "groupIds")) {
        return { groupIds: decodeGroupQuery(query.groupIds), shopType };
    }
    if (Object.prototype.hasOwnProperty.call(query, "groupId")) {
        return { groupId: decodeGroupQuery(query.groupId), shopType };
    }
    return { shopType };
}

export function validGroupParams(params: Record<string, any>) {
    const value = params.groupIds ?? params.groupId;
    if (value === undefined) return true;
    return (
        /^\d+(,\d+)*$/.test(value) &&
        String(value)
            .split(",")
            .every((id) => Number(id) > 0 && Number(id) <= 2147483647)
    );
}

/** 链接只带分组 id，页面标题进入后由分组详情填充。 */
export function groupLinkUrl(link: Record<string, any>): string {
    const value = link.groupIds ?? link.data?.groupIds ?? link.id ?? link.data?.id;
    const groupIds = Array.isArray(value) ? value.join(",") : String(value ?? "");
    if (!validGroupParams({ groupIds })) return "";
    const path = link.path === "storeGroup" ? "/pages/storeList/list" : "/pages/shop/list";
    return `${path}?groupIds=${encodeURIComponent([...new Set(groupIds.split(",").map(Number))].join(","))}`;
}

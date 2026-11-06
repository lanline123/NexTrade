/** 规范商品详情及关联查询的门店参数。 */
export const normalizeProductQuery = <T extends object>(input: T, o2o: boolean): T => {
    const params = { ...input };
    delete (params as Record<string, unknown>).shopId;
    delete (params as Record<string, unknown>).nearestShopId;
    return params;
};

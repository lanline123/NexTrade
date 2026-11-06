import { useRegionStore } from "@/store/region";

export type SortValue = "default" | "sale" | "time" | "price";
// 只有价格分升降序；上新固定降序，默认和销量不传方向
export type SortOrder = "asc" | "desc" | "";

export interface SortState {
    sort: SortValue;
    order: SortOrder;
}

/**
 * 点击排序项后的下一个状态；返回 null 表示无需重新请求
 * 价格首次升序、再点切换降序；默认、销量、上新重复点击不变
 */
export function nextSortState(current: SortState, value: SortValue): SortState | null {
    if (value !== "price") return current.sort === value ? null : { sort: value, order: value === "time" ? "desc" : "" };
    return { sort: "price", order: current.sort === "price" && current.order === "asc" ? "desc" : "asc" };
}

/**
 * 只让最后一次请求的结果生效：旧请求的响应不再返回给调用方
 * 用于切换排序、清空关键词、关闭搜索层后，迟到的响应不覆盖当前列表
 */
export function latestOnly<P, R>(api: (params: P) => Promise<R>) {
    let seq = 0;
    return {
        request: (params: P) => {
            const id = ++seq;
            return new Promise<R>((resolve, reject) => {
                api(params).then(
                    (res) => id === seq && resolve(res),
                    (err) => id === seq && reject(err)
                );
            });
        },
        invalidate: () => {
            seq++;
        }
    };
}

/** 与商品搜索结果页一致：只有定位有效时才带经纬度 */
export function getLocationParams(): { longitude?: number; latitude?: number } {
    // TODO(MIGRATION)：store/region 仍为 stub，currentLocationInfo 随 region 全量迁移补全；
    // 当前取不到时按无定位处理（不传经纬度），与旧版「定位无效不传」一致。
    const info = (useRegionStore.getState() as any)?.currentLocationInfo;
    const longitude = Number(info?.longitude);
    const latitude = Number(info?.latitude);
    const valid =
        Number.isFinite(longitude) &&
        Number.isFinite(latitude) &&
        Math.abs(longitude) <= 180 &&
        Math.abs(latitude) <= 90 &&
        (longitude !== 0 || latitude !== 0);
    return valid ? { longitude, latitude } : {};
}

/** 图搜结果已生效的筛选条件 */
export interface ImageFilterState {
    cat: number;
    // 仅用于筛选栏显示已选分类
    catName: string;
    brand: number;
    // 仅用于筛选栏显示已选品牌
    brandName: string;
    min: string;
    max: string;
    // 每个属性只选一个值，attrValue 保持数组是接口格式
    attrs: { attrName: string; attrValue: string[] }[];
}

export const emptyFilter = (): ImageFilterState => ({ cat: 0, catName: "", brand: 0, brandName: "", min: "", max: "", attrs: [] });

export const cloneFilter = (value: ImageFilterState): ImageFilterState => ({
    ...value,
    attrs: value.attrs.map((item) => ({ attrName: item.attrName, attrValue: [...item.attrValue] }))
});

/** 转成接口条件：没选的项不传，避免空值被后端当成条件 */
export function toFilterQuery(value: ImageFilterState): Record<string, any> {
    const query: Record<string, any> = {};
    if (value.cat) query.cat = value.cat;
    if (value.brand) query.brand = String(value.brand);
    if (value.min !== "") query.min = Number(value.min);
    if (value.max !== "") query.max = Number(value.max);
    if (value.attrs.length) query.attrs = value.attrs;
    return query;
}
import { create } from "zustand";
import Taro from "@tarojs/taro";

import { getLocationByLocation, getLocationByIp } from "@/api/region";
import type { ByLocationData } from "@/types/region";
import { getStoreList, getStoreDetail } from "@/api/store/store";
import type { StoreListRecords } from "@/types/store/store";
import { useConfigStore } from "@/store/config";

/**
 * O2O 门店定位 / 进店规则（自旧 store/region.ts 405 行全量移植）
 *
 * 迁移要点：
 * - pinia setup store → zustand 单例；导出字段与方法名保持不变，已迁移页面的
 *   `useRegionStore.getState().xxx` 调用无需改动。
 * - 旧 `uni.getStorageSync/setStorageSync` → `Taro.getStorageSync/setStorageSync`，**storage key 保持不变**，
 *   便于同一设备从旧版切过来时沿用已有选择。
 * - 旧内部 ref `setCurrent` 未导出、无模板依赖，改为模块级变量 `shouldApplyLocated`。
 * - 旧 `utils/location.ts` 里 `regionStore.loading = true` 直接改 state 的写法在 zustand 下无效，
 *   已改为 `useRegionStore.setState({ loading })`（见 utils/location.ts）。
 */

type LocationSource = "gps" | "ip" | "manual";
type LocationCoordinates = { latitude: number; longitude: number };

/** 旧 ref setCurrent：是否允许把自动定位结果写入当前地区（由 setCurrentFlag 控制） */
let shouldApplyLocated = false;

const parseLocation = (location: string): LocationCoordinates | null => {
    const parts = location.split(",");
    if (parts.length !== 2 || parts.some((part) => !part.trim())) return null;
    const [longitude, latitude] = parts.map(Number);
    if (
        !Number.isFinite(latitude) ||
        !Number.isFinite(longitude) ||
        Math.abs(latitude) > 90 ||
        Math.abs(longitude) > 180 ||
        (latitude === 0 && longitude === 0)
    ) {
        return null;
    }
    return { latitude, longitude };
};

const readJson = <T,>(key: string, fallback: T): T => {
    try {
        const raw = Taro.getStorageSync(key);
        if (!raw) return fallback;
        return (typeof raw === "string" ? JSON.parse(raw) : raw) as T;
    } catch {
        return fallback;
    }
};

const readString = (key: string): string => {
    try {
        const raw = Taro.getStorageSync(key);
        return raw ? String(raw) : "";
    } catch {
        return "";
    }
};

// 会话级恢复：H5 刷新会重建内存态，用 sessionStorage 兜底（关闭标签即清空）；
// 小程序/App 靠进程内存，退出商城自动清空——产品要求下次进入需重新选门店，故不落 storage
const readSessionShop = (): StoreListRecords => {
    if (process.env.TARO_ENV === "h5") {
        try {
            const cached = window.sessionStorage.getItem("currentShop");
            if (cached) return JSON.parse(cached) as StoreListRecords;
        } catch {
            return {} as StoreListRecords;
        }
    }
    return {} as StoreListRecords;
};

const writeSessionShop = (val: StoreListRecords) => {
    if (process.env.TARO_ENV !== "h5") return;
    try {
        window.sessionStorage.setItem("currentShop", JSON.stringify(val));
    } catch {
        /* 隐私模式下 sessionStorage 可能抛错，忽略 */
    }
};

const initialSelectedName = readString("currentSelectedName");
const initialSelectedAddressId = Number(readString("currentSelectedAddressId")) || 0;
const cachedLocationSource = readString("currentLocationSource");

// 旧缓存中有选点名称或收货地址 id 时保留用户选择，其余按自动定位刷新
const initialLocationSource: LocationSource = (["gps", "ip", "manual"] as const).includes(cachedLocationSource as LocationSource)
    ? (cachedLocationSource as LocationSource)
    : initialSelectedName || initialSelectedAddressId
      ? "manual"
      : "gps";

// 从原始值解析 shopId：为空/无效返回 null，合法数字（含自营门店 0）原样返回
const parseShopId = (raw: unknown): number | null => {
    if (raw === undefined || raw === null || raw === "") return null;
    const num = Number(raw);
    return Number.isFinite(num) && num >= 0 ? num : null;
};

// 从 URL / 小程序启动参数中读取推广的 shopId（推广店铺规则用）
const getPromotionShopId = (): number | null => {
    try {
        if (process.env.TARO_ENV === "h5") {
            const search = new URLSearchParams(window.location.search);
            const raw = search.has("shopId") ? search.get("shopId") : search.has("shop_id") ? search.get("shop_id") : null;
            const idFromUrl = parseShopId(raw);
            if (idFromUrl !== null) return idFromUrl;
        } else {
            try {
                const opts: any = Taro.getLaunchOptionsSync ? Taro.getLaunchOptionsSync() : {};
                const query = opts?.query || opts?.referrerInfo?.extraData || {};
                const rawQuery = query.shopId ?? query.shop_id;
                const idFromQuery = parseShopId(rawQuery);
                if (idFromQuery !== null) return idFromQuery;
                // 小程序扫码进入，scene 里可能带 shopId：scene=shopId%3D0 → shopId=0
                if (opts?.scene) {
                    const decoded = decodeURIComponent(String(opts.scene));
                    const match = decoded.match(/shop[_]?[iI]d[=:](\d+)/);
                    if (match) return parseShopId(match[1]);
                }
            } catch {
                // 忽略：部分平台不支持
            }
        }
    } catch (error) {
        console.warn("解析推广门店 shopId 失败:", error);
    }
    return null;
};

// 按规则进店结果：allowEnterHome=false 表示只绑定门店、留在原链接页，不跳门店首页
type ShopResolveResult = { shop: StoreListRecords; allowEnterHome: boolean } | null;

export interface RegionState {
    currentRegion: ByLocationData;
    currentLocationSource: LocationSource;
    currentSelectedName: string;
    currentSelectedAddressId: number;
    currentLocationInfo: LocationCoordinates;
    loading: boolean;
    /** 受进店规则控制的最近门店（头部展示用） */
    nearestShopInfo: StoreListRecords;
    /** 按定位距离算出的最近门店，供"最近门店"入口直达，不影响头部展示 */
    nearestShopByLocation: StoreListRecords;
    /** 用户手动选中的当前门店，仅本次会话有效 */
    currentShop: StoreListRecords;
    realTimeRegion: ByLocationData;
    realTimeLocationInfo: LocationCoordinates;

    setCurrentFlag: (val: boolean) => void;
    setCurrentRegion: (val: ByLocationData, source?: LocationSource) => void;
    setCurrentSelectedName: (val: string) => void;
    setCurrentSelectedAddressId: (val: number) => void;
    setCurrentLocation: (val: LocationCoordinates) => void;
    setCurrentShop: (val: StoreListRecords) => void;
    setRealTimeRegion: (val: ByLocationData) => void;
    setRealTimeLocation: (val: LocationCoordinates) => void;
    getLocationByLocationData: (location: string) => Promise<boolean>;
    getLocationByIpData: () => Promise<boolean>;
    getNearestShopId: (autoEnter?: boolean) => Promise<void>;
    prefetchNearestShopByLocation: () => Promise<void>;
}

export const useRegionStore = create<RegionState>((set, get) => {
    const setCurrentShop = (val: StoreListRecords) => {
        set({ currentShop: val });
        writeSessionShop(val);
    };

    const setCurrentLocation = (val: LocationCoordinates) => {
        set({ currentLocationInfo: val });
        Taro.setStorageSync("currentLocationInfo", JSON.stringify(val));
    };

    const setCurrentSelectedName = (val: string) => {
        set({ currentSelectedName: val });
        Taro.setStorageSync("currentSelectedName", val);
    };

    const setCurrentSelectedAddressId = (val: number) => {
        const next = Number(val) || 0;
        set({ currentSelectedAddressId: next });
        Taro.setStorageSync("currentSelectedAddressId", next);
    };

    const setCurrentRegion = (val: ByLocationData, source: LocationSource = "manual") => {
        set({ currentRegion: val, currentLocationSource: source });
        Taro.setStorageSync("currentRegion", JSON.stringify(val));
        Taro.setStorageSync("currentLocationSource", source);
        // 用户的新选择优先于尚未返回的自动定位
        if (source === "manual") shouldApplyLocated = false;
        // 以城市为单位的选择重置展示名与收货地址 id；收货地址/地图选点流程随后单独写入
        setCurrentSelectedName("");
        setCurrentSelectedAddressId(0);
    };

    const applyLocatedRegion = (region: ByLocationData, coordinates: LocationCoordinates, source: "gps" | "ip") => {
        set({ realTimeRegion: region, realTimeLocationInfo: coordinates });

        // IP 城市中心仅用于首次兜底，不能降级已有的 GPS 位置或覆盖手选地址
        const { currentRegion, currentLocationSource } = get();
        const canApply = source === "gps" || !currentRegion.regionId || currentLocationSource === "ip";
        if (shouldApplyLocated && canApply) {
            setCurrentLocation(coordinates);
            setCurrentRegion(region, source);
            shouldApplyLocated = false;
            void get().getNearestShopId();
            void get().prefetchNearestShopByLocation();
        }
    };

    const getLocationByIpData = async (): Promise<boolean> => {
        try {
            const res = await getLocationByIp();
            const coordinates = parseLocation(res?.centor || "");
            if (!res?.regionId || !coordinates) return false;
            applyLocatedRegion(res as ByLocationData, coordinates, "ip");
            return true;
        } catch (error) {
            console.error("通过ip获取城市定位失败:", error);
            return false;
        } finally {
            set({ loading: false });
        }
    };

    const getLocationByLocationData = async (location: string): Promise<boolean> => {
        try {
            set({ loading: true });
            const coordinates = parseLocation(location);
            if (!coordinates) throw new Error("定位坐标无效");
            const res = await getLocationByLocation(location);
            if (!res?.regionId) throw new Error("定位地区无效");
            applyLocatedRegion(res as ByLocationData, coordinates, "gps");
            return true;
        } catch (error) {
            console.error("通过gps获取城市定位失败:", error);
            await getLocationByIpData();
            return false;
        } finally {
            set({ loading: false });
        }
    };

    // 按规则进店：按 priority 升序遍历启用的规则，命中即返回
    const resolveShopByRules = async (): Promise<ShopResolveResult> => {
        const configStore = useConfigStore.getState();
        const { currentRegion, currentLocationInfo } = get();
        const rules = [...(configStore.storeEntryFirstRules || [])]
            .filter((r) => Number(r?.enabled) === 1)
            .sort((a, b) => (Number(a.priority) || 0) - (Number(b.priority) || 0));

        for (const rule of rules) {
            const ruleType = Number(rule.ruleType);

            // 规则 1：买家进入推广店铺（从 URL / 小程序启动参数取 shopId）
            // 命中后只绑定当前门店，留在推广链接对应页面，不强制跳门店首页
            if (ruleType === 1) {
                const shopId = getPromotionShopId();
                // 仅当链接/启动参数确实带了 shopId（含自营门店 0）时才命中规则 1，否则交由后续规则处理
                if (shopId !== null) {
                    try {
                        const detail: any = await getStoreDetail({ shopId });
                        if (detail && detail.shopId >= 0) {
                            return { shop: detail as StoreListRecords, allowEnterHome: false };
                        }
                    } catch (e) {
                        console.warn("获取推广门店详情失败:", e);
                    }
                }
                continue;
            }

            // 规则 2：从总部进店，进入同城配送范围内距离最近的门店
            // 通过 deliveryTypes=4,5（同城配送）筛选；命中即返回，接口空则交由规则 3 兜底
            if (ruleType === 2) {
                try {
                    const result = await getStoreList({
                        regionId: currentRegion.regionId,
                        page: 1,
                        size: 1,
                        ...currentLocationInfo,
                        deliveryTypes: "4,5",
                        sortField: "distance",
                        sortOrder: "asc"
                    });
                    // 超出配送范围（inLocalDeliveryRange 为 false）则不命中，继续走规则 3
                    const nearest = result.records?.[0];
                    if (nearest && nearest.inLocalDeliveryRange !== false) {
                        return { shop: nearest, allowEnterHome: true };
                    }
                } catch (e) {
                    console.warn("获取同城配送范围内门店失败:", e);
                }
                continue;
            }

            // 规则 3：无法识别身份时，按销售员气泡配置决定
            //  - salesmanEntryBubbleType === 2 且指定了 shopId：进入指定门店
            //  - 否则：进入距离最近的门店
            if (ruleType === 3) {
                const bubbleType = Number(configStore.salesmanEntryBubbleType) || 1;
                const bubbleShopId = Number(configStore.salesmanEntryShopId) || 0;
                if (bubbleType === 2 && bubbleShopId > 0) {
                    try {
                        const detail: any = await getStoreDetail({ shopId: bubbleShopId });
                        if (detail && detail.shopId) {
                            return { shop: detail as StoreListRecords, allowEnterHome: true };
                        }
                    } catch (e) {
                        console.warn("获取指定门店详情失败:", e);
                    }
                    continue;
                }
                try {
                    const result = await getStoreList({
                        regionId: currentRegion.regionId,
                        page: 1,
                        size: 1,
                        ...currentLocationInfo,
                        sortField: "distance",
                        sortOrder: "asc"
                    });
                    if (result.records?.length) {
                        return { shop: result.records[0], allowEnterHome: true };
                    }
                } catch (e) {
                    console.warn("获取最近门店失败:", e);
                }
                continue;
            }
        }
        return null;
    };

    // 将解析到的门店设为当前门店，并直接进入其门店首页
    const enterShopHome = (shop: StoreListRecords) => {
        if (!shop || shop.shopId === undefined || shop.shopId === null) return;
        setCurrentShop(shop);
        void Taro.reLaunch({ url: `/pages/store/index?id=${shop.shopId}` });
    };

    return {
        currentRegion: readJson<ByLocationData>("currentRegion", {} as ByLocationData),
        currentLocationSource: initialLocationSource,
        currentSelectedName: initialSelectedName,
        currentSelectedAddressId: initialSelectedAddressId,
        currentLocationInfo: readJson<LocationCoordinates>("currentLocationInfo", { latitude: 0, longitude: 0 }),
        loading: false,
        nearestShopInfo: {} as StoreListRecords,
        nearestShopByLocation: {} as StoreListRecords,
        currentShop: readSessionShop(),
        realTimeRegion: {} as ByLocationData,
        realTimeLocationInfo: { latitude: 0, longitude: 0 },

        setCurrentFlag: (val: boolean) => {
            shouldApplyLocated = val;
        },
        setCurrentRegion,
        setCurrentSelectedName,
        setCurrentSelectedAddressId,
        setCurrentLocation,
        setCurrentShop,
        setRealTimeRegion: (val: ByLocationData) => set({ realTimeRegion: val }),
        setRealTimeLocation: (val: LocationCoordinates) => set({ realTimeLocationInfo: val }),
        getLocationByLocationData,
        getLocationByIpData,

        // 按定位距离预取最近门店，供"最近门店"入口直达；不受进店规则影响、不自动进店
        prefetchNearestShopByLocation: async () => {
            const { currentRegion, currentLocationInfo } = get();
            try {
                const result = await getStoreList({
                    regionId: currentRegion.regionId,
                    page: 1,
                    size: 1,
                    ...currentLocationInfo,
                    sortField: "distance",
                    sortOrder: "asc"
                });
                set({ nearestShopByLocation: result.records.length > 0 ? result.records[0] : ({} as StoreListRecords) });
            } catch (error) {
                console.error("预取最近门店失败:", error);
            }
        },

        // autoEnter：按规则(1)/指定门店(2)解析到门店后，直接跳转对应门店首页
        getNearestShopId: async (autoEnter = false) => {
            const { currentRegion, currentLocationInfo } = get();
            try {
                const configStore = useConfigStore.getState();
                const firstType = Number(configStore.storeEntryFirstType) || 1;
                const designatedShopId = Number(configStore.storeEntryDesignatedShopId) || 0;

                // 按指定门店进网：直接取后台配置的指定门店详情作为"当前门店"
                if (firstType === 2 && designatedShopId > 0) {
                    const detail: any = await getStoreDetail({ shopId: designatedShopId });
                    const shop = (detail as StoreListRecords) || ({} as StoreListRecords);
                    set({ nearestShopInfo: shop });
                    if (autoEnter) enterShopHome(shop);
                    return;
                }

                // 按规则进店：按 priority 顺序命中
                if (firstType === 1) {
                    const matched = await resolveShopByRules();
                    if (matched) {
                        set({ nearestShopInfo: matched.shop });
                        // 推广链接（规则 1）：只绑定门店，留在原链接页；其余规则才允许跳门店首页
                        if (matched.allowEnterHome) {
                            if (autoEnter) enterShopHome(matched.shop);
                        } else {
                            setCurrentShop(matched.shop);
                        }
                        return;
                    }
                }

                // 兜底：按距离取最近门店
                const result = await getStoreList({
                    regionId: currentRegion.regionId,
                    page: 1,
                    size: 1,
                    ...currentLocationInfo,
                    sortField: "distance",
                    sortOrder: "asc"
                });
                const nearest = result.records.length > 0 ? result.records[0] : ({} as StoreListRecords);
                set({ nearestShopInfo: nearest });
                // 按规则(1)/指定门店(2)：兜底取到最近门店时同样直接进店
                if (autoEnter && (firstType === 1 || firstType === 2)) enterShopHome(nearest);
            } catch (error) {
                console.error("获取附近门店失败:", error);
            }
        }
    };
});

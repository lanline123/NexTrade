import request from "@/utils/request";
import type { RegionFilterState, CityRegionResponse } from "@/types/user/address";
import type { ByLocationResponse, ByLocationData } from "@/types/region";
import {
    shouldTransformTiandituCoordinate,
    tiandituLocationToWeixin,
    tiandituToWeixinCoordinate,
    weixinLocationToTianditu,
    weixinToTiandituCoordinate
} from "@/utils/mapCoordinate";

const normalizeTiandituLocationItem = (item: any) => {
    if (!item || typeof item !== "object" || typeof item.location !== "string") return item;
    return { ...item, location: tiandituLocationToWeixin(item.location) };
};

/** 将天地图接口返回的中心点归一为微信原生地图使用的 GCJ-02。 */
const normalizeLocationResponse = (data: ByLocationData): ByLocationData => {
    if (!shouldTransformTiandituCoordinate() || !data || typeof data !== "object") return data;

    const normalized = { ...data };
    if (typeof normalized.centor === "string") {
        normalized.centor = tiandituLocationToWeixin(normalized.centor);
    }

    const longitude = Number(normalized.longitude);
    const latitude = Number(normalized.latitude);
    if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
        const coordinate = tiandituToWeixinCoordinate({ longitude, latitude });
        normalized.longitude = coordinate.longitude;
        normalized.latitude = coordinate.latitude;
    }

    return normalized;
};

/** 天地图关键词搜索结果坐标归一为微信 GCJ-02。 */
const normalizeSearchResponse = (data: any) => {
    if (!shouldTransformTiandituCoordinate() || !data || typeof data !== "object") return data;
    return {
        ...data,
        tips: Array.isArray(data.tips) ? data.tips.map(normalizeTiandituLocationItem) : data.tips
    };
};

/** 天地图逆地理结果中的 POI/AOI 坐标归一为微信 GCJ-02。 */
const normalizeRegeoResponse = (data: any) => {
    if (!shouldTransformTiandituCoordinate() || !data?.regeocode) return data;

    const regeocode = data.regeocode;
    return {
        ...data,
        regeocode: {
            ...regeocode,
            ...(typeof regeocode.location === "string" ? { location: tiandituLocationToWeixin(regeocode.location) } : {}),
            pois: Array.isArray(regeocode.pois) ? regeocode.pois.map(normalizeTiandituLocationItem) : regeocode.pois,
            aois: Array.isArray(regeocode.aois) ? regeocode.aois.map(normalizeTiandituLocationItem) : regeocode.aois
        }
    };
};

export interface CountryRegion {
    regionId: number;
    regionName: string;
    standardCode: string;
    mobileAreaCode: string;
    regionInputMode?: string;
    parentId?: number;
    level?: number;
    isHot?: number;
    firstWord?: string;
}

export interface ChildRegion {
    regionId: number;
    regionName: string;
    parentId?: number;
    level?: number;
    standardCode?: string | null;
    regionInputMode?: string;
    nextLevelAvailable?: boolean;
}

export interface CountryRegionResponse {
    data: CountryRegion[];
    code: number;
    message: string;
}

/**
 * @description 获取跨境地址支持的国家列表
 * @returns 国家地区列表
 */
export const getCountryList = () => {
    return request<CountryRegionResponse>({
        url: "sys/region/getCountryList",
        method: "get"
    });
};

/**
 * @description 根据ID获取地区信息
 * @param ids 地区ID列表（逗号分隔）
 * @returns 地区详情
 */
export const getRegionByIds = (ids: string) => {
    return request<RegionFilterState>({
        url: "sys/region/getRegion",
        method: "get",
        params: { regionIds: ids }
    });
};

/**
 * @description 获取城市地区数据
 * @returns 城市地区列表
 */
export const getCityRegion = () => {
    return request<CityRegionResponse>({
        url: "sys/region/getCityRegion",
        method: "get"
    });
};

/**
 * @description 通过GPS坐标获取城市定位
 * @param location 经纬度字符串
 * @returns 定位城市信息
 */
export const getLocationByLocation = async (location: string) => {
    const data = await request<ByLocationResponse>({
        url: `sys/region/getLocationByLocation?location=${weixinLocationToTianditu(location)}`,
        method: "get"
    });
    return normalizeLocationResponse(data);
};

/**
 * @description 通过地区ID获取城市定位（含中心经纬度）
 * @param regionId 地区ID
 * @returns 定位城市信息
 */
export const getLocationByRegionId = async (regionId: number) => {
    const data = await request<ByLocationResponse>({
        url: `sys/region/getLocationByRegionId?regionId=${regionId}`,
        method: "get"
    });
    return normalizeLocationResponse(data);
};

/**
 * @description 通过IP获取城市定位
 * @returns 定位城市信息
 */
export const getLocationByIp = async () => {
    const data = await request<ByLocationResponse>({
        url: "sys/region/getLocationByIp",
        method: "get"
    });
    return normalizeLocationResponse(data);
};

/**
 * @description 获取指定地区的子地区列表
 * @param regionId 父地区ID
 * @returns 子地区列表
 */
export const getRegionListByRegionId = (regionId: number | string) => {
    return request<any>({
        url: `sys/region/getRegionListByRegionId?regionId=${regionId}`,
        method: "get"
    });
};

/**
 * @description 根据城市名搜索城市列表
 * @param cityName 城市名关键词
 * @returns 匹配的城市列表
 */
export const getCityListByCityName = (cityName: string) => {
    return request<any>({
        url: `sys/region/getCityListByCityName?cityName=${cityName}`,
        method: "get",
        cancelPrevious: true,
        requestKey: "getCityListByCityName"
    });
};

/**
 * @description 获取逆地理编码详情
 * @param params 包含经纬度等
 * @returns 地址详情
 */
export const getRegeoDetail = async (params: any) => {
    let requestParams = params;
    if (shouldTransformTiandituCoordinate()) {
        const longitude = Number(params?.longitude);
        const latitude = Number(params?.latitude);
        if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
            const coordinate = weixinToTiandituCoordinate({ longitude, latitude });
            requestParams = { ...params, longitude: coordinate.longitude, latitude: coordinate.latitude };
        }
    }

    const data = await request<any>({
        url: `sys/region/getRegeoDetail`,
        method: "get",
        params: requestParams
    });
    return normalizeRegeoResponse(data);
};

/**
 * @description 获取地区路径（省市区完整路径）
 * @param id 地区ID
 * @returns 地区路径
 */
export const getRegionPath = (id: number) => {
    return request<any>({
        url: `sys/region/getRegionPath?regionId=${id}`,
        method: "get"
    });
};

/**
 * @description 关键词搜索地区
 * @param params 搜索关键词等
 * @returns 匹配的地区列表
 */
export const searchByKeywords = async (params: any) => {
    const requestParams =
        shouldTransformTiandituCoordinate() && typeof params?.location === "string"
            ? { ...params, location: weixinLocationToTianditu(params.location) }
            : params;
    const data = await request<any>({
        url: "sys/region/searchByKeywords",
        method: "get",
        params: requestParams
    });
    return normalizeSearchResponse(data);
};

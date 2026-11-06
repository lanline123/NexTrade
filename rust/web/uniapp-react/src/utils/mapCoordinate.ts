import gcoord from "gcoord";
import { useConfigStore } from "@/store/config";

export interface MapCoordinate {
    longitude: number;
    latitude: number;
}

/**
 * 微信小程序使用原生地图时，是否需要在天地图接口边界转换坐标。
 * 其他端与高德配置保持原行为，不参与本轮适配。
 */
export const shouldTransformTiandituCoordinate = (): boolean => {
    let shouldTransform = false;

    // #ifdef MP-WEIXIN
    shouldTransform = useConfigStore().mapProvider === "tianditu";
    // #endif

    return shouldTransform;
};

const transform = (coordinate: MapCoordinate, from: any, to: any): MapCoordinate => {
    if (!shouldTransformTiandituCoordinate()) return coordinate;

    const [longitude, latitude] = gcoord.transform([coordinate.longitude, coordinate.latitude], from, to);
    return { longitude, latitude };
};

/** 微信原生地图 GCJ-02 -> 天地图 CGCS2000（工程上按 WGS84 处理）。 */
export const weixinToTiandituCoordinate = (coordinate: MapCoordinate): MapCoordinate => transform(coordinate, gcoord.GCJ02, gcoord.WGS84);

/** 天地图 CGCS2000（工程上按 WGS84 处理）-> 微信原生地图 GCJ-02。 */
export const tiandituToWeixinCoordinate = (coordinate: MapCoordinate): MapCoordinate => transform(coordinate, gcoord.WGS84, gcoord.GCJ02);

const transformLocation = (location: string, converter: (coordinate: MapCoordinate) => MapCoordinate): string => {
    const [rawLongitude, rawLatitude] = String(location).split(",");
    const longitude = Number.parseFloat(rawLongitude);
    const latitude = Number.parseFloat(rawLatitude);
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) return location;

    const converted = converter({ longitude, latitude });
    return `${converted.longitude},${converted.latitude}`;
};

/** 将 "lng,lat" 从微信 GCJ-02 转成天地图接口坐标。 */
export const weixinLocationToTianditu = (location: string): string => transformLocation(location, weixinToTiandituCoordinate);

/** 将 "lng,lat" 从天地图接口坐标转成微信 GCJ-02。 */
export const tiandituLocationToWeixin = (location: string): string => transformLocation(location, tiandituToWeixinCoordinate);

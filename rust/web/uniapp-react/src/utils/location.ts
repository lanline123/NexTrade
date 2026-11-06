import Taro from "@tarojs/taro";
import gcoord from "gcoord";

import { useRegionStore } from "@/store/region";

/**
 * 定位工具（自旧 utils/location.ts 139 行移植）
 *
 * 迁移要点：
 * - `useRegionStore()` 在 pinia 里是可变 store，旧代码有 `regionStore.loading = true` 这类直接赋值；
 *   zustand 下改为 `useRegionStore.setState({ loading })`。
 * - 旧 `#ifdef APP-PLUS` 的 plus.android.requestPermissions 分支无对应物：Phase 1 不做 App 端，
 *   小程序/H5 各自走系统授权流程；App 端接原生模块时在此补回（见 checkLocationPermission 注释）。
 * - `uni.getLocation/getSetting/authorize` → `Taro.*`（API 面 1:1）。
 */

export interface LocationInfo {
    latitude: number;
    longitude: number;
    province: string;
    city: string;
    district: string;
    address: string;
    adcode: string;
}

/**
 * 定位坐标类型
 * @description H5 取 WGS84 原始坐标，由本文件用 gcoord 转 GCJ02；小程序端直接取 gcj02
 */
export const getLocationCoordType = (): "wgs84" | "gcj02" => {
    return process.env.TARO_ENV === "h5" ? "wgs84" : "gcj02";
};

let pendingLocation: Promise<boolean> | null = null;

/** 获取位置并等待地区解析完成；IP 兜底不计为 GPS 定位成功。 */
export const getCurrentRegionInfo = (): Promise<boolean> => {
    if (pendingLocation) return pendingLocation;
    useRegionStore.setState({ loading: true });

    const locate = async () => {
        try {
            if (!(await checkLocationPermission())) {
                await useRegionStore.getState().getLocationByIpData();
                return false;
            }
            const location = await new Promise<any>((resolve, reject) => {
                Taro.getLocation({
                    type: getLocationCoordType(),
                    isHighAccuracy: true,
                    highAccuracyExpireTime: 5000,
                    success: resolve,
                    fail: reject
                } as any);
            });
            let { longitude, latitude } = location;
            if (process.env.TARO_ENV === "h5") {
                // H5 取到的是 WGS84 原始坐标，统一转 GCJ02 后再存储与解析地址
                [longitude, latitude] = gcoord.transform([longitude, latitude], gcoord.WGS84, gcoord.GCJ02);
            }
            return await useRegionStore.getState().getLocationByLocationData(`${longitude},${latitude}`);
        } catch (error) {
            console.error("获取位置失败:", error);
            await useRegionStore.getState().getLocationByIpData();
            return false;
        }
    };

    pendingLocation = locate().finally(() => {
        useRegionStore.getState().setCurrentFlag(false);
        useRegionStore.setState({ loading: false });
        pendingLocation = null;
    });
    return pendingLocation;
};

/**
 * 检查定位权限
 *
 * App 端差异：旧实现用 plus.android.requestPermissions 申请 ACCESS_FINE_LOCATION，
 * iOS 直接放行（plus.android 在 iOS 为 undefined，调用会导致 Promise 永不 resolve 挂死）。
 * Taro/RN 端需接原生权限模块后补回；当前按"无该能力则交由系统在定位时弹窗"处理。
 */
export const checkLocationPermission = (): Promise<boolean> => {
    return new Promise((resolve) => {
        if (process.env.TARO_ENV === "h5") {
            if (navigator.permissions?.query) {
                navigator.permissions
                    .query({ name: "geolocation" })
                    .then((result) => resolve(result.state !== "denied"))
                    .catch(() => resolve(true));
            } else {
                // 由定位接口申请权限，兼容不支持 Permissions API 的浏览器
                resolve(true);
            }
            return;
        }

        // 小程序端：查询 scope.userLocation，未授权则主动申请
        Taro.getSetting({
            success: (res) => {
                if (res.authSetting && res.authSetting["scope.userLocation"]) {
                    resolve(true);
                } else {
                    Taro.authorize({
                        scope: "scope.userLocation",
                        success: () => resolve(true),
                        fail: () => resolve(false)
                    });
                }
            },
            fail: () => resolve(false)
        });
    });
};

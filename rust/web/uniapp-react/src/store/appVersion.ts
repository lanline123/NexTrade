import Taro from "@tarojs/taro";
import { create } from "zustand";

import { getAppUpdate } from "@/api/common";

export interface AppVersionState {
    showUpdateAppPop: boolean;
    updateUrl: string;
    osName: string;
    setShowUpdateAppPop: (value: boolean) => void;
    setUpdateUrl: (url: string) => void;
    getAppUpdateStatus: () => Promise<string>;
}

/**
 * App 版本更新 store。
 * 注意：plus.runtime 为 5+ App（HTML5+）运行时专有 API；Taro App 端基于 React Native，
 * 没有 plus 对象 —— App 壳方案确定后（RN 原生模块或 H5 壳）此 store 需要按端重写。
 */
export const useAppVersionStore = create<AppVersionState>((set, get) => ({
    showUpdateAppPop: false,
    updateUrl: "",
    osName: "",
    setShowUpdateAppPop: (value) => set({ showUpdateAppPop: value }),
    setUpdateUrl: (url) => set({ updateUrl: url }),
    getAppUpdateStatus: (): Promise<string> => {
        return new Promise((resolve, reject) => {
            try {
                const res = Taro.getSystemInfoSync() as any;
                set({ osName: res.osName });
                // TODO(MIGRATION)：plus.runtime 仅 5+ App 可用，Taro RN 端待接原生版本模块
                const plus = (globalThis as any).plus;
                if (!plus?.runtime) {
                    reject(new Error("App runtime (plus) is not available in Taro"));
                    return;
                }
                plus.runtime.getProperty(plus.runtime.appid, async (widgetInfo: { version: string }) => {
                    console.log("Current app version:", widgetInfo.version);
                    try {
                        const result = await getAppUpdate({
                            type: res.osName,
                            version: widgetInfo.version
                        });
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                });
            } catch (error) {
                reject(error);
            }
        });
    }
}));

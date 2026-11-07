import Taro from "@tarojs/taro";
import { create } from "zustand";

import { getAppUpdate } from "@/api/common";
import { getShellBridge } from "@/utils/nativeBridge";

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
 * App 端形态已定案为 H5 壳（B6-6b-2）：壳内注入 H5ShellBridge 后，版本号经桥读取
 * （对齐旧 plus.runtime.getProperty）；非壳环境（浏览器/微信）按既有行为拒绝并静默。
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
                const bridge = getShellBridge();
                const osName = bridge?.getOsName?.() || res.osName;
                const version = bridge?.getAppVersion?.();
                if (!bridge || !version) {
                    reject(new Error("App shell bridge is not available"));
                    return;
                }
                void (async () => {
                    try {
                        const result = await getAppUpdate({
                            type: osName,
                            version
                        });
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                })();
            } catch (error) {
                reject(error);
            }
        });
    }
}));

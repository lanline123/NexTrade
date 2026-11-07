import { useAppVersionStore } from "@/store/appVersion";

/**
 * App 版本更新检查（自旧 uniapp src/utils/checkAppUpdate.ts 逐行移植）
 * - 有可用更新 → 弹出更新层（updateUrl 供「立即更新」跳转）
 * - H5 壳内经 H5ShellBridge 读版本；非壳环境 getAppUpdateStatus 直接 reject → 静默
 */
export default function checkAppUpdate() {
    const appVersionStore = useAppVersionStore();
    appVersionStore
        .getAppUpdateStatus()
        .then((res: string) => {
            if (res) {
                appVersionStore.setShowUpdateAppPop(true);
                appVersionStore.setUpdateUrl(res);
            } else {
                appVersionStore.setShowUpdateAppPop(false);
                appVersionStore.setUpdateUrl("");
            }
        })
        .catch((err) => {
            console.error("App update check failed:", err);
            appVersionStore.setShowUpdateAppPop(false);
            appVersionStore.setUpdateUrl("");
        });
}

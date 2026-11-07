import Taro from "@tarojs/taro";

import { t } from "@/utils/i18n";
import { getShellBridge } from "@/utils/nativeBridge";

/**
 * App 端系统权限申请（自旧 uniapp src/utils/appPermission.ts 移植到 H5 壳桥）
 *
 * 与旧版的差异：旧版直调 plus.android.requestPermissions；H5 壳形态下这些能力由壳注入
 * 的 H5ShellBridge 提供。非壳环境（浏览器/微信）沿用旧 #ifndef APP-PLUS 行为：直接放行。
 * iOS 授权由系统在 chooseImage 时弹窗处理，桥端与旧版一样放行（壳内实现注意对齐）。
 */

/** 永久拒绝后系统弹窗不再唤起，只能引导用户去设置页手动开启 */
const guideToSettings = (content: string, resolve: (granted: boolean) => void) => {
    Taro.showModal({
        title: t("权限被禁用"),
        content,
        confirmText: t("去设置"),
        cancelText: t("取消"),
        success: (res) => {
            if (res.confirm) {
                // 旧 plus.runtime.openURL("app-settings:") → 桥 openUrl
                getShellBridge()?.openUrl?.("app-settings:");
            }
            resolve(false);
        },
        fail: () => resolve(false)
    });
};

/** 申请 Android 运行时权限，返回是否授权 */
const requestAndroidPermission = (permissionID: string, deniedTip: string): Promise<boolean> => {
    return new Promise((resolve) => {
        const bridge = getShellBridge();
        if (!bridge) {
            // 非 App 壳环境（浏览器/微信），对齐旧 #ifndef APP-PLUS：放行
            resolve(true);
            return;
        }
        void (async () => {
            try {
                if ((bridge.getOsName?.() || "").toLowerCase() === "ios") {
                    // iOS 无 Android 式权限申请 API；相册授权由系统在 chooseImage 时弹窗处理，此处放行
                    resolve(true);
                    return;
                }
                if (await bridge.checkPermission?.(permissionID)) {
                    // 已授权，不必再唤起系统弹窗
                    resolve(true);
                    return;
                }
                const granted = (await bridge.requestPermission?.(permissionID)) ?? false;
                if (granted) {
                    resolve(true);
                } else {
                    guideToSettings(deniedTip, resolve);
                }
            } catch {
                resolve(false);
            }
        })();
    });
};

/** 申请相册权限 */
export const requestPhotosPermission = (): Promise<boolean> => {
    return requestAndroidPermission("android.permission.READ_EXTERNAL_STORAGE", t("相册权限已被禁用，请在手机设置中开启存储权限后再试。"));
};

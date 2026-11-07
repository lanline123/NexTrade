import { useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import { useAppVersionStore } from "@/store/appVersion";
import { staticResource } from "@/utils";
import { getShellBridge } from "@/utils/nativeBridge";
import { t } from "@/utils/i18n";

import "./AppUpdatePop.scss";

/**
 * App 热更新弹层（自旧 components/appUpdatePop/index.vue 移植）
 * - 仅 H5 壳内可触发（checkAppUpdate 经桥读版本，非壳环境静默失败不弹）
 * - 旧 uni.downloadFile + plus.runtime.install/restart → 壳桥 installUpdate/restartApp
 */
export default function AppUpdatePop() {
    const show = useAppVersionStore((s) => s.showUpdateAppPop);
    const setShowUpdateAppPop = useAppVersionStore((s) => s.setShowUpdateAppPop);
    const updateUrl = useAppVersionStore((s) => s.updateUrl);
    const osName = useAppVersionStore((s) => s.osName);

    const [downloadLoading, setDownloadLoading] = useState(false);
    const [progress, setProgress] = useState(0);

    const handleClose = () => {
        if (downloadLoading) return;
        setShowUpdateAppPop(false);
    };

    const handleUpdate = () => {
        if (downloadLoading) return;
        const bridge = getShellBridge();
        if (!bridge?.installUpdate || !bridge?.restartApp) {
            Taro.showToast({ title: t("当前环境不支持应用内更新"), icon: "none" });
            return;
        }
        setDownloadLoading(true);
        setProgress(0);
        void bridge
            .installUpdate(updateUrl, (value) => setProgress(value))
            .then(() => {
                setShowUpdateAppPop(false);
                setProgress(0);
                setDownloadLoading(false);
                Taro.showModal({
                    title: t("系统提示"),
                    content: t("新版本已经更新完成，需要重启应用"),
                    showCancel: false,
                    confirmText: t("确定"),
                    success: (modalRes) => {
                        if (modalRes.confirm) {
                            // 旧 plus.runtime.restart / iOS exit / 安卓 quit → 壳统一 restartApp
                            bridge.restartApp!();
                        } else if (osName !== "android") {
                            bridge.restartApp!();
                        } else {
                            bridge.restartApp!();
                        }
                    }
                });
            })
            .catch(() => {
                setDownloadLoading(false);
                setProgress(0);
                Taro.showToast({ title: t("下载失败，请重试"), icon: "none" });
            });
    };

    return (
        <Popup visible={show} position="center" onClose={handleClose} closeable={false} closeOnOverlayClick={false} style={{ backgroundColor: "transparent" } as any}>
            <View className="hot-update-box">
                <View className="box-bg">
                    <Image className="box-bg-img" src={staticResource("common/hot-update-bg.png")} />
                    <Image className="box-bg-ico" src={staticResource("common/hot-update-ico.png")} />
                    <View className="close" onClick={handleClose}>
                        <Text className="iconfont-h5 icon-chacha" />
                    </View>
                    <View className="hot-update">
                        <View className="hot-update-title">{downloadLoading ? "下载中~" : t("有新版本更新啦！")}</View>
                        <View className="hot-update-content">
                            <View className="hot-update-row"> {t("有数据需要更新，请点击升级")} </View>
                        </View>
                        <View className="hot-update-btn">
                            <View className="update-height">
                                {downloadLoading ? (
                                    <View className="progress-box">
                                        <View className="progress" style={{ width: `${progress}%` }}>
                                            <View className="progress-text">{progress}%</View>
                                        </View>
                                    </View>
                                ) : (
                                    <View className="btn-box" onClick={handleUpdate}>
                                        {t("立即更新")}
                                    </View>
                                )}
                            </View>
                        </View>
                    </View>
                </View>
            </View>
        </Popup>
    );
}

import type { ReactNode } from "react";
import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import { useUserStore } from "@/store/user";
import { t } from "@/utils/i18n";
import { handleLogin } from "@/utils/handleLogin";
import { copy, isPro } from "@/utils";

interface Props {
    productId?: number;
    shopId?: number;
    orderId?: number;
    phone?: string;
    children: ReactNode;
}

/**
 * 客服入口（自旧 components/service/index.vue 移植）：
 * 点击后按后台客服配置跳转 IM / 客服电话 / 外链。
 * 旧 defineExpose(handleClick) 在 React 版不再需要（无父组件调用场景）。
 */
export default function Service({ productId = 0, shopId = 0, orderId = 0, phone = "", children }: Props) {
    const handleClick = () => {
        const token = Taro.getStorageSync("token");
        if (!token) return handleLogin();
        let url = `/pages/im/index?token=${token}`;
        const { serviceType, url: customUrl } = useUserStore.getState().serviceConfig;

        if (serviceType === 0) {
            Taro.showToast({
                title: t("暂无客服"),
                icon: "none"
            });
        } else if (serviceType === 4) {
            if (productId) {
                url += `&productId=${productId}`;
            }
            if (shopId >= 0) {
                url += `&shopId=${shopId}`;
            }
            if (orderId) {
                url += `&orderId=${orderId}`;
            }
            Taro.navigateTo({
                url
            });
        } else {
            if (!isPro() && shopId > 0) {
                if (!phone) {
                    return Taro.showToast({
                        title: t("暂无客服"),
                        icon: "none"
                    });
                }
                return Taro.showModal({
                    title: t("客服电话"),
                    content: phone,
                    confirmText: t("复制"),
                    success: function (res) {
                        if (res.confirm) {
                            copy(phone, () => {
                                Taro.showToast({
                                    title: t("复制成功"),
                                    icon: "none"
                                });
                            });
                        }
                    }
                });
            }
            if (process.env.TARO_ENV === "h5") {
                window.open(customUrl);
            }

            // TODO(MIGRATION)：原 #ifdef MP-WEIXIN 企业微信客服分支（wx.openCustomerServiceChat）；
            // 工程当前仅构建 h5/weapp，weapp 分支保留，APP-PLUS / MP-ALIPAY 分支按原条件并入 weapp。
            if (process.env.TARO_ENV === "weapp") {
                if (serviceType === 2 || serviceType === 1) {
                    //企业微信客服
                    const wxAny = (globalThis as any).wx;
                    wxAny?.openCustomerServiceChat?.({
                        extInfo: { url: customUrl },
                        corpId: useUserStore.getState().serviceConfig.corpId,
                        success(res: any) {},
                        fail(res: any) {
                            Taro.showToast({
                                title: res.errMsg,
                                duration: 1500,
                                icon: "none"
                            });
                        }
                    });
                    return;
                }

                Taro.navigateTo({
                    url: `/pages/webviewPage/index?url=${encodeURIComponent(customUrl)}`
                });
            }
        }
    };

    return <View onClick={handleClick}>{children}</View>;
}

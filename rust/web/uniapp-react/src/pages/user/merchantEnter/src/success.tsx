import { View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigImage from "@/components/tig/tig-image/TigImage";
import { useConfigStore } from "@/store/config";
import { isOverseas, redirect, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./success.scss";

interface Props {
    /** 旧 :initial-user-info */
    initialUserInfo?: Record<string, any>;
}

/**
 * 入驻成功（自旧 pages/user/merchantEnter/src/success.vue 逐行移植）
 * - 返回首页 / 进入商家后台
 * - 展示初始账号与密码提示（跨境版本走多语言占位符）
 */
export default function Success({ initialUserInfo = {} }: Props) {
    const baseInfo = useConfigStore((s) => s.baseInfo);

    const handleLink = (type?: string) => {
        if (type === "admin") {
            // 非 H5 端 window 不存在，origin 仅在 H5 分支读取（旧代码在 MP 端缺 adminDomain 时会异常）
            const origin = process.env.TARO_ENV === "h5" ? window.location.origin : "";
            const url = baseInfo.adminDomain ? baseInfo.adminDomain : `${origin}/admin`;
            if (process.env.TARO_ENV !== "h5") {
                redirect({ url });
            } else {
                window.open(url);
            }
        } else {
            redirect({ url: "/pages/index/index" });
        }
    };

    return (
        <View className="success-box">
            <TigImage className="success-img" src={staticResource("user/success.png")} mode="heightFix" />
            <View className="success-text">{t("审核已通过")}</View>
            <View className="success-btn">
                <TigButton2 plain style={{ borderColor: "#C1CCDE", color: "#013148", marginRight: "40rpx", height: "70rpx", width: "260rpx" }} onClick={() => handleLink()}>
                    {t("返回首页")}
                </TigButton2>
                <TigButton2 style={{ height: "70rpx", width: "260rpx" }} onClick={() => handleLink("admin")}>
                    {t("商家后台")}
                </TigButton2>
            </View>
            {initialUserInfo && initialUserInfo.initialPassword && initialUserInfo.mobile && (
                <View className="tip">
                    {isOverseas()
                        ? t("您的账号：{0}，初始密码：{1}，为了保障你的账户安全，请尽快修改初始密码", {
                              0: initialUserInfo.mobile ?? "",
                              1: initialUserInfo.initialPassword ?? ""
                          })
                        : `您的账号：${initialUserInfo.mobile ?? ""}，初始密码：${initialUserInfo.initialPassword ?? ""}，为了保障你的账户安全，请尽快修改初始密码`}
                </View>
            )}
        </View>
    );
}

// 旧模板中的 navigator 场景不涉及；保留 Taro 引用以对齐旧文件的环境判断写法
void Taro;
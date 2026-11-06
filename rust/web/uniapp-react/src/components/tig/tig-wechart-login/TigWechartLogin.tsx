import { useState } from "react";
import { View, Text, Button } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";

import { Popup } from "@nutui/nutui-react-taro";

import { getOauthInfo, getOauthUrl, getWechartMobile, setMiniProgramOpenid } from "@/api/login/login";
import { useUserStore } from "@/store/user";
import { useConfigStore } from "@/store/config";
import Checkbox from "@/pages/cart/src/Checkbox";
import { t } from "@/utils/i18n";

import "./TigWechartLogin.scss";

interface Props {
    /** 原 @login-success 事件（TigLayout 透传页面的 onLoginSuccess） */
    onLoginSuccess?: () => void;
}

/**
 * H5 微信授权登录弹层（自旧 components/tig/tig-wechart-login/tig-wechart-login.vue 移植）
 * - 展示条件：userStore.authType 非空（handleLogin 等入口 setAuthType("wechatLogin") 触发）
 * - H5：微信授权跳转（getOauthUrl → window.location.href）+ 回调 code 换登录态
 * - 小程序：手机号快捷登录（open-type=getPhoneNumber）
 * - 原 tig-popup v-model:show :z-index="10080" → NutUI Popup（层级需高于商品规格等业务弹窗）
 */
export default function TigWechartLogin({ onLoginSuccess }: Props) {
    const userStore = useUserStore();
    const configStore = useConfigStore();

    const isWechatH5 = configStore.XClientType === "wechat";

    // 原 computed show：get 读 userStore.authType，set 关闭即清空 authType（NutUI onClose 回调承接 set/close）
    const show = !!userStore.authType;

    const [isChecked, setIsChecked] = useState(false);
    const [loginLoading, setLoginLoading] = useState(false);

    const showAgreement = () => {
        userStore.setAuthType(""); // 关闭弹窗
        Taro.navigateTo({
            url: "/pages/login/mallAgreement?articleSn=fwxy&from=loginPopup"
        });
    };

    const mobileLogin = () => {
        if (!isChecked) {
            return Taro.showToast({
                title: t("请先同意用户协议"),
                duration: 1500,
                icon: "none"
            });
        }
    };

    //微信授权登录
    const wechatLogin = async () => {
        // const result = await getOauthUrl({ url: location.origin + location.pathname });
        const result = await getOauthUrl({ url: window.location.origin + window.location.pathname + window.location.search });
        window.location.href = result.url;
    };

    //获取用户信息
    const getWechatInfo = async (code: string) => {
        try {
            const result = await getOauthInfo({ code: code });
            if (result.type == 1) {
                // 已注册过，直接登录
                useUserStore.getState().setToken(result.token);
                await useUserStore.getState().getUserInfo();
                onLoginSuccess?.();
                useUserStore.getState().setAuthType("");
                return;
            }
            if (result.type == 2) {
                // 需要绑定手机号：存 openData 并跳转绑定页（是否需要绑定由后端判断）
                Taro.setStorageSync("openData", result.openData);
                Taro.navigateTo({
                    url: "/pages/user/bindMobilePhone/index"
                });
                return;
            }
        } catch (error: any) {
            Taro.showToast({
                title: error?.message || t("微信授权失败，请重试"),
                duration: 1500,
                icon: "none"
            });
        }
    };

    const handleLink = (type: string) => {
        userStore.setAuthType("");
        Taro.navigateTo({
            url: `/pages/login/index?loginType=${type}`
        });
    };

    const getPhoneNumber = async (e: any) => {
        try {
            const result = await getWechartMobile({ code: e.detail.code });
            useUserStore.getState().setToken(result);
            useUserStore.getState().getUserInfo();
            onLoginSuccess?.();
            useUserStore.getState().setAuthType("");
            if (process.env.TARO_ENV === "weapp") {
                // 原 #ifdef MP-WEIXIN
                updateUserOpenId();
            }
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
            useUserStore.getState().setAuthType("");
        }
    };

    const updateUserOpenId = async () => {
        Taro.login({
            success: async (res: any) => {
                await setMiniProgramOpenid({
                    code: res.code
                });
            },
            fail: (err: any) => {
                console.log(err);
            }
        });
    };

    const close = () => {
        userStore.setAuthType("");
    };

    const getUlParams = (url: string) => {
        const params: Record<string, string> = {};
        const urlParams = url.split("?")[1];
        if (urlParams) {
            urlParams.split("&").forEach((item: string) => {
                const [key, value] = item.split("=");
                params[key] = value;
            });
        }
        return params;
    };

    // 对应旧 onShow：微信 H5 场景检测授权回调 code 并换取登录态
    useDidShow(() => {
        if (configStore.XClientType === "wechat" && !Taro.getStorageSync("token")) {
            const params = getUlParams(window.location.href);
            if (params.code && params.code.length > 12) {
                //授权
                getWechatInfo(params.code);
            }
        }
    });

    return (
        <Popup visible={show} zIndex={10080} position="bottom" closeOnOverlayClick={false} onClose={close}>
            {show && (
                <View className="wechart-login-content" style={isWechatH5 ? { height: "19vh" } : {}}>
                    <View className="wechart-login-box">
                        {process.env.TARO_ENV === "weapp" ? (
                            // 原 #ifdef MP-WEIXIN
                            isChecked ? (
                                <Button
                                    className="wechart-btn"
                                    openType="getPhoneNumber"
                                    onGetPhoneNumber={getPhoneNumber}
                                    style={{ borderRadius: "20rpx", height: "95rpx", width: "100%" }}
                                >
                                    {t("手机号快捷登入")}
                                </Button>
                            ) : (
                                <View className="wechart-btn" style={{ borderRadius: "20rpx", height: "95rpx" }} onClick={mobileLogin}>
                                    {t("手机号快捷登入")}
                                </View>
                            )
                        ) : // 原 #ifndef MP-WEIXIN
                        isChecked ? (
                            <View
                                className="wechart-btn"
                                style={{ borderRadius: "20rpx", height: "95rpx" }}
                                onClick={() => {
                                    if (loginLoading) return;
                                    setLoginLoading(true);
                                    void wechatLogin().finally(() => setLoginLoading(false));
                                }}
                            >
                                {t("微信授权")}
                            </View>
                        ) : (
                            <View className="wechart-btn" style={{ borderRadius: "20rpx", height: "95rpx" }} onClick={mobileLogin}>
                                {t("微信授权")}
                            </View>
                        )}

                        <View className="rule-text">
                            <Checkbox checked={isChecked} onChange={() => setIsChecked(!isChecked)} />
                            <View className="rule-xieyi">
                                <Text onClick={() => setIsChecked(!isChecked)}>{t("登录即为同意")}</Text>
                                <Text className="special-color" onClick={showAgreement}>
                                    {t("《商城用户服务协议》")}
                                </Text>
                            </View>
                        </View>

                        {!isWechatH5 && (
                            <View className="other-login">
                                <View className="mobile-login" onClick={() => handleLink("mobile")}>
                                    {t("手机登录")}
                                </View>
                                <View className="account-login" onClick={() => handleLink("password")}>
                                    {t("账号登录")}
                                </View>
                            </View>
                        )}
                    </View>
                </View>
            )}
        </Popup>
    );
}

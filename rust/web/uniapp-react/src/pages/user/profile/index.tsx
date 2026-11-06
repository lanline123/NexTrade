import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Input, Picker, Text, View } from "@tarojs/components";
import Taro, { useDidShow, useRouter } from "@tarojs/taro";

import { bindWechat, getOauthUrl, unbindWechat } from "@/api/login/login";
import { getProfile, updateProfile } from "@/api/user/profile";
import { userClose } from "@/api/user/user";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigCopyright from "@/components/tig/tig-copyright/TigCopyright";
import FixedPlaceholder from "@/components/tig/tig-fixed-placeholder/FixedPlaceholder";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { useUserStore } from "@/store/user";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/** 旧 uni-forms-item（label-width: 300rpx）等价自绘 */
function ProfileRow({ label, children, onClick }: { label: ReactNode; children: ReactNode; onClick?: (event: any) => void }) {
    return (
        <View className="profile-form-row" onClick={onClick}>
            <View className="profile-form-label">{label}</View>
            <View className="profile-form-content">{children}</View>
        </View>
    );
}

/**
 * 个人资料编辑页（自旧 pages/user/profile/index.vue 逐行移植）
 * - 编辑昵称、出生日期等基本信息
 * - 修改登录密码、绑定/换绑手机号、绑定邮箱
 * - H5 微信公众号环境支持绑定/解绑微信
 * - App 端支持账号注销
 */
export default function Profile() {
    usePageGuards();

    const router = useRouter();
    // 订阅语言，切换语言时重渲染 t()
    const langCode = useI18nStore((s) => s.langCode);
    void langCode;

    const XClientType = useConfigStore((s) => s.XClientType);
    const openEmailRegister = useConfigStore((s) => s.openEmailRegister);
    const logout = useUserStore((s) => s.logout);

    const [form, setForm] = useState<any>({
        nickname: "",
        birthday: "",
        mobile: ""
    });
    const formRef = useRef<any>(form);
    formRef.current = form;

    const [flowType] = useState(() => Taro.getStorageSync("bindWechatFlowType") || null);

    const goPages = (url: string, type?: string) => {
        if (type == "password" && form.mobile == "") {
            Taro.showToast({
                title: t("未绑定手机号，请先绑定手机号再修改密码"),
                icon: "none"
            });
            return;
        }
        Taro.navigateTo({
            url
        });
    };

    const handleUerClose = async () => {
        try {
            await userClose();
            Taro.showToast({
                title: t("账号已注销"),
                icon: "none",
                duration: 1000
            });
            setTimeout(() => {
                void logout();
            }, 500);
        } catch (error) {
            console.error(error);
        }
    };

    const handleWriteOff = async () => {
        const res = await Taro.showModal({
            title: t("温馨提示"),
            content: t("注销账号后会删除相关账号数据，您是否要确认注销?"),
            confirmText: t("确定"),
            cancelText: t("取消")
        });
        if (res.confirm) {
            void handleUerClose();
        }
    };

    const onSubmit = () => {
        // 旧 uni-forms rules：nickname required
        if (!formRef.current.nickname) {
            Taro.showToast({
                title: t("请您填写用户昵称"),
                icon: "none"
            });
            return;
        }
        void edit();
    };

    const onLogout = () => {
        void logout();
    };

    const edit = async () => {
        try {
            await updateProfile({ ...formRef.current });

            Taro.showToast({
                title: t("修改成功"),
                icon: "none",
                duration: 1000
            });

            setTimeout(() => {
                Taro.navigateBack({
                    success: function () {
                        Taro.eventCenter.trigger("refreshData");
                    }
                });
            }, 1000);
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        }
    };

    const bindWechatAct = async (code: string) => {
        Taro.showLoading({
            title: t("授权中") + "..."
        });
        try {
            await bindWechat({ code: code });
            Taro.showToast({
                title: t("授权成功"),
                icon: "none",
                duration: 1000
            });

            let url = "/pages/user/profile/index";

            if (flowType) {
                url = `/pages/order/check?flowType=${flowType}`;
            }

            setTimeout(() => {
                redirect({
                    url,
                    mode: "redirectTo",
                    success: () => {
                        if (flowType) {
                            Taro.removeStorageSync("bindWechatFlowType");
                        }
                    }
                });
            }, 1000);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        } finally {
            Taro.hideLoading();
        }
    };

    // 解绑
    const unbindWechatAct = async () => {
        const res = await Taro.showModal({
            title: t("提示"),
            content: t("确定取消绑定吗？"),
            confirmText: t("确定"),
            cancelText: t("取消")
        });
        if (!res.confirm) return;

        Taro.showLoading({
            title: t("正在解绑...")
        });
        try {
            await unbindWechat();
            Taro.hideLoading();
            Taro.showToast({
                title: t("解绑成功"),
                icon: "none",
                duration: 1000
            });
            setTimeout(() => {
                void __getProfile();
            }, 500);
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                icon: "none",
                duration: 1000
            });
        } finally {
            Taro.hideLoading();
        }
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

    const __getProfile = async () => {
        Taro.showLoading({
            title: t("加载中")
        });
        try {
            const result: any = await getProfile();
            const temp: any = result.mobile;
            // 旧实现直接 replace，保持相同行为（无手机号时仅跳过脱敏）
            if (temp) {
                result.showMobile = temp.replace(/(\d{2})\d*(\d{4})$/, "$1*****$2");
            }
            setForm(result);
        } catch (error) {
            console.error(error);
        } finally {
            Taro.hideLoading();
        }
    };

    // 微信授权登录（仅 H5）
    const wechatLogin = async () => {
        if (process.env.TARO_ENV !== "h5") return;
        const result: any = await getOauthUrl({ url: location.origin + location.pathname });
        window.location.href = result.url;
    };

    // 旧 onLoad
    useEffect(() => {
        const options = (router.params || {}) as any;
        if (options && options.bindWechat) {
            void wechatLogin();
        }
        void __getProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onShow：公众号授权回调 code 绑定
    useDidShow(() => {
        if (process.env.TARO_ENV !== "h5") return;
        if (XClientType === "wechat" && Taro.getStorageSync("token")) {
            const params = getUlParams(location.href);
            if (params.code && params.code.length > 12) {
                // 授权
                void bindWechatAct(params.code);
            }
        }
    });

    return (
        <TigLayout title={t("个人资料")} borderBottom>
            <View className="profile-edit-main">
                <View className="profile-edit-content">
                    <ProfileRow label={t("用户ID")}>
                        <Input className="profile-input disabled" value={form.dimUsername || ""} disabled />
                    </ProfileRow>
                    <ProfileRow label={t("昵称")}>
                        {/* 旧 uni-easyinput type="nickname"（微信昵称补全）；Taro Input 无该类型，按普通文本输入 */}
                        <Input
                            className="profile-input"
                            value={form.nickname || ""}
                            placeholder={t("请输入昵称")}
                            placeholderStyle="color:rgb(192, 196, 204);font-size:26rpx;text-align:right"
                            onInput={(e) => setForm((prev: any) => ({ ...prev, nickname: e.detail.value }))}
                        />
                    </ProfileRow>
                    <ProfileRow label={t("出生日期")}>
                        <Picker
                            mode="date"
                            start="1970-01-01"
                            value={form.birthday && form.birthday !== "0000-00-00" ? form.birthday : "2000-01-01"}
                            onChange={(e) => setForm((prev: any) => ({ ...prev, birthday: e.detail.value }))}
                        >
                            <View className="el-input-id">
                                {form.birthday === "0000-00-00" || !form.birthday ? t("请选择出生日期") : form.birthday}
                                <View className="iconfont icon-xiangyou" />
                            </View>
                        </Picker>
                    </ProfileRow>
                </View>

                <View className="profile-edit-content">
                    <ProfileRow label={t("登录密码")} onClick={() => goPages("/pages/user/security/password" + "?mobile=" + form.mobile, "password")}>
                        <View className="el-input-id">
                            {t("修改")}
                            <View className="iconfont icon-xiangyou" />
                        </View>
                    </ProfileRow>
                    <ProfileRow label={t("手机号码")} onClick={() => goPages("/pages/user/security/phone" + "?mobile=" + form.mobile)}>
                        <View className="el-input-id">
                            {form.showMobile || t("去绑定")}
                            <View className="iconfont icon-xiangyou" />
                        </View>
                    </ProfileRow>
                    {openEmailRegister === 1 && (
                        <ProfileRow label={t("邮箱")} onClick={() => goPages("/pages/user/security/email" + "?email=" + form.email)}>
                            <View className="el-input-id">
                                {form.email ? form.email : t("去绑定")}
                                <View className="iconfont icon-xiangyou" />
                            </View>
                        </ProfileRow>
                    )}
                    {/* #ifdef H5 */}
                    {process.env.TARO_ENV === "h5" && XClientType == "wechat" && (
                        <ProfileRow label={t("公众号绑定")}>
                            {form.isBindWechat ? (
                                <View className="el-input-id" onClick={(e) => {
                                    e.stopPropagation();
                                    void unbindWechatAct();
                                }}>
                                    {t("解绑")}
                                    <View className="iconfont icon-xiangyou" />
                                </View>
                            ) : (
                                <View className="el-input-id" onClick={(e) => {
                                    e.stopPropagation();
                                    void wechatLogin();
                                }}>
                                    {t("绑定")}
                                    <View className="iconfont icon-xiangyou" />
                                </View>
                            )}
                        </ProfileRow>
                    )}
                    {/* #endif */}
                    <ProfileRow label={t("意见建议")} onClick={() => goPages("/pages/user/suggest/index" + "?mobile=" + form.mobile)}>
                        <View className="el-input-id">
                            <View className="iconfont icon-xiangyou" />
                        </View>
                    </ProfileRow>
                    <ProfileRow label={t("关于")} onClick={() => goPages("/pages/user/about/index" + "?mobile=" + form.mobile)}>
                        <View className="el-input-id">
                            <View className="iconfont icon-xiangyou" />
                        </View>
                    </ProfileRow>
                </View>
            </View>

            {/* #ifdef APP-PLUS */}
            {process.env.TARO_ENV === "rn" && (
                <View className="write-off-box" onClick={() => void handleWriteOff()}>
                    <View className="">{t("注销账号")}</View>
                    <View className="write-off-desc">
                        <Text className="">{t("注销后账号无法恢复，请谨慎操作")}</Text>
                        <Text className="iconfont icon-xiangyou" />
                    </View>
                </View>
            )}
            {/* #endif */}

            <TigCopyright />

            <FixedPlaceholder backgroundColor="#fff">
                <View className="btn-box">
                    <TigButton2 className="btn" plain onClick={onLogout}>
                        {t("退出登录")}{" "}
                    </TigButton2>
                    <TigButton2 className="btn" theme onClick={onSubmit}>
                        {t("保存修改")}{" "}
                    </TigButton2>
                </View>
            </FixedPlaceholder>

            {/* 旧 up-datetime-picker → Taro Picker（原生日期面板），formatter 说明见 MIGRATION TODO */}
        </TigLayout>
    );
}
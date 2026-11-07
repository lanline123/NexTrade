import { useState } from "react";
import Taro from "@tarojs/taro";
import { Input, View } from "@tarojs/components";

import TigButton from "@/components/tig/tig-button/TigButton";
import { forgetPassword } from "@/api/reset/reset";
import { t } from "@/utils/i18n";

import "./StepTow.scss";

interface Props {
    /** 旧 v-model:step */
    step: number;
    onStepChange: (step: number) => void;
    /** 旧 v-model:mobile-key */
    mobileKey: string;
    onMobileKeyChange: (mobileKey: string) => void;
}

/**
 * 找回密码第二步（自旧 pages/reset/src/stepTow.vue 移植）
 * - 设置新密码 / 确认新密码（可视切换）
 * - 密码强度校验规则逐条平移
 * - 重置成功后 1.5s 跳转登录页
 */
export default function StepTow({ onStepChange, mobileKey, onMobileKeyChange }: Props) {
    const [passwordType, setPasswordType] = useState(["password", "password"]);
    const [fristPassword, setFristPassword] = useState("");
    const [secondPassword, setSecondPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const isDisabled = !fristPassword || !secondPassword || isLoading;
    void isDisabled;

    const passwordTypeChange = (index: number) => {
        setPasswordType((prev) => {
            const next = [...prev];
            next[index] = next[index] == "password" ? "text" : "password";
            return next;
        });
    };

    const validatePassword = (value: string): string | undefined => {
        if (!value) {
            return t("密码不能为空");
        } else if (value.length > 20 || value.length < 6) {
            return t("密码应为6-20位字符");
        } else if (/\s/.test(value)) {
            return t("密码中不允许有空格");
        } else if (/^\d+$/.test(value)) {
            return t("密码不能全为数字");
        } else if (!/^(?=.*[\d\W]).+$/.test(value)) {
            return t("密码不能全为字母");
        } else if (!/^(?=.*[a-zA-Z0-9]).+$/.test(value)) {
            return t("密码不能全为符号");
        } else if (!/^(?!([a-zA-Z0-9])\1*$).+$/.test(value)) {
            return t("密码不能全为相同字符或数字");
        }
        return undefined;
    };

    const handleResetPassword = async () => {
        if (validatePassword(fristPassword)) {
            return Taro.showToast({
                title: validatePassword(fristPassword) as string,
                duration: 1500,
                icon: "none"
            });
        }
        if (fristPassword != secondPassword) {
            return Taro.showToast({
                title: t("两次密码输入不一致"),
                duration: 1500,
                icon: "none"
            });
        }
        try {
            setIsLoading(true);
            await forgetPassword({
                mobileKey,
                password: fristPassword //新密码
            });
            Taro.showToast({
                title: t("重置密码成功"),
                duration: 1500,
                icon: "none"
            });
            setTimeout(() => {
                void Taro.navigateTo({
                    url: "/pages/login/index?loginType=password"
                });
            }, 1500);
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                duration: 1500,
                icon: "none"
            });
            onStepChange(1);
            onMobileKeyChange("");
            setFristPassword("");
            setSecondPassword("");
        } finally {
            setIsLoading(false);
        }
    };

    const handleToLogin = () => {
        void Taro.navigateTo({
            url: "/pages/login/index"
        });
    };

    return (
        <View>
            <View className="item">
                <Input
                    // 旧 :type="passwordType[0]"（password/text）→ Taro Input password 开关
                    type="text"
                    password={passwordType[0] === "password"}
                    placeholder={t("请输入新密码")}
                    placeholderClass="placeholder"
                    className="text password-text"
                    value={fristPassword}
                    onInput={(e) => setFristPassword(e.detail.value)}
                />
                <View
                    className={"password_show_hide iconfont " + (passwordType[0] == "text" ? "icon-xianshi" : "icon-yincang")}
                    onClick={() => passwordTypeChange(0)}
                />
            </View>
            <View className="item">
                <Input
                    type="text"
                    password={passwordType[1] === "password"}
                    placeholder={t("请再次确认新密码")}
                    placeholderClass="placeholder"
                    className="text password-text"
                    value={secondPassword}
                    onInput={(e) => setSecondPassword(e.detail.value)}
                />
                <View
                    className={"password_show_hide iconfont " + (passwordType[1] == "text" ? "icon-xianshi" : "icon-yincang")}
                    onClick={() => passwordTypeChange(1)}
                />
            </View>

            <View className="btn2-css3">
                {/* 旧 tig-button :loading-text :loading :disabled（已收敛到公共组件） */}
                <TigButton
                    loading={isLoading}
                    loadingText={t("确 认")}
                    disabled={isDisabled}
                    onClick={() => {
                        if (isDisabled) return;
                        void handleResetPassword();
                    }}
                >
                    {t("确 认")}
                </TigButton>
            </View>
            <View className="login-text" onClick={handleToLogin}>
                {t("立即登录")}
            </View>
        </View>
    );
}
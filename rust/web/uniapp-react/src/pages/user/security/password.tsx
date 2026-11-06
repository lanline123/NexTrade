import { useState } from "react";
import { Input, Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import VerificationCode from "@/components/verificationCode/VerificationCode";
import { checkModifyPasswordMobileCode, sendMobileCodeByMobilePassword } from "@/api/user/security";
import { useUserStore } from "@/store/user";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./password.scss";

interface PasswordFormState {
    mobileCode: string;
    password: string;
    confirmPassword: string;
}

/**
 * 修改登录密码页（自旧 pages/user/security/password.vue 逐行移植）
 * - 通过手机验证码验证身份
 * - 设置新密码（6-20位，不能纯数字/纯字母/纯符号）
 * - 修改成功后自动退出登录
 */
export default function SecurityPassword() {
    usePageGuards();

    const router = useRouter();
    const mobile = router.params?.mobile || "";

    const [formState, setFormState] = useState<PasswordFormState>({
        mobileCode: "",
        password: "",
        confirmPassword: ""
    });
    const [verifyToken, setVerifyToken] = useState("");
    const [isChecked] = useState(true);

    const reset = () => {
        setFormState({
            mobileCode: "",
            password: "",
            confirmPassword: ""
        });
    };

    const isRegisterDisabled =
        !mobile || !formState.mobileCode || !formState.password || !formState.confirmPassword || !verifyToken;

    // 旧 uni-forms rules 原样保留；React 无 uni-forms，由 runRules 顺序执行同一条校验链
    const formRules: any = {
        mobileCode: { rules: [{ required: true, message: t("请输入验证码"), trigger: "change" }] },
        password: {
            rules: [
                { required: true, errorMessage: t("请输入新密码") },
                {
                    validateFunction: function (_rule: any, value: any, _data: any, callback: any) {
                        if (!value) {
                            return callback(t("密码不能为空"));
                        } else if (value.length > 20 || value.length < 6) {
                            return callback(t("密码应为6-20位字符"));
                        } else if (/\s/.test(value)) {
                            return callback(t("密码中不允许有空格"));
                        } else if (/^\d+$/.test(value)) {
                            return callback(t("密码不能全为数字"));
                        } else if (!/^(?=.*[\d\W]).+$/.test(value)) {
                            return callback(t("密码不能全为字母"));
                        } else if (!/^(?=.*[a-zA-Z0-9]).+$/.test(value)) {
                            return callback(t("密码不能全为符号"));
                        } else if (!/^(?!([a-zA-Z0-9])\1*$).+$/.test(value)) {
                            return callback(t("密码不能全为相同字符或数字"));
                        }
                        return true;
                    }
                }
            ]
        },
        confirmPassword: {
            rules: [
                { required: true, errorMessage: t("请输入确认密码") },
                {
                    validateFunction: function (_rule: any, value: any, _data: any, callback: any) {
                        if (!value) {
                            return callback(t("请再次输入密码"));
                        } else if (value != formState.password) {
                            return callback(t("两次密码不一致"));
                        }
                        return true;
                    }
                }
            ]
        }
    };

    /** 逐条执行旧 uni-forms 规则，返回第一条错误文案（对应 error-type=toast） */
    const runRules = (value: any, rules: any[]): string | null => {
        for (const rule of rules) {
            if (rule.required && !value) {
                return rule.errorMessage || rule.message || "";
            }
            if (rule.validateFunction) {
                let message: string | null = null;
                const result = rule.validateFunction(rule, value, formState, (msg: string) => {
                    message = msg;
                });
                if (message) return message;
                if (result === false) return rule.message || t("校验失败");
            }
        }
        return null;
    };

    const mobileErrorCallback = (msg: string) => {
        Taro.showToast({
            title: msg,
            duration: 1500,
            icon: "none"
        });
    };

    const onNext = async () => {
        const validateFields: { key: keyof PasswordFormState; rules: any[] }[] = [
            { key: "mobileCode", rules: formRules.mobileCode.rules },
            { key: "password", rules: formRules.password.rules },
            { key: "confirmPassword", rules: formRules.confirmPassword.rules }
        ];
        for (const field of validateFields) {
            const message = runRules(formState[field.key], field.rules);
            if (message) {
                Taro.showToast({
                    title: message,
                    icon: "none"
                });
                return;
            }
        }

        try {
            await checkModifyPasswordMobileCode({
                password: formState.password,
                code: formState.mobileCode
            });

            Taro.showToast({
                title: t("修改成功"),
                icon: "none",
                duration: 1000
            });

            setTimeout(() => {
                void useUserStore.getState().logout();
            }, 1000);
        } catch (error: any) {
            reset();
            if (error.message) {
                Taro.showToast({
                    title: error.message,
                    icon: "none"
                });
            }
        }
    };

    // 旧 onShow 里的 formRef.setRules(formRules) 仅在 uni-forms 内部生效；React 已用 runRules 直接读取最新规则，无需同步

    return (
        <TigLayout title={t("账户安全")}>
            <View className="profile-edit-main">
                <View className="profile-edit-content">
                    <View className="item">
                        <View className="title">
                            <View>{t("请输入")}</View>
                            <View className="info">{mobile.replace(/(\d{2})\d*(\d{4})$/, "$1*****$2")}</View>
                            <View>{t("收到的短信验证码")}</View>
                        </View>
                    </View>
                    <View className="form-list">
                        <View className="form-item">
                            <View className="form-label">
                                <Text className="required">*</Text>
                                {t("验证码")}
                            </View>
                            <View className="form-content">
                                <View className="flex align-center">
                                    <View className="item-one input">
                                        <Input
                                            value={formState.mobileCode}
                                            className="item-input"
                                            focus
                                            placeholder={t("手机短信验证码")}
                                            onInput={(e) =>
                                                setFormState((prev) => ({ ...prev, mobileCode: e.detail.value }))
                                            }
                                        />
                                    </View>
                                    <VerificationCode
                                        isChecked={isChecked}
                                        mobile={mobile}
                                        verifyTokenData={verifyToken}
                                        requestApi={sendMobileCodeByMobilePassword}
                                        needMobile={false}
                                        onVerifyTokenDataChange={setVerifyToken}
                                        onMobileErrorCallback={mobileErrorCallback}
                                    />
                                </View>
                            </View>
                        </View>
                        <View className="form-item">
                            <View className="form-label">
                                <Text className="required">*</Text>
                                {t("新密码")}
                            </View>
                            <View className="form-content">
                                <View className="input">
                                    <Input
                                        password
                                        value={formState.password}
                                        className="item-input"
                                        placeholder={t("请输入新密码")}
                                        onInput={(e) =>
                                            setFormState((prev) => ({ ...prev, password: e.detail.value }))
                                        }
                                    />
                                </View>
                            </View>
                        </View>
                        <View className="form-item">
                            <View className="form-label">
                                <Text className="required">*</Text>
                                {t("确认密码")}
                            </View>
                            <View className="form-content">
                                <View className="input">
                                    <Input
                                        password
                                        value={formState.confirmPassword}
                                        className="item-input"
                                        placeholder={t("请再次输入新密码")}
                                        onInput={(e) =>
                                            setFormState((prev) => ({ ...prev, confirmPassword: e.detail.value }))
                                        }
                                    />
                                </View>
                            </View>
                        </View>
                    </View>
                    <View className="item">
                        <TigButton2 theme className="next" disabled={isRegisterDisabled} onClick={() => onNext()}>
                            {t("提交")}
                        </TigButton2>
                    </View>
                </View>
                <View className="profile-edit-content">
                    <View className="btn-item">
                        <View className="title">
                            <View className="big-title">{t("为什么要进行身份验证")}？</View>
                        </View>
                        <View className="info">1. {t("为保障您的账户信息安全，在变更账户中的重要信息时需要进行身份验证，感谢您的理解和支持")}。</View>
                        <View className="info">2. {t("验证身份遇到问题？您可以通知我们的客服，我们将尽快联系您")}。</View>
                    </View>
                </View>
            </View>
        </TigLayout>
    );
}
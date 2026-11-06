import { useState } from "react";
import Taro from "@tarojs/taro";
import { Input, View } from "@tarojs/components";

import TigMobileAreacode from "@/components/tig/tig-mobile-areacode/TigMobileAreacode";
import VerificationCode from "@/components/verificationCode/VerificationCode";
import { checkEmail, checkMobile, sendEmailCode, sendMobileCode } from "@/api/login/login";
import { useConfigStore } from "@/store/config";
import { t } from "@/utils/i18n";

import "./StepOne.scss";

interface Props {
    /** 旧 v-model:step */
    step: number;
    onStepChange: (step: number) => void;
    /** 旧 v-model:mobile-key */
    mobileKey: string;
    onMobileKeyChange: (mobileKey: string) => void;
}

/**
 * 找回密码第一步（自旧 pages/reset/src/stepOne.vue 移植）
 * - 手机号 / 邮箱找回切换（openEmailRegister=1 时展示切换按钮）
 * - 手机号 + 短信验证码 / 邮箱 + 邮箱验证码
 * - 校验通过后写入 mobileKey 并进入第二步
 */
export default function StepOne({ onStepChange, onMobileKeyChange }: Props) {
    const configStore = useConfigStore();
    const isOpenMobileAreaCode = useConfigStore((s) => s.isOpenMobileAreaCode);
    const openEmailRegister = useConfigStore((s) => s.openEmailRegister);

    const [mobileAreaCode, setMobileAreaCode] = useState("86");
    const [isChecked, setIsChecked] = useState(true);
    const [verifyToken, setVerifyToken] = useState("");
    const [email, setEmail] = useState("");
    const [emailCode, setEmailCode] = useState("");
    const [mobile, setMobile] = useState("");
    const [mobileCode, setMobileCode] = useState("");

    const [formState, setFormState] = useState({
        registType: "mobile" // 默认是手机号找回
    });
    const [isLoading, setIsLoading] = useState(false);

    // 旧 computed isDisabled（模板未直接使用，保留供后续步进校验复用）
    const isDisabled = !mobile || !mobileCode || isLoading;
    void isDisabled;

    const mobileErrorCallback = (msg: string) => {
        Taro.showToast({
            title: msg,
            duration: 1500,
            icon: "none"
        });
    };

    const registerTypeChange = (type: string) => {
        setFormState((prev) => ({ ...prev, registType: type }));
        if (type === "email") {
            setEmail("");
            setEmailCode("");
        } else {
            setMobile("");
            setMobileCode("");
            setMobileAreaCode("86"); // 重置手机号区号为默认值
        }
    };

    const handleNext = async () => {
        if (formState.registType === "email") {
            if (!email) {
                return Taro.showToast({
                    title: t("请输入邮箱"),
                    duration: 1500,
                    icon: "none"
                });
            }
            if (!emailCode) {
                return Taro.showToast({
                    title: t("请输入邮箱验证码"),
                    duration: 1500,
                    icon: "none"
                });
            }
        } else {
            if (!mobile) {
                return Taro.showToast({
                    title: t("请输入手机号"),
                    duration: 1500,
                    icon: "none"
                });
            }
            if (!mobileCode) {
                return Taro.showToast({
                    title: t("请输入手机验证码"),
                    duration: 1500,
                    icon: "none"
                });
            }
        }
        setIsLoading(true);
        try {
            const temp = {
                mobile: isOpenMobileAreaCode ? mobileAreaCode + mobile : mobile,
                code: mobileCode
            };
            const tempEmail = {
                email,
                code: emailCode
            };
            // 这里根据类型调用不同接口
            let result;
            if (formState.registType === "email") {
                result = await checkEmail(tempEmail);
            } else {
                result = await checkMobile(temp);
            }
            onMobileKeyChange(formState.registType === "email" ? result : result);
            onStepChange(2);
        } catch (error: any) {
            console.error(error);
            Taro.showToast({
                title: error.message,
                duration: 1500,
                icon: "none"
            });
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
            {formState.registType === "mobile" ? (
                <View>
                    <View className="item">
                        <View className="text mobileareacode-box">
                            {!!isOpenMobileAreaCode && <TigMobileAreacode value={mobileAreaCode} onChange={setMobileAreaCode} />}
                            <Input
                                type="text"
                                value={mobile}
                                placeholder={t("请输入手机号")}
                                placeholderClass="placeholder"
                                className="mobile-text"
                                onInput={(e) => setMobile(e.detail.value)}
                            />
                        </View>
                    </View>
                    <View className="item mobile_code_text">
                        <View style="flex: 1; margin-right: 10rpx">
                            <Input
                                type="text"
                                placeholder={t("手机短信验证码")}
                                placeholderClass="placeholder"
                                value={mobileCode}
                                name="mobile_code"
                                className="text"
                                onInput={(e) => setMobileCode(e.detail.value)}
                            />
                        </View>
                        <View style="height: 65rpx; width: 200rpx; flex-shrink: 0;">
                            <VerificationCode
                                isChecked={isChecked}
                                onVerifyTokenDataChange={setVerifyToken}
                                mobile={isOpenMobileAreaCode ? mobileAreaCode + mobile : mobile}
                                event="forgetPassword"
                                requestApi={sendMobileCode}
                                onMobileErrorCallback={mobileErrorCallback}
                            />
                        </View>
                    </View>
                </View>
            ) : (
                <View>
                    <View className="item">
                        <View className="text mobileareacode-box">
                            <Input
                                type="text"
                                placeholder={t("请输入邮箱")}
                                placeholderClass="placeholder"
                                value={email}
                                name="mobile_code"
                                className="mobile-text"
                                onInput={(e) => setEmail(e.detail.value)}
                            />
                        </View>
                    </View>
                    <View className="item mobile_code_text">
                        <View style="flex: 1; margin-right: 10rpx">
                            <Input
                                type="text"
                                placeholder={t("邮箱验证码")}
                                placeholderClass="placeholder"
                                value={emailCode}
                                name="mobile_code"
                                className="text"
                                onInput={(e) => setEmailCode(e.detail.value)}
                            />
                        </View>
                        <View style="height: 65rpx; width: 200rpx; flex-shrink: 0;">
                            <VerificationCode
                                isChecked={isChecked}
                                email={email}
                                onVerifyTokenDataChange={setVerifyToken}
                                event="forgetPassword"
                                requestApi={sendEmailCode}
                                onMobileErrorCallback={mobileErrorCallback}
                            />
                        </View>
                    </View>
                </View>
            )}

            <View className="btn2-css3">
                {/* 旧 tig-button :loading-text :loading → 按视觉等价 View（TODO(MIGRATION)：随公共 tig-button 统一替换） */}
                <View
                    className={`btn2-css3__inner${isLoading ? " is-loading" : ""}`}
                    onClick={() => {
                        if (isLoading) return;
                        void handleNext();
                    }}
                >
                    {t("下 一 步")}
                </View>
            </View>

            <View className={`bottom-bar${configStore.openEmailRegister !== 1 ? " bottom-bar-single" : ""}`}>
                {configStore.openEmailRegister === 1 && (
                    <View className="change-btn" onClick={() => registerTypeChange(formState.registType === "email" ? "mobile" : "email")}>
                        {formState.registType === "email" ? t("手机号找回") : t("邮箱找回")}
                    </View>
                )}
                <View className="login-text" onClick={handleToLogin}>
                    {t("立即登录")}
                </View>
            </View>
        </View>
    );
}
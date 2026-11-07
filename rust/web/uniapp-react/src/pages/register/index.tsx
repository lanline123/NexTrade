import { useEffect, useRef, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { View, Text, Input } from "@tarojs/components";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigMobileAreacode from "@/components/tig/tig-mobile-areacode/TigMobileAreacode";
import VerificationCode, { type VerificationCodeRef } from "@/components/verificationCode/VerificationCode";
import TigButton from "@/components/tig/tig-button/TigButton";
import Checkbox from "@/pages/cart/src/Checkbox";
import { sendMobileCode, sendEmailCode } from "@/api/login/login";
import { userRegist } from "@/api/user/regist";
import { useConfigStore } from "@/store/config";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./index.scss";

/**
 * 注册页（自旧 pages/register/index.vue 移植）
 * - 邮箱 / 手机号双通道注册（openEmailRegister=1 时展示切换按钮）
 * - 验证码（VerificationCode：协议勾选 + 滑块验证 + 60s 倒计时）
 * - 原 uni-forms 校验规则（手机号/验证码/密码）改由 onSubmit 前置校验，规则逐条平移
 */
export default function Register() {
    usePageGuards();

    const configStore = useConfigStore();

    const [mobileAreaCode, setMobileAreaCode] = useState("86");

    // 原 useResettableRef formState + reset
    const initialFormState = {
        mobile: "",
        mobileCode: "",
        password: "",
        registType: "",
        email: "",
        emailCode: ""
    };
    const [formState, setFormState] = useState(initialFormState);
    const reset = () => setFormState(initialFormState);

    const [isChecked, setIsChecked] = useState(false);
    const [verifyToken, setVerifyToken] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);
    const verificationCodeRef = useRef<VerificationCodeRef | null>(null);

    const isRegisterDisabled =
        formState.registType === "email"
            ? !formState.email || !formState.emailCode || !formState.password || !verifyToken
            : !formState.mobile || !formState.mobileCode || !formState.password || !verifyToken;

    const registerTypeChange = (type: string) => {
        reset();
        setFormState((prev) => ({ ...prev, registType: type }));
    };

    // ===== 原 uni-forms rules 校验函数逐条平移 =====
    const validateMobile = (value: string): string | null => {
        if (!value) {
            return t("手机号不能为空");
        } else if (/^(?=.*\D).+$/.test(value)) {
            return t("格式错误，请输入正确的手机号码");
        }
        return null;
    };

    const validateCode = (value: string): string | null => {
        if (!value) {
            return t("验证码不能为空");
        } else if (value.length != 6) {
            return t("请输入6位验证码");
        }
        return null;
    };

    const validatePassword = (value: string): string | null => {
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
        return null;
    };

    // 对应旧 formRef.validate()：uni-forms 仅校验当前渲染分支内注册了 name 的 uni-forms-item，
    // email 分支只有 password 项带规则；mobile 分支校验 mobile/mobileCode/password（required + validateFunction，首个错误即返回）
    const validate = (): string | null => {
        const isEmail = formState.registType === "email";
        if (isEmail) {
            return validatePassword(formState.password);
        }
        if (!formState.mobile) return t("请输入手机号");
        const mobileErr = validateMobile(formState.mobile);
        if (mobileErr) return mobileErr;
        if (!formState.mobileCode) return t("请输入验证码");
        const codeErr = validateCode(formState.mobileCode);
        if (codeErr) return codeErr;
        if (!formState.password) return t("请输入密码");
        const pwdErr = validatePassword(formState.password);
        if (pwdErr) return pwdErr;
        return null;
    };

    const onRegister = async () => {
        const firstError = validate();
        if (firstError) {
            console.error("表单错误信息：", firstError);
            return;
        }
        try {
            setLoginLoading(true);
            const bindSalesmanId = Taro.getStorageSync("bindSalesmanId");
            const data: any = {
                ...formState
            };

            if (bindSalesmanId) {
                data.salesmanId = bindSalesmanId;
            }

            if (formState.mobile) {
                data.mobile = configStore.isOpenMobileAreaCode ? mobileAreaCode + formState.mobile : formState.mobile;
            }

            await userRegist(data);
            Taro.removeStorageSync("bindSalesmanId");
            Taro.showToast({
                title: t("注册成功"),
                duration: 1500,
                icon: "none"
            });
            setTimeout(() => {
                // 一秒后执行这里的代码
                Taro.redirectTo({
                    url: "/pages/login/index"
                });
            }, 1000);
        } catch (error: any) {
            setFormState((prev) => ({ ...prev, emailCode: "", mobileCode: "" }));
            Taro.showToast({
                title: error.message,
                duration: 1500,
                icon: "none"
            });
        } finally {
            setLoginLoading(false);
        }
    };

    // 对应旧 onShow
    useDidShow(() => {
        if (Taro.getStorageSync("token")) {
            Taro.reLaunch({
                url: "/pages/index/index"
            });
        }
        // 旧 nextTick(() => formRef.setRules(formRules))：uni-forms 专属，React 版校验见 validate()
    });

    const mobileErrorCallback = (msg: string) => {
        Taro.showToast({
            title: msg,
            duration: 1500,
            icon: "none"
        });
    };

    const handleLink = (url: string) => {
        if (!url) return;
        redirect({
            url: url
        });
    };

    return (
        <TigLayout title={t("注册")}>
            <View className="register-container">
                <View className="register-warp">
                    <View className="h1_tit">{t("会员注册")}</View>
                </View>
                <View className="profile-edit-content" data-form-rev="MjI4MmZ5ZGs">
                    {formState.registType === "email" ? (
                        <>
                            <View className="form-item">
                                <View className="input mobileareacode-box">
                                    {/* 原 uni-easyinput v-model="formState.email" focus :input-border="false" → Taro Input */}
                                    <Input
                                        value={formState.email}
                                        focus
                                        type="text"
                                        className="uni-input item-input"
                                        placeholderStyle="font-size: 28rpx;"
                                        placeholderClass="placeholder"
                                        placeholder={t("请输入邮箱")}
                                        onInput={(e) => setFormState((prev) => ({ ...prev, email: e.detail.value }))}
                                    />
                                </View>
                            </View>

                            <View className="form-item">
                                <View className="item-one">
                                    <Input
                                        value={formState.emailCode}
                                        type="text"
                                        className="uni-input item-input input"
                                        placeholderStyle="font-size: 28rpx;"
                                        placeholderClass="placeholder"
                                        placeholder={t("邮箱验证码")}
                                        onInput={(e) => setFormState((prev) => ({ ...prev, emailCode: e.detail.value }))}
                                    />
                                    <View style={{ height: "65rpx", width: "200rpx", flexShrink: 0, marginLeft: "20rpx" }}>
                                        <VerificationCode
                                            ref={verificationCodeRef}
                                            isChecked={isChecked}
                                            onVerifyTokenDataChange={setVerifyToken}
                                            email={formState.email}
                                            requestApi={sendEmailCode}
                                            onMobileErrorCallback={mobileErrorCallback}
                                        />
                                    </View>
                                </View>
                            </View>
                        </>
                    ) : (
                        <>
                            <View className="form-item">
                                <View className="input mobileareacode-box">
                                    {!!configStore.isOpenMobileAreaCode && (
                                        <TigMobileAreacode
                                            value={mobileAreaCode}
                                            onChange={setMobileAreaCode}
                                            labelStyle={{ fontSize: "28rpx" }}
                                            nameStyle={{ fontSize: "24rpx", padding: "0 2rpx 0 10rpx" }}
                                            boxStyle={{ paddingRight: "0" }}
                                            iconStyle={{ fontSize: "22rpx" }}
                                        />
                                    )}
                                    <Input
                                        value={formState.mobile}
                                        focus
                                        type="text"
                                        className="uni-input item-input"
                                        placeholderStyle="font-size: 28rpx;"
                                        placeholderClass="placeholder"
                                        placeholder={t("请输入手机号")}
                                        onInput={(e) => setFormState((prev) => ({ ...prev, mobile: e.detail.value }))}
                                    />
                                </View>
                            </View>

                            <View className="form-item">
                                <View className="item-one">
                                    <Input
                                        value={formState.mobileCode}
                                        type="text"
                                        className="uni-input item-input input"
                                        placeholderStyle="font-size: 28rpx;"
                                        placeholderClass="placeholder"
                                        placeholder={t("手机验证码")}
                                        onInput={(e) => setFormState((prev) => ({ ...prev, mobileCode: e.detail.value }))}
                                    />
                                    <View style={{ height: "65rpx", width: "200rpx", flexShrink: 0, marginLeft: "20rpx" }}>
                                        <VerificationCode
                                            ref={verificationCodeRef}
                                            isChecked={isChecked}
                                            onVerifyTokenDataChange={setVerifyToken}
                                            mobile={configStore.isOpenMobileAreaCode ? mobileAreaCode + formState.mobile : formState.mobile}
                                            requestApi={sendMobileCode}
                                            onMobileErrorCallback={mobileErrorCallback}
                                        />
                                    </View>
                                </View>
                            </View>
                        </>
                    )}

                    <View className="form-item">
                        <View className="input">
                            {/* 旧 uni-easyinput type="password"：Taro Input 的 type 不含 password，以 password prop 等价实现 */}
                            <Input
                                value={formState.password}
                                type="text"
                                password
                                className="uni-input item-input"
                                placeholderStyle="font-size: 28rpx;"
                                placeholderClass="placeholder"
                                placeholder={t("请输入密码")}
                                onInput={(e) => setFormState((prev) => ({ ...prev, password: e.detail.value }))}
                            />
                        </View>
                    </View>
                    <View className="form-item">
                        <View className="btn">
                            {configStore.openEmailRegister === 1 && (
                                <View className="change-btn" onClick={() => registerTypeChange(formState.registType === "email" ? "mobile" : "email")}>
                                    {formState.registType === "email" ? t("切换为手机号注册") : t("切换为邮箱注册")}
                                </View>
                            )}
                            <View
                                className="btn-text"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleLink("/pages/login/index");
                                }}
                            >
                                <View>{t("已有账号？")}</View>
                            </View>
                        </View>
                    </View>
                </View>
                <View className="form-con">
                    {/* 旧 tig-button :disabled :loading class="btn2-css3"（已收敛到公共组件） */}
                    <TigButton
                        className="btn2-css3"
                        disabled={isRegisterDisabled}
                        loading={loginLoading}
                        onClick={() => {
                            if (isRegisterDisabled || loginLoading) return;
                            onRegister();
                        }}
                    >
                        {t("注 册")}
                    </TigButton>
                </View>
                <View className="agreement-btn">
                    <Checkbox checked={isChecked} onChange={() => setIsChecked(!isChecked)} />
                    <Text className="tip-txt" onClick={() => setIsChecked(!isChecked)}>
                        {t("我已阅读并同意")}
                    </Text>
                    <Text
                        className="agreement-text special-color"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleLink("/pages/register/agreement");
                        }}
                    >
                        {t("《注册协议》")}{" "}
                    </Text>
                    <Text
                        className="special-color"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleLink("/pages/login/mallAgreement?articleSn=fwxy");
                        }}
                    >
                        《{t("服务协议")}》
                    </Text>
                    <Text
                        className="special-color"
                        onClick={(e) => {
                            e.stopPropagation();
                            handleLink("/pages/login/mallAgreement?articleSn=ysxy");
                        }}
                    >
                        《{t("隐私协议")}》
                    </Text>
                </View>
            </View>
        </TigLayout>
    );
}

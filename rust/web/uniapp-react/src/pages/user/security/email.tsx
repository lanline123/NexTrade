import { useEffect, useRef, useState } from "react";
import { Input, Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import VerificationCode from "@/components/verificationCode/VerificationCode";
import { emailEmailValidate, emailValidate, sendEmailCodeByEmailValidate, sendEmailCodeByModifyEmail } from "@/api/user/security";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./email.scss";

/**
 * 邮箱绑定/换绑页（自旧 pages/user/security/email.vue 逐行移植）
 * - 已绑定：先验证原邮箱，再输入新邮箱完成换绑
 * - 未绑定：直接输入邮箱验证绑定
 */
export default function SecurityEmail() {
    usePageGuards();

    const router = useRouter();
    const [email, setEmail] = useState("");
    const [emailNew, setEmailNew] = useState("");
    const [emailCodeNew, setEmailCodeNew] = useState("");
    const [emailCode, setEmailCode] = useState("");
    const [verifyToken, setVerifyToken] = useState("");
    const [isChecked] = useState(true);
    const [hasEmail, setHasEmail] = useState(false);
    const [isBind, setIsBind] = useState(false);
    const loadedRef = useRef(false);

    useEffect(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;
        const emailParam = router.params?.email;
        if (emailParam) {
            setHasEmail(true);
            setEmail(emailParam);
        } else {
            setHasEmail(false);
        }
        // 仅挂载执行一次（对应旧 onLoad）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isRegisterDisabled = !emailCode || !verifyToken;

    const mobileErrorCallback = (msg: string) => {
        Taro.showToast({
            title: msg,
            duration: 1500,
            icon: "none"
        });
    };

    const onBinding = async () => {
        try {
            let temp = {
                email: email,
                code: emailCode
            };
            await emailEmailValidate({ ...temp });
            Taro.showToast({
                title: t("绑定成功"),
                icon: "none"
            });
            let url = "/pages/member/index";
            Taro.navigateTo({
                url
            });
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    const onEmailValidateNew = async () => {
        try {
            await emailValidate({
                email: email,
                code: emailCode
            });

            setIsBind(true);
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
            console.error("Email validation failed:", error);
        }
    };

    const onNext = async () => {
        if (!isBind) {
            return await onEmailValidateNew();
        }
        try {
            let temp = {
                email: !isBind ? email : emailNew,
                code: !isBind ? emailCode : emailCodeNew
            };
            await emailEmailValidate({ ...temp });
            Taro.showToast({
                title: t("绑定成功"),
                icon: "none"
            });
            let url = "/pages/member/index";
            Taro.navigateTo({
                url
            });
        } catch (error: any) {
            Taro.showToast({
                title: error.message,
                icon: "none"
            });
        }
    };

    return (
        <TigLayout title={t("账户安全")}>
            <View className="profile-edit-main">
                <View className="profile-edit-content">
                    {isBind ? (
                        <>
                            <View className="item special-item line">
                                <Input
                                    value={emailNew}
                                    focus
                                    className="item-input"
                                    placeholder={t("请输入新邮箱")}
                                    onInput={(e) => setEmailNew(e.detail.value)}
                                />
                            </View>
                            <View className="flex align-center">
                                <View className="item line">
                                    <Input
                                        value={emailCodeNew}
                                        placeholder={t("新邮箱验证码")}
                                        onInput={(e) => setEmailCodeNew(e.detail.value)}
                                    />
                                </View>
                                <VerificationCode
                                    isChecked={isChecked}
                                    email={emailNew}
                                    verifyTokenData={verifyToken}
                                    requestApi={sendEmailCodeByModifyEmail}
                                    onVerifyTokenDataChange={setVerifyToken}
                                    onMobileErrorCallback={mobileErrorCallback}
                                />
                            </View>
                        </>
                    ) : (
                        <>
                            {hasEmail ? (
                                <View className="item">
                                    <View className="title">
                                        <View>{t("请输入")}</View>
                                        <View className="info">{email.replace(/(\w{2})[\w.-]*@/, "$1*****@")}</View>
                                        <View>{t("收到的短信验证码")}</View>
                                    </View>
                                </View>
                            ) : (
                                <>
                                    <View className="item">
                                        <View className="title">
                                            <View>{t("您还未绑定邮箱，请输入邮箱绑定")}</View>
                                        </View>
                                    </View>
                                    <View className="item special-item line">
                                        <Input
                                            value={email}
                                            className="item-input"
                                            placeholder={t("请输入邮箱")}
                                            onInput={(e) => setEmail(e.detail.value)}
                                        />
                                    </View>
                                </>
                            )}

                            <View className="flex align-center">
                                <View className="item line">
                                    <Input value={emailCode} placeholder={t("邮箱验证码")} onInput={(e) => setEmailCode(e.detail.value)} />
                                </View>
                                {hasEmail ? (
                                    <VerificationCode
                                        isChecked={isChecked}
                                        email={email}
                                        verifyTokenData={verifyToken}
                                        requestApi={sendEmailCodeByEmailValidate}
                                        onVerifyTokenDataChange={setVerifyToken}
                                        onMobileErrorCallback={mobileErrorCallback}
                                    />
                                ) : (
                                    <VerificationCode
                                        isChecked={isChecked}
                                        email={email}
                                        verifyTokenData={verifyToken}
                                        requestApi={sendEmailCodeByModifyEmail}
                                        onVerifyTokenDataChange={setVerifyToken}
                                        onMobileErrorCallback={mobileErrorCallback}
                                    />
                                )}
                            </View>
                        </>
                    )}
                    {!hasEmail ? (
                        <View className="item" style={{ height: "60rpx" }}>
                            <TigButton2 theme className="next" disabled={isRegisterDisabled} onClick={onBinding}>
                                {t("下一步")}
                            </TigButton2>
                        </View>
                    ) : (
                        <View className="item" style={{ height: "60rpx" }}>
                            <TigButton2 theme className="next" disabled={isRegisterDisabled} onClick={onNext}>
                                {t("下一步")}
                            </TigButton2>
                        </View>
                    )}
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
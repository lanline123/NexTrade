import { useEffect, useRef, useState } from "react";
import { Input, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigMobileAreacode from "@/components/tig/tig-mobile-areacode/TigMobileAreacode";
import VerificationCode from "@/components/verificationCode/VerificationCode";
import { mobileMobile, mobileValidate, sendMobileCodeByMobileMobile, sendMobileCodeByMobileValidate } from "@/api/user/security";
import { useConfigStore } from "@/store/config";
import { isOverseas, redirect } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./phone.scss";

/**
 * 手机号绑定/换绑页（自旧 pages/user/security/phone.vue 逐行移植）
 * - 已绑定：验证原手机号短信验证码，跳转换绑新手机
 * - 未绑定：直接输入新手机号并验证绑定
 */
export default function SecurityPhone() {
    usePageGuards();

    const router = useRouter();
    const isOpenMobileAreaCode = useConfigStore((s) => s.isOpenMobileAreaCode);

    const [mobileCode, setMobileCode] = useState("");
    const [mobile, setMobile] = useState("");
    const [mobileAreaCode, setMobileAreaCode] = useState("86");
    const [verifyToken, setVerifyToken] = useState("");
    const [isChecked] = useState(true);
    const [hasMobile, setHasMobile] = useState(false);
    const loadedRef = useRef(false);

    useEffect(() => {
        if (loadedRef.current) return;
        loadedRef.current = true;
        const mobileParam = router.params?.mobile;
        if (mobileParam) {
            setHasMobile(true);
            setMobile(mobileParam);
        } else {
            setHasMobile(false);
        }
        // 仅挂载执行一次（对应旧 onLoad）
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const isRegisterDisabled = !mobileCode || !verifyToken;

    const mobileForRequest = !hasMobile && isOverseas() && isOpenMobileAreaCode ? mobileAreaCode + mobile : mobile;

    const mobileErrorCallback = (msg: string) => {
        Taro.showToast({
            title: msg,
            duration: 1500,
            icon: "none"
        });
    };

    const onNext = async () => {
        try {
            let temp = {
                mobile: mobile,
                code: mobileCode
            };
            if (hasMobile) {
                await mobileValidate({ code: mobileCode });
                redirect({
                    url: "/pages/user/security/newPhone"
                });
            } else {
                await mobileMobile({ ...temp, mobile: mobileForRequest });
                Taro.showToast({
                    title: t("绑定成功"),
                    icon: "none"
                });
                redirect({
                    url: "/pages/member/index"
                });
            }
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
                    {hasMobile ? (
                        <View className="item">
                            <View className="title">
                                <View>{t("请输入")}</View>
                                <View className="info">{mobile.replace(/(\d{2})\d*(\d{4})$/, "$1*****$2")}</View>
                                <View>{t("收到的短信验证码")}</View>
                            </View>
                        </View>
                    ) : (
                        <>
                            <View className="item">
                                <View className="title">
                                    <View>{t("您还未绑定手机号，请输入手机号绑定")}</View>
                                </View>
                            </View>
                            <View className="item special-item line">
                                <View className="mobile-input-wrap">
                                    {isOverseas() && isOpenMobileAreaCode === 1 && (
                                        <TigMobileAreacode value={mobileAreaCode} onChange={setMobileAreaCode} />
                                    )}
                                    <Input
                                        value={mobile}
                                        focus={!hasMobile}
                                        className="item-input"
                                        placeholder={t("请输入手机号")}
                                        onInput={(e) => setMobile(e.detail.value)}
                                    />
                                </View>
                            </View>
                        </>
                    )}

                    <View className="flex align-center">
                        <View className="item line">
                            <Input
                                value={mobileCode}
                                focus={hasMobile}
                                placeholder={t("手机短信验证码")}
                                onInput={(e) => setMobileCode(e.detail.value)}
                            />
                        </View>
                        {hasMobile ? (
                            <VerificationCode
                                isChecked={isChecked}
                                verifyTokenData={verifyToken}
                                mobile={mobileForRequest}
                                requestApi={sendMobileCodeByMobileValidate}
                                needMobile={false}
                                onVerifyTokenDataChange={setVerifyToken}
                                onMobileErrorCallback={mobileErrorCallback}
                            />
                        ) : (
                            <VerificationCode
                                isChecked={isChecked}
                                verifyTokenData={verifyToken}
                                mobile={mobileForRequest}
                                requestApi={sendMobileCodeByMobileMobile}
                                onVerifyTokenDataChange={setVerifyToken}
                                onMobileErrorCallback={mobileErrorCallback}
                            />
                        )}
                    </View>

                    <View className="item" style={{ height: "60rpx" }}>
                        <TigButton2 theme className="next" disabled={isRegisterDisabled} onClick={onNext}>
                            {t("下一步")}
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
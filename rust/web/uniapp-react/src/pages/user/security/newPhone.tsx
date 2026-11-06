import { useState } from "react";
import { Input, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigMobileAreacode from "@/components/tig/tig-mobile-areacode/TigMobileAreacode";
import VerificationCode from "@/components/verificationCode/VerificationCode";
import { mobileMobile, sendMobileCodeByMobileMobile } from "@/api/user/security";
import { useConfigStore } from "@/store/config";
import { isOverseas } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./newPhone.scss";

/**
 * 绑定新手机号页（自旧 pages/user/security/newPhone.vue 逐行移植）
 * - 验证原手机后跳转到此页
 * - 输入新手机号并验证短信验证码
 * - 绑定成功后跳转个人资料页
 */
export default function SecurityNewPhone() {
    usePageGuards();

    const isOpenMobileAreaCode = useConfigStore((s) => s.isOpenMobileAreaCode);

    const [mobileCode, setMobileCode] = useState("");
    const [mobile, setMobile] = useState("");
    const [mobileAreaCode, setMobileAreaCode] = useState("86");
    const [verifyToken, setVerifyToken] = useState("");
    const [isChecked] = useState(true);

    const isRegisterDisabled = !mobile || !mobileCode;

    const mobileForRequest = isOverseas() && isOpenMobileAreaCode === 1 ? mobileAreaCode + mobile : mobile;

    const mobileErrorCallback = (msg: string) => {
        Taro.showToast({
            title: msg,
            duration: 1500,
            icon: "none"
        });
    };

    const onsubmit = async () => {
        try {
            let temp = {
                mobile: mobile,
                code: mobileCode
            };
            await mobileMobile({ ...temp, mobile: mobileForRequest });

            Taro.showToast({
                title: t("修改成功"),
                icon: "none"
            });

            setTimeout(() => {
                // 一秒后执行这里的代码
                Taro.redirectTo({
                    url: "/pages/user/profile/index"
                });
            }, 1000);
        } catch (error: any) {
            if (error.message) {
                Taro.showToast({
                    title: error.message,
                    icon: "none"
                });
            }
        }
    };

    return (
        <TigLayout title={t("账户安全")}>
            <View className="profile-edit-main">
                <View className="profile-edit-content">
                    <View className="item input">
                        <View className="mobile-input-wrap">
                            {isOverseas() && isOpenMobileAreaCode === 1 && (
                                <TigMobileAreacode value={mobileAreaCode} onChange={setMobileAreaCode} />
                            )}
                            <Input
                                value={mobile}
                                className="item-input"
                                placeholder={t("请输入新手机号")}
                                onInput={(e) => setMobile(e.detail.value)}
                            />
                        </View>
                    </View>
                    <View className="flex align-center">
                        <View className="item line">
                            <Input
                                value={mobileCode}
                                className="item-input"
                                focus
                                placeholder={t("新手机短信验证码")}
                                onInput={(e) => setMobileCode(e.detail.value)}
                            />
                        </View>
                        <VerificationCode
                            isChecked={isChecked}
                            verifyTokenData={verifyToken}
                            mobile={mobileForRequest}
                            requestApi={sendMobileCodeByMobileMobile}
                            onVerifyTokenDataChange={setVerifyToken}
                            onMobileErrorCallback={mobileErrorCallback}
                        />
                    </View>
                    <View className="item" style={{ height: "60rpx" }}>
                        <TigButton2 theme className="next" disabled={isRegisterDisabled} onClick={onsubmit}>
                            {t("提交")}
                        </TigButton2>
                    </View>
                </View>
            </View>
        </TigLayout>
    );
}
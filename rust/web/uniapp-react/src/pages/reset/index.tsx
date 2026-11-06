import { useState } from "react";
import { View } from "@tarojs/components";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";
import StepOne from "./src/StepOne";
import StepTow from "./src/StepTow";

import "./index.scss";

/**
 * 找回密码（自旧 pages/reset/index.vue 移植）
 * - 步骤一：验证手机号/邮箱 + 验证码
 * - 步骤二：设置新密码
 */
export default function Reset() {
    usePageGuards();

    const [step, setStep] = useState(1);
    const [mobileKey, setMobileKey] = useState("");

    return (
        <View className="reset-page">
            <TigLayout title={t("找回密码")}>
                <View className="plr-40 reset-body-cTIyODJ5YmM">
                    <View className="h1_tit">{t("找回密码")}</View>
                    {step === 1 && <StepOne step={step} onStepChange={setStep} mobileKey={mobileKey} onMobileKeyChange={setMobileKey} />}
                    {/* TODO(MIGRATION)：旧 <up-transition :show="step === 2" mode="fade-left" /> 的滑入动画未移植，按显隐条件等价渲染 */}
                    {step === 2 && <StepTow step={step} onStepChange={setStep} mobileKey={mobileKey} onMobileKeyChange={setMobileKey} />}
                </View>
            </TigLayout>
        </View>
    );
}
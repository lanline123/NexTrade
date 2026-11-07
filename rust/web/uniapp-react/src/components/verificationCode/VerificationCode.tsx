import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { View, Text } from "@tarojs/components";
import Taro from "@tarojs/taro";

import Verify from "@/components/verifition/Verify";
import TigButton from "@/components/tig/tig-button/TigButton";
import { useConfigStore } from "@/store/config";
import { isOverseas } from "@/utils";
import { t } from "@/utils/i18n";

import "./VerificationCode.scss";

interface Props {
    email?: string;
    mobile?: string;
    needMobile?: boolean;
    requestApi: (data: any) => Promise<any>;
    isChecked?: boolean;
    verifyTokenData?: string | null;
    event?: string;
    btnType?: "button" | "text";
    onMobileErrorCallback?: (msg: string) => void;
    /** 原 v-model:verify-token-data（发送成功后回写 token，失败清空） */
    onVerifyTokenDataChange?: (token: string) => void;
}

export interface VerificationCodeRef {
    handBtn: () => Promise<void> | void;
}

/**
 * 验证码发送组件（自旧 components/verificationCode/index.vue 移植）
 * - 按钮 + 图形滑块验证（Verify）+ 60s 倒计时（原 uview up-code 以自实现倒计时等价重写）
 * - 协议未勾选/手机号邮箱校验不通过时回调 onMobileErrorCallback
 */
const VerificationCode = forwardRef<VerificationCodeRef, Props>(function VerificationCode(
    { email = "", mobile = "", needMobile = true, requestApi, isChecked = false, verifyTokenData = null, event = "login", btnType = "button", onMobileErrorCallback, onVerifyTokenDataChange },
    ref
) {
    const configStore = useConfigStore();
    const [btnText, setBtnText] = useState("");
    const [btnDisabled, setBtnDisabled] = useState(false);
    const [verifyToken, setVerifyToken] = useState<string | null>(null);
    const verifyRef = useRef<{ show: () => void; refresh: () => void } | null>(null);

    // ===== 原 up-code（uview 验证码倒计时）等价重写：seconds=60，start/end/change 语义对齐 =====
    const UP_CODE_SECONDS = 60;
    const [codeCountdown, setCodeCountdown] = useState(0); // >0 表示倒计时进行中（对应 up-code isRunning/canGetCode）
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
            }
        };
    }, []);

    /** up-code @change：X秒重新获取 */
    const codeChange = (seconds: number) => {
        setBtnText(t("X秒重新获取").replace("X", String(seconds)));
    };
    /** up-code @start */
    const codeStart = () => {
        setBtnDisabled(true);
        setCodeCountdown(UP_CODE_SECONDS);
        codeChange(UP_CODE_SECONDS);
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            setCodeCountdown((prev) => {
                const next = prev - 1;
                if (next <= 0) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    codeEnd();
                    return 0;
                }
                codeChange(next);
                return next;
            });
        }, 1000);
    };
    /** up-code @end */
    const codeEnd = () => {
        setBtnDisabled(false);
        setBtnText(t("获取验证码"));
    };
    /** up-code canGetCode */
    const canGetCode = () => codeCountdown <= 0;

    useEffect(() => {
        // 初始文案（对齐 up-code start-text 默认展示）
        setBtnText(t("获取验证码"));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handBtn = async () => {
        if (isChecked === false) return onMobileErrorCallback?.(t("请阅读并同意协议！"));
        if (btnDisabled) return;

        if (!email) {
            if (needMobile) {
                if (mobile == "") {
                    onMobileErrorCallback?.(t("手机号不能为空！"));
                    return;
                }
                if (!isOverseas() && !validatePhoneNumber(mobile)) {
                    onMobileErrorCallback?.(t("手机号格式错误"));
                    return;
                }
            }
        } else {
            if (email == "") {
                onMobileErrorCallback?.(t("邮箱不能为空！"));
                return;
            }
            if (!validateEmail(email)) {
                onMobileErrorCallback?.(t("邮箱格式错误"));
                return;
            }
        }

        if (!verifyToken) {
            verifyRef.current?.show();
            return;
        }

        H5GetCode();
    };

    const H5GetCode = async () => {
        try {
            await requestApi({
                ...(needMobile ? { mobile } : {}),
                email,
                verifyToken,
                event
            });
            onVerifyTokenDataChange?.(verifyToken || "");
            Taro.showToast({
                title: t("验证码已发送"),
                duration: 1500
            });
            if (canGetCode()) {
                codeStart();
            }
        } catch (error: any) {
            onMobileErrorCallback?.(error.message);
            onVerifyTokenDataChange?.("");
        } finally {
            setVerifyToken(null);
        }
    };

    const validatePhoneNumber = (phoneNumber: string) => {
        const regex = configStore.isOpenMobileAreaCode ? /^[1-9]\d{10,14}$/ : /^(?:(?:\+|00)86)?1\d{10}$/;
        // 判断是否符合国际手机号格式
        if (regex.test(phoneNumber)) {
            return true;
        } else {
            return false;
        }
    };

    const validateEmail = (emailValue: string) => {
        const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return regex.test(emailValue);
    };

    const okCallback = (e: any) => {
        setVerifyToken(e.verifyToken);
        // 旧实现 verifyToken.value 赋值后同步调用 handBtn()；React setState 异步，直接带参调用
        handBtnWithToken(e.verifyToken);
    };

    const handBtnWithToken = async (token: string) => {
        if (isChecked === false) return onMobileErrorCallback?.(t("请阅读并同意协议！"));

        if (!email) {
            if (needMobile) {
                if (mobile == "") {
                    onMobileErrorCallback?.(t("手机号不能为空！"));
                    return;
                }
                if (!isOverseas() && !validatePhoneNumber(mobile)) {
                    onMobileErrorCallback?.(t("手机号格式错误"));
                    return;
                }
            }
        } else {
            if (email == "") {
                onMobileErrorCallback?.(t("邮箱不能为空！"));
                return;
            }
            if (!validateEmail(email)) {
                onMobileErrorCallback?.(t("邮箱格式错误"));
                return;
            }
        }

        H5GetCodeWithToken(token);
    };

    const H5GetCodeWithToken = async (token: string) => {
        try {
            await requestApi({
                ...(needMobile ? { mobile } : {}),
                email,
                verifyToken: token,
                event
            });
            onVerifyTokenDataChange?.(token);
            Taro.showToast({
                title: t("验证码已发送"),
                duration: 1500
            });
            if (canGetCode()) {
                codeStart();
            }
        } catch (error: any) {
            onMobileErrorCallback?.(error.message);
            onVerifyTokenDataChange?.("");
        } finally {
            setVerifyToken(null);
        }
    };

    useImperativeHandle(ref, () => ({
        handBtn
    }));

    return (
        <View className="box verify-shell-MjI4Mmxqb2U">
            {btnType === "button" && (
                // 旧 <tig-button plain :disabled @click>（已收敛到公共组件）
                <TigButton plain disabled={btnDisabled} className="btn-verify" onClick={handBtn}>
                    {" "}
                    {btnText}{" "}
                </TigButton>
            )}
            {btnType === "text" && (
                <View className={`verify-btn ${btnDisabled ? "is-disabled" : ""}`} onClick={handBtn}>
                    {" "}
                    {btnText}{" "}
                </View>
            )}
            <Verify ref={verifyRef} mode="pop" captchaType="blockPuzzle" imgSize={{ width: "310px", height: "155px" }} onOkCallback={okCallback} />
        </View>
    );
});

export default VerificationCode;

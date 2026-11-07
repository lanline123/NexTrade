import { useMemo, useRef, useState } from "react";
import { View, Text, Input, Image } from "@tarojs/components";
import Taro from "@tarojs/taro";


import VerificationCode, { type VerificationCodeRef } from "@/components/verificationCode/VerificationCode";
import Verify from "@/components/verifition/Verify";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { Divider, Popup } from "@nutui/nutui-react-taro";
import TigNavbar from "@/components/tig/tig-navbar/TigNavbar";
import TigButton from "@/components/tig/tig-button/TigButton";
import Checkbox from "@/pages/cart/src/Checkbox";
import TigMobileAreacode from "@/components/tig/tig-mobile-areacode/TigMobileAreacode";
import { sendMobileCode, setMiniProgramOpenid, userSignin, csrfCreate, getOauth } from "@/api/login/login";
import { useUserStore } from "@/store/user";
import { redirect, isOverseas, staticResource } from "@/utils";
import { useI18nStore } from "@/store/i18n";
import { t } from "@/utils/i18n";
import { useConfigStore } from "@/store/config";
import { useThemeStore } from "@/store/theme";
import { useCartStore } from "@/store/cart";

import "./BaseLogin.scss";

interface Props {
    /** 原 v-model:loginType */
    loginType: string;
    onLoginTypeChange: (value: string) => void;
    /** 原 v-model:csrf-token */
    csrfToken: string;
    onCsrfTokenChange: (value: string) => void;
    /** 登录页装修配置（仅颜色 + 边距） */
    decorateConfig?: Record<string, string>;
}

// 旧 px2rpx/toNumber（@/utils/decorateFrame）未随公共工具迁入，按旧实现内联等价
const px2rpx = (px: number) => `${px * 2}rpx`;
const toNumber = (val: any, fallback: number): number => {
    const n = Number(val);
    return Number.isNaN(n) ? fallback : n;
};

type AgreementModalPart =
    | {
          type: "text";
          text: string;
      }
    | {
          type: "link";
          text: string;
          url: string;
      };

const AGREEMENT_PLACEHOLDERS = {
    service: "__LOGIN_SERVICE_AGREEMENT__",
    privacy: "__LOGIN_PRIVACY_POLICY__"
} as const;

/**
 * 登录核心组件（自旧 pages/login/src/baseLogin.vue 移植）
 * - 跨境分支：Tab 布局 + Google/Facebook/Twitter 第三方登录（旧 #ifdef WEB）
 * - 微信小程序一键登录（旧 #ifdef MP-WEIXIN）、图形验证码防刷、用户协议勾选
 * - 旧模板仅渲染 overseas 分支（v-if="isOverseasVer"），默认布局样式随 SCSS 保留
 */
export default function BaseLogin({ loginType, onLoginTypeChange, csrfToken, onCsrfTokenChange, decorateConfig }: Props) {
    const configStore = useConfigStore();
    const themeStyle = useThemeStore((s) => s.themeStyle);
    const langCode = useI18nStore((s) => s.langCode);

    // 版本判定：跨境版走 Tab 布局 + 第三方登录，标准 / o2o 走默认布局
    const isOverseasVer = isOverseas();

    const [mobile, setMobile] = useState("");
    const [mobileCode, setMobileCode] = useState("");
    const [username, setUsername] = useState((process.env.TARO_APP_DEFAULT_USER_NAME as string) || "");
    const [password, setPassword] = useState((process.env.TARO_APP_DEFAULT_USER_PASSWORD as string) || "");
    const [isChecked, setIsChecked] = useState(false);
    const [verifyToken, setVerifyToken] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);
    const verifyRef = useRef<{ show: () => void; refresh: () => void } | null>(null);
    const verificationCodeRef = useRef<VerificationCodeRef | null>(null);
    const [mobileAreaCode, setMobileAreaCode] = useState("86");

    // 协议确认弹窗：替代原 toast 提示，支持“登录”和“获取验证码”两种触发场景
    const [showAgreementModal, setShowAgreementModal] = useState(false);
    const [agreementAction, setAgreementAction] = useState<"signin" | "get-code" | "">("");

    const agreementModalParts = useMemo<AgreementModalPart[]>(() => {
        const template = t("为了更好地保障您的合法权益，请您阅读并同意{service}和{privacy}。", {
            service: AGREEMENT_PLACEHOLDERS.service,
            privacy: AGREEMENT_PLACEHOLDERS.privacy
        });
        const linkParts = [
            {
                token: AGREEMENT_PLACEHOLDERS.service,
                text: t("《服务协议》"),
                url: "/pages/login/mallAgreement?articleSn=fwxy"
            },
            {
                token: AGREEMENT_PLACEHOLDERS.privacy,
                text: t("《隐私协议》"),
                url: "/pages/login/mallAgreement?articleSn=ysxy"
            }
        ];
        const parts: AgreementModalPart[] = [];
        let rest = template;

        while (rest) {
            let nextIndex = -1;
            let nextLinkPart: (typeof linkParts)[number] | undefined;

            for (const part of linkParts) {
                const index = rest.indexOf(part.token);
                if (index !== -1 && (nextIndex === -1 || index < nextIndex)) {
                    nextIndex = index;
                    nextLinkPart = part;
                }
            }

            if (!nextLinkPart || nextIndex === -1) {
                parts.push({ type: "text", text: rest });
                break;
            }

            if (nextIndex > 0) {
                parts.push({ type: "text", text: rest.slice(0, nextIndex) });
            }

            parts.push({
                type: "link",
                text: nextLinkPart.text,
                url: nextLinkPart.url
            });
            rest = rest.slice(nextIndex + nextLinkPart.token.length);
        }

        return parts;
        // langCode：语言切换时重算文案
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [langCode]);

    const loginTypeTabs = [
        {
            name: t("账号登录"),
            value: "password"
        },
        {
            name: t("验证码登录"),
            value: "mobile"
        }
    ];

    const isloginDisabled = useMemo(() => {
        if (loginType === "password") {
            return !username || !password;
        } else {
            return !mobile || !mobileCode || !verifyToken;
        }
    }, [loginType, username, password, mobile, mobileCode, verifyToken]);

    // 仅当配置项有值时才注入对应 CSS 变量；未注入的变量在样式里带 fallback 回退原值，保证零变化
    const loginStyleVars = useMemo<Record<string, string>>(() => {
        const c = decorateConfig || {};
        const s: Record<string, string> = {};
        const set = (varName: string, val?: string) => {
            if (val && String(val).trim()) s[varName] = val;
        };
        set("--login-title", c.titleColor);
        set("--login-subtext", c.subTextColor);
        set("--login-input", c.inputTextColor);
        set("--login-placeholder", c.placeholderColor);
        set("--login-link", c.linkColor);
        set("--login-divider", c.dividerColor);
        // 仅当装修数据显式配置了才注入变量；未配置时不注入，交给各布局 CSS 自己的原始默认 fallback
        const hasVal = (v?: string | number) => v !== undefined && v !== null && String(v).trim() !== "";
        if (hasVal(c.contentPaddingX)) s["--login-padding-x"] = px2rpx(toNumber(c.contentPaddingX, 20));
        if (hasVal(c.contentPaddingTop)) s["--login-padding-top"] = px2rpx(toNumber(c.contentPaddingTop, 0));
        return s;
    }, [decorateConfig]);

    // 主按钮色：配置有值则用配置，否则回退 tig-button 默认（var(--main-bg)），保证未配置零变化
    const buttonColorFinal = useMemo(() => {
        const v = decorateConfig?.buttonColor;
        return v && String(v).trim() ? v : "var(--main-bg)";
    }, [decorateConfig]);

    const handleLink = (url: string) => {
        if (!url) return;
        redirect({
            url: url
        });
    };

    const mobileErrorCallback = (msg: string) => {
        // 验证码组件未勾选协议时抛出的提示改为弹窗，勾选后自动补发验证码
        if (msg === t("请阅读并同意协议！")) {
            setAgreementAction("get-code");
            setShowAgreementModal(true);
            return;
        }
        Taro.showToast({
            title: msg,
            duration: 1500,
            icon: "none"
        });
    };

    const mobileLogin = () => {
        if (!ensureAgreementAccepted("signin")) {
            return;
        }
        signin();
    };

    // 登录前统一校验协议勾选状态，未勾选则弹窗提示
    const ensureAgreementAccepted = (action: "signin" | "get-code") => {
        if (isChecked) return true;
        setAgreementAction(action);
        setShowAgreementModal(true);
        return false;
    };

    const handleAgreementDisagree = () => {
        setShowAgreementModal(false);
        setAgreementAction("");
    };

    const handleAgreementAgree = async () => {
        setShowAgreementModal(false);
        setIsChecked(true);
        if (agreementAction === "get-code") {
            setAgreementAction("");
            // 旧实现 await nextTick() 后调 verificationCodeRef.handBtn()；React 直接调用
            verificationCodeRef.current?.handBtn();
            return;
        }
        setAgreementAction("");
        mobileLogin();
    };

    // 默认分支：底部“其他登录方式”账号 / 手机切换（旧模板仅 overseas 分支渲染，本函数为默认分支逻辑，随源码保留）
    const handleLoginType = () => {
        const next = loginType === "mobile" ? "password" : "mobile";
        onLoginTypeChange(next);
        setUsername((process.env.TARO_APP_DEFAULT_USER_NAME as string) || "");
        setPassword((process.env.TARO_APP_DEFAULT_USER_PASSWORD as string) || "");
        setMobile("");
        setMobileCode("");
        setVerifyToken("");
        setIsChecked(false);
    };

    // 跨境分支：Tab 切换登录方式
    const loginTypeChange = (value: string) => {
        onLoginTypeChange(value);
    };

    // 跨境分支：登录前刷新 CSRF（保持迁移前逐次刷新行为）；React setState 异步，返回值供 signin 同步取用
    const refreshCsrf = async (): Promise<string> => {
        try {
            const token = await csrfCreate();
            onCsrfTokenChange(token);
            return token;
        } catch (error) {
            console.error("获取CSRF Token失败:", error);
            return csrfToken;
        }
    };

    // 跨境分支：跳转协议页
    const showAgreement = () => {
        Taro.navigateTo({
            url: "/pages/login/mallAgreement?articleSn=fwxy"
        });
    };

    // 跨境分支：redirectTo 模式回跳
    const handleRedirect = () => {
        const backUrl = Taro.getStorageSync("URL");
        setTimeout(() => {
            redirect({
                url: backUrl || "/pages/index/index",
                mode: "redirectTo",
                success: () => {
                    Taro.removeStorageSync("URL");
                }
            });
        }, 800);
    };

    // 跨境分支：第三方登录（Google/Facebook/Twitter），仅 H5
    const handleOtherLogin = async (path: string) => {
        Taro.setStorageSync("oauthPath", path);
        try {
            const returnUrl = Taro.getStorageSync("URL") || "";
            const result = await getOauth(path, returnUrl);
            if (process.env.TARO_ENV === "h5") {
                window.location.href = result;
            }
        } catch (error) {
            console.error(error);
        }
    };

    const signin = async () => {
        try {
            // 跨境版登录前刷新 CSRF（标准 / o2o 由 index.vue 预取透传，保持原行为）
            const csrfTokenToUse = isOverseasVer ? await refreshCsrf() : csrfToken;
            setLoginLoading(true);
            const data: any = {
                loginType: loginType,
                username: username,
                password: password,
                mobile: "",
                mobileCode: "",
                verifyToken: verifyToken
            };
            if (loginType === "mobile") {
                data.mobile = configStore.isOpenMobileAreaCode ? mobileAreaCode + mobile : mobile;
                data.mobileCode = mobileCode;
            }
            const result = await userSignin(data, {
                "X-CSRF-Token": csrfTokenToUse
            });
            const userStore = useUserStore.getState();
            userStore.setToken(result.token);
            userStore.getUserInfo();
            // 跨境版登录后刷新购物车数量
            if (isOverseasVer) {
                useCartStore.getState().fetchCartCount(true);
            }
            Taro.showToast({
                title: t("登录成功"),
                duration: 1000
            });
            if (process.env.TARO_ENV === "weapp") {
                updateUserOpenId();
            }
            if (isOverseasVer) {
                // 跨境版：redirectTo 模式回跳
                handleRedirect();
                return;
            }
            const backUrl = Taro.getStorageSync("URL");
            setTimeout(() => {
                if (backUrl) {
                    redirect({
                        url: backUrl,
                        success: () => {
                            Taro.removeStorageSync("URL");
                        }
                    });
                } else {
                    Taro.reLaunch({
                        url: "/pages/index/index"
                    });
                }
            }, 800);
        } catch (error: any) {
            if (error.code == 1002 && verifyRef.current) {
                verifyRef.current.show();
            } else if (error.code > 0) {
                Taro.showToast({
                    title: error.message,
                    duration: 1500,
                    icon: "none"
                });
                setMobileCode("");
            }
        } finally {
            setLoginLoading(false);
        }
    };

    const okCallback = (e: any) => {
        setVerifyToken(e.verifyToken);
        signin();
    };

    const [passwordType, setPasswordType] = useState("password");
    const passwordTypeChange = () => {
        setPasswordType(passwordType === "password" ? "text" : "password");
    };

    const handleReset = () => {
        Taro.navigateTo({
            url: "/pages/reset/index"
        });
    };

    const updateUserOpenId = async () => {
        Taro.login({
            success: async (res: any) => {
                await setMiniProgramOpenid({
                    code: res.code
                });
            },
            fail: (err: any) => {
                console.log(err);
            }
        });
    };

    // 旧 .bottom-box 使用 v-bind("configStore.windowInfo.windowHeight + 'px'")，模板未引用该类（见 BaseLogin.scss 注释）
    void configStore.windowInfo;

    return (
        <>
            {/* 跨境版登录布局：Tab + 第三方登录 */}
            {isOverseasVer && (
                <TigLayout>
                    <TigNavbar />
                    <View className="login-page login-panel-MjI4Mmdxbnc" style={loginStyleVars as any}>
                        <View className="tab-row">
                            {loginTypeTabs.map((item) => (
                                <View key={item.value} className={loginType === item.value ? "active" : ""} onClick={() => loginTypeChange(item.value)}>
                                    {item.name}
                                </View>
                            ))}
                        </View>
                        <View className="form-box">
                            {loginType === "mobile" && (
                                <>
                                    <View className="item">
                                        {!!configStore.isOpenMobileAreaCode && (
                                            // 原 tig-mobile-areacode v-model="mobileAreaCode" style="width: 90rpx"
                                            <View style={{ width: "90rpx" }}>
                                                <TigMobileAreacode value={mobileAreaCode} onChange={setMobileAreaCode} />
                                            </View>
                                        )}
                                        <Input
                                            value={mobile}
                                            type="text"
                                            placeholder={t("请输入手机号")}
                                            placeholderClass="placeholder"
                                            className="mobile-text text"
                                            onInput={(e) => setMobile(e.detail.value)}
                                        />
                                    </View>
                                    <View className="item">
                                        <View style={{ flex: 1, marginRight: "10rpx" }}>
                                            <Input
                                                type="text"
                                                placeholder={t("手机短信验证码")}
                                                placeholderClass="placeholder"
                                                name="mobile_code"
                                                className="text"
                                                value={mobileCode}
                                                onInput={(e) => setMobileCode(e.detail.value)}
                                            />
                                        </View>
                                        <VerificationCode
                                            ref={verificationCodeRef}
                                            isChecked={isChecked}
                                            onVerifyTokenDataChange={setVerifyToken}
                                            mobile={mobile ? (configStore.isOpenMobileAreaCode ? mobileAreaCode + mobile : mobile) : ""}
                                            btnType="text"
                                            requestApi={sendMobileCode}
                                            onMobileErrorCallback={mobileErrorCallback}
                                        />
                                    </View>
                                </>
                            )}
                            {loginType === "password" && (
                                <>
                                    <View className="item">
                                        <Input
                                            value={username}
                                            type="text"
                                            placeholder={t(configStore.openEmailRegister === 1 ? t("用户名/手机/邮箱") : t("用户名/手机号"))}
                                            placeholderClass="placeholder"
                                            className="text"
                                            onInput={(e) => setUsername(e.detail.value)}
                                        />
                                    </View>
                                    {passwordType == "password" && (
                                        <View className="item">
                                            {/* 旧 type="password"：Taro Input 的 type 不含 password，以 password prop 等价实现 */}
                                            <Input
                                                type="text"
                                                password
                                                placeholder={t("请输入密码")}
                                                placeholderClass="placeholder"
                                                className="text password-text"
                                                value={password}
                                                onInput={(e) => setPassword(e.detail.value)}
                                            />
                                            <View className="password_show_hide iconfont icon-yincang" onClick={passwordTypeChange} />
                                        </View>
                                    )}
                                    {passwordType == "text" && (
                                        <View className="item">
                                            <Input
                                                type="text"
                                                placeholder={t("请输入密码")}
                                                placeholderClass="placeholder"
                                                className="text password-text"
                                                value={password}
                                                onInput={(e) => setPassword(e.detail.value)}
                                            />
                                            <View className="password_show_hide iconfont-h5 icon-xianshi" onClick={passwordTypeChange} />
                                        </View>
                                    )}
                                </>
                            )}
                        </View>
                        <View className="btn2-css3">
                            {/* 旧 tig-button :loading :disabled :color size=normal（已收敛到公共组件；禁用态灰色对齐旧 type="info"） */}
                            <TigButton
                                loading={loginLoading}
                                loadingText={t("登录中")}
                                disabled={isloginDisabled}
                                color={isloginDisabled ? "#c8c9cc" : buttonColorFinal}
                                className="login-btn"
                                onClick={() => {
                                    if (loginLoading || isloginDisabled) return;
                                    mobileLogin();
                                }}
                            >
                                {t("登录")}
                            </TigButton>
                        </View>
                        {loginType === "password" && (
                            <View className="other-row">
                                <View className="item" onClick={handleReset}>
                                    {t("忘记密码")}
                                </View>
                                {configStore.shopRegClosed === 0 && (
                                    <View
                                        className="item flex"
                                        onClick={() =>
                                            redirect({
                                                url: "/pages/register/index"
                                            })
                                        }
                                    >
                                        {t("新用户")}
                                        <Text className="special-color">{t("注册")}</Text>
                                    </View>
                                )}
                            </View>
                        )}
                        {loginType === "mobile" && (
                            <View className="other-row">
                                <View className="tips">{t("未注册过的账号将自动注册账号")}</View>
                            </View>
                        )}

                        <View className="footer-row">
                            {process.env.TARO_ENV === "h5" && (
                                <>
                                    {(configStore.googleLoginOn || configStore.facebookLoginOn || configStore.twitterLoginOn) && (
                                        <>
                                            {/* 原 up-divider :text → NutUI Divider */}
                                            <Divider>{t("其他登录方式")}</Divider>
                                            <View className="login-other">
                                                {!!configStore.googleLoginOn && (
                                                    <View className="item" onClick={() => handleOtherLogin("google")}>
                                                        <Image src={staticResource("login/google.png")} className="icon" mode="widthFix" />
                                                        <View>{t("Google登录")}</View>
                                                    </View>
                                                )}
                                                {!!configStore.facebookLoginOn && (
                                                    <View className="item" onClick={() => handleOtherLogin("facebook")}>
                                                        <Image src={staticResource("login/facebook.png")} className="icon" mode="widthFix" />
                                                        <View>{t("Facebook登录")}</View>
                                                    </View>
                                                )}
                                                {!!configStore.twitterLoginOn && (
                                                    <View className="item" onClick={() => handleOtherLogin("twitter")}>
                                                        <Image src={staticResource("login/twitter.svg")} className="twitter-icon" mode="widthFix" />
                                                        <View>{t("Twitter/X登录")}</View>
                                                    </View>
                                                )}
                                            </View>
                                        </>
                                    )}
                                </>
                            )}
                            <View className="desc-box">
                                <View className="rule-text flex" onClick={() => setIsChecked(!isChecked)}>
                                    <Checkbox checked={isChecked} activeColor="#333333" onChange={() => setIsChecked(!isChecked)} />
                                    <View className="rule-xieyi">
                                        <Text>{t("登录即为同意")}</Text>
                                        <Text
                                            className="special-color"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                showAgreement();
                                            }}
                                        >
                                            {t("《商城用户服务协议》")}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                    <Verify ref={verifyRef} mode="pop" captchaType="blockPuzzle" imgSize={{ width: "310px", height: "155px" }} onOkCallback={okCallback} />
                </TigLayout>
            )}

            {/* 协议确认弹窗：未勾选服务协议时以弹窗代替 toast 提示 */}
            {/* 弹窗在 tig-layout 外，需自行注入 themeStyle + 登录装修变量，否则主题色/--login-link 无效 */}
            <Popup
                visible={showAgreementModal}
                position="center"
                closeOnOverlayClick={false}
                closeable={false}
                style={{ backgroundColor: "#fff", borderRadius: "24rpx" }}
                zIndex={10081}
            >
                <View className="agreement-modal" style={{ ...(themeStyle as any), ...(loginStyleVars as any) } as any}>
                    <View className="agreement-modal__title">{t("温馨提示")}</View>
                    <View className="agreement-modal__content">
                        {agreementModalParts.map((part, index) => (
                            <Text key={`${part.type}-${index}`} className={part.type === "link" ? "agreement-modal__link" : ""} onClick={part.type === "link" ? () => handleLink(part.url) : undefined}>
                                {part.text}
                            </Text>
                        ))}
                    </View>
                    <View className="agreement-modal__actions">
                        <View className="agreement-modal__btn agreement-modal__btn--cancel" onClick={handleAgreementDisagree}>
                            {t("不同意")}
                        </View>
                        <View
                            className="agreement-modal__btn agreement-modal__btn--confirm"
                            style={{ background: buttonColorFinal, borderColor: buttonColorFinal }}
                            onClick={handleAgreementAgree}
                        >
                            {t("同意")}
                        </View>
                    </View>
                </View>
            </Popup>
        </>
    );
}

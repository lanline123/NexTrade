import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import { Input, Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigNavbar from "@/components/tig/tig-navbar/TigNavbar";
import { giftCardExchange } from "@/api/giftCard/giftCard";
import type { GiftCardExchangeParams } from "@/types/giftCard/giftCard";
import { useUserStore } from "@/store/user";
import { redirect, staticResource } from "@/utils";
import { handleLogin } from "@/utils/handleLogin";
import { t } from "@/utils/i18n";

import "./exchange.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 礼品卡兑换页（自旧 pages/giftCard/exchange.vue 移植）
 * - 输入卡号/卡密，调用兑换接口
 * - 兑换商品 → 订单确认页；储值卡 → 兑换成功页
 * - 旧 uni-forms/uni-easyinput → Taro Input + 自绘表单行（必填校验等价）
 */
export default function GiftCardExchange() {
    usePageGuards();
    const userToken = useUserStore((s) => s.token);
    const [formState, setFormState] = useState<GiftCardExchangeParams>({
        cardNumber: "",
        cardPassword: ""
    });
    const [errors, setErrors] = useState<{ cardNumber: string; cardPassword: string }>({
        cardNumber: "",
        cardPassword: ""
    });
    const [loading, setLoading] = useState(false);

    const hasToken = userToken || Taro.getStorageSync("token");

    const backgroundImg = `url(${staticResource("giftCard/exchange_bg.png")}) center no-repeat`;

    /**
     * 礼品卡兑换
     */
    const exchange = async () => {
        try {
            if (loading) {
                return;
            }
            setLoading(true);
            const result: any = await giftCardExchange(formState);
            // 兑换礼品卡跳转到订单确认页
            if (result?.exchangeProductToCart?.flowType) {
                redirect({ url: `/pages/order/check?flowType=${result.exchangeProductToCart?.flowType}` });
            } else {
                // 储值卡跳转到兑换成功页面
                redirect({ url: "/pages/giftCard/order/payStatus" });
            }
        } catch (error: any) {
            Taro.showToast({
                title: t(error.message),
                icon: "none"
            });
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleExchange = () => {
        // 旧 uni-forms.validate()：按 rules 逐项校验，错误信息展示在表单项下方
        const nextErrors = {
            cardNumber: formState.cardNumber ? "" : t("请输入卡号"),
            cardPassword: formState.cardPassword ? "" : t("请输入卡密")
        };
        setErrors(nextErrors);
        if (nextErrors.cardNumber || nextErrors.cardPassword) {
            console.log("表单错误信息：", nextErrors);
            return;
        }
        void exchange();
    };

    // 页面加载（旧 onLoad）
    useEffect(() => {
        // 需要登录
        if (!hasToken) {
            handleLogin();
            return;
        }
        // if (options?.cardNumber) {
        //     setFormState((prev) => ({ ...prev, cardNumber: options.cardNumber }));
        // }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onShow → nextTick(() => formRef.setRules(rules))；rules 恒为上方校验规则，无需重复注入
    useEffect(() => {
        // TODO(MIGRATION)：uni-forms 的 setRules 动态注入在自绘表单中由 validate() 内联等价
    }, []);

    return (
        <View>
            <TigLayout>
                <TigNavbar background="transparent" />
                <View className="bg" style={{ "--exchange-bg": backgroundImg } as CSSProperties} />
                <View className="container">
                    <View className="card-title">
                        <Text className="title">{t("礼品卡兑换")}</Text>
                    </View>
                    <View className="card-subtitle">
                        <View className="title">
                            <Text>{t("一卡在手，好礼不愁")}</Text>
                        </View>
                    </View>
                    <View className="gift-card">
                        <View className="card-box exchange-form">
                            <View className="card-edit-content">
                                <View className="form-item">
                                    <View className="form-label">{t("卡号")}</View>
                                    <Input
                                        className="input"
                                        value={formState.cardNumber}
                                        placeholder={t("请输入卡号")}
                                        placeholderStyle="color:#bfbfbf;font-size:28rpx"
                                        onInput={(e) => setFormState((prev) => ({ ...prev, cardNumber: e.detail.value }))}
                                    />
                                    {errors.cardNumber ? <View className="form-error">{errors.cardNumber}</View> : null}
                                </View>
                                <View className="form-item">
                                    <View className="form-label">{t("卡密")}</View>
                                    <Input
                                        className="input"
                                        password
                                        value={formState.cardPassword}
                                        placeholder={t("请输入卡密")}
                                        placeholderStyle="color:#bfbfbf;font-size:28rpx"
                                        onInput={(e) => setFormState((prev) => ({ ...prev, cardPassword: e.detail.value }))}
                                    />
                                    {errors.cardPassword ? <View className="form-error">{errors.cardPassword}</View> : null}
                                </View>
                                <View className="action">
                                    <TigButton2 className="btn" loading={loading} onClick={handleExchange}>
                                        {t("立即兑换")}
                                    </TigButton2>
                                </View>
                            </View>
                        </View>
                        <View className="card-box">
                            <View className="card-content">
                                <View className="title">{t("兑换说明")}</View>
                                <View className="tips">
                                    <View>{t("1. 储值卡输入卡密进行兑换将自动充值到余额")}</View>
                                    <View>{t("2. 兑换卡输入卡密进行兑换后将跳转至该商品详情页进行兑换")}</View>
                                </View>
                            </View>
                        </View>
                    </View>
                </View>
            </TigLayout>
        </View>
    );
}
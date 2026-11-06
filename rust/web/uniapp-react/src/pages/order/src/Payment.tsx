import { useEffect, useMemo } from "react";
import { Image, Radio, RadioGroup, View } from "@tarojs/components";

import { isOverseas, staticResource } from "@/utils";
import { canUseApplePay } from "@/utils/applePay";
import { t } from "@/utils/i18n";
import { useThemeStore } from "@/store/theme";
import FormatPrice from "@/components/format-price/FormatPrice";

import "./Payment.scss";

interface Props {
    paymentList: string[];
    /** 旧 v-model（modelValue）：当前选中的支付方式 */
    modelValue: string;
    /** 旧 @update:modelValue */
    onModelChange: (value: string) => void;
    balance?: number | string;
    balanceDisabled?: boolean;
}

/**
 * 支付方式选择组件（自旧 pages/order/src/payment.vue 移植）
 * - 展示可用支付方式列表（微信、支付宝、PayPal、线下等）
 * - 单选模式，通过 modelValue 绑定选中的支付方式
 */
export default function Payment({ paymentList, modelValue, onModelChange, balance = 0, balanceDisabled = false }: Props) {
    const generalColor = useThemeStore((s) => s.themeStyle["--general"]) || "#21424b";
    const paymentText: { [key: string]: string } = {
        wechat: t("微信支付"),
        alipay: t("支付宝支付"),
        paypal: t("PayPal支付"),
        stripe: t("Stripe支付"),
        offline: t("线下支付"),
        balance: t("余额支付"),
        yabanpayWechat: t("微信支付"),
        yabanpayAlipay: t("支付宝支付"),
        yunpayWechat: t("微信支付"),
        yunpayAlipay: t("支付宝支付"),
        yunpayYunshanfu: t("云闪付"),
        antom: t("Antom支付"),
        xendit: t("Xendit支付"),
        huifuWechat: t("微信支付"),
        lakalaWechat: t("微信支付"),
        lakalaAlipay: t("支付宝支付"),
        yeepayWechat: "微信支付",
        yeepayAlipay: "支付宝支付",
        huifuAlipay: t("支付宝支付"),
        // Apple Pay 品牌名不翻译
        applepay: "Apple Pay"
    };

    // 渲染列表：applepay 仅在 H5 且设备支持时展示；跨境支付仅跨境环境展示
    const displayPaymentList = useMemo(
        () =>
            (paymentList || []).filter((p) => {
                if (p === "stripe" || p === "antom" || p === "xendit") return isOverseas();
                if (p === "applepay") return canUseApplePay();
                return true;
            }),
        [paymentList]
    );

    // 旧 watch immediate：选中项始终保持在可见列表内，避免默认项被过滤后无选中
    useEffect(() => {
        const selectableList = displayPaymentList.filter((item) => item !== "balance" || !balanceDisabled);
        if (selectableList.length && !selectableList.includes(modelValue)) {
            onModelChange(selectableList[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayPaymentList, balanceDisabled]);

    // payCode → 图标基名映射：汇付微信/支付宝复用现有微信/支付宝图标
    const payIconMap: { [key: string]: string } = {
        huifuWechat: "wechat",
        lakalaWechat: "wechat",
        lakalaAlipay: "alipay",
        yeepayWechat: "wechat",
        yeepayAlipay: "alipay",
        huifuAlipay: "alipay"
    };
    const payIconName = (payment: string) => payIconMap[payment] || payment;

    // 旧 radio-group @change="paymentChange"
    const paymentChange = (e: any) => {
        onModelChange(e.detail.value);
    };

    return (
        <View className="paymentType">
            <View className="pay-list">
                <RadioGroup className="radio-group" onChange={paymentChange}>
                    {displayPaymentList.map((payment, idx) => (
                        <View className="item" key={idx}>
                            <View className="payment-info">
                                {payment === "balance" ? (
                                    <>
                                        <View className="payment-info-balance-icon">¥</View>
                                        <View className="payment-info-text payment-info-balance">
                                            <View>{t("余额支付")}</View>
                                            <View className="payment-info-balance__amount">
                                                {t("可用余额")}
                                                <FormatPrice isBottom={false} priceData={balance} />
                                            </View>
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        {payment !== "offline" && (
                                            <Image
                                                className="payment-info-img"
                                                src={staticResource("payment/pay_" + payIconName(payment) + ".png")}
                                                mode={payment === "antom" ? "aspectFit" : "aspectFill"}
                                                lazyLoad
                                            />
                                        )}
                                        <View className="payment-info-text">{t(paymentText[payment] || "")}</View>
                                    </>
                                )}
                            </View>
                            {/* 旧 <radio> active-background-color="var(--general)" → Taro Radio color 属性不解析 CSS 变量，改传主题色值 */}
                            <Radio
                                value={payment}
                                color={generalColor}
                                checked={payment === modelValue}
                                disabled={payment === "balance" && balanceDisabled}
                                style={{ marginRight: "20rpx", transform: "scale(0.9)" }}
                            />
                        </View>
                    ))}
                </RadioGroup>
            </View>
        </View>
    );
}

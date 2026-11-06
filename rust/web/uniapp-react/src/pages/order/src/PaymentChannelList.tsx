import { useEffect } from "react";
import { View, Image } from "@tarojs/components";

import { PAYMENT_TEXT_MAP } from "@/hooks/usePayment";
import { isOverseas, staticResource } from "@/utils";
import { t } from "@/utils/i18n";

import "./PaymentChannelList.scss";

interface Props {
    /** 当前选中的渠道 code（旧 v-model → value + onValueChange） */
    value?: string;
    onValueChange?: (code: string) => void;
    /** 渠道 code 列表 */
    paymentList?: string[];
    /** 标题，传空字符串则不展示 */
    title?: string;
}

/**
 * 通用支付渠道单选组件（自旧 pages/order/src/paymentChannelList.vue 移植）
 * - 展示在线支付渠道（微信/支付宝/applepay 等）图标、名称与单选态
 * - 结算页与提交订单二次确认收银台共用
 * - 跨境渠道（stripe/antom/xendit）仅在跨境运行环境展示
 */
export default function PaymentChannelList({ value = "", onValueChange, paymentList = [], title = "支付方式" }: Props) {
    // 跨境渠道仅在跨境运行环境展示；构建标记用于普通版移除相关代码。
    const displayPaymentList = paymentList.filter((channel) => {
        if (channel === "stripe" || channel === "antom" || channel === "xendit") return isOverseas();
        return true;
    });

    // 旧 watch(displayPaymentList, immediate)：列表就绪且当前选中渠道不在列表中时，回选第一个
    useEffect(() => {
        if (displayPaymentList.length && !displayPaymentList.includes(value)) {
            onValueChange?.(displayPaymentList[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [displayPaymentList.join(",")]);

    const selectChannel = (channel: string) => {
        if (channel === value) return;
        onValueChange?.(channel);
    };

    return (
        <View className="payment-channel-list">
            {title && <View className="payment-channel-list-title">{t(title)}</View>}
            <View className="channel-list">
                {displayPaymentList.map((channel) => (
                    <View key={channel} className="channel-item" onClick={() => selectChannel(channel)}>
                        <View className="channel-info">
                            <Image lazyLoad className="channel-icon" src={staticResource("payment/pay_" + channel + ".png")} />
                            <View className="channel-name">{t(PAYMENT_TEXT_MAP[channel] || channel)}</View>
                        </View>
                        <View className={`radio-circle ${value === channel ? "checked" : ""}`} />
                    </View>
                ))}
            </View>
        </View>
    );
}

import { forwardRef, useImperativeHandle, useState } from "react";
import { View, Text, Switch } from "@tarojs/components";

import type { CreditPaymentInfo } from "@/types/order/check";
import { t } from "@/utils/i18n";

import "./CreditCard.scss";

interface Props {
    /** 账期支付信息（非授信会员返回 null） */
    creditPaymentInfo?: CreditPaymentInfo | null;
    onSendCreditStatus?: (status: boolean) => void;
}

/** 旧 defineExpose({ isCredit })：父级经 ref 置 isCredit=false（onShow / 余额互斥） */
export interface CreditCardInstance {
    isCredit: boolean;
}

/**
 * 账期支付卡片组件（自旧 pages/order/src/creditCard.vue 移植，o2o/B2B 独有）
 * - 展示账期剩余额度或不可用原因
 * - 开关控制是否使用账期支付（与余额互斥，由结算页协调）
 * - 接口 creditPaymentInfo 为空则不展示
 */
const CreditCard = forwardRef<CreditCardInstance, Props>(({ creditPaymentInfo, onSendCreditStatus }, ref) => {
    const [isCredit, setIsCredit] = useState(false);

    // 旧 defineExpose({ isCredit }) → getter/setter 代理内部 state，
    // 父级 `ref.current.isCredit = false` 直写时同步开关 UI（与旧 Vue ref 行为一致）
    useImperativeHandle(ref, () => ({
        get isCredit() {
            return isCredit;
        },
        set isCredit(val: boolean) {
            setIsCredit(val);
        }
    }));

    const isDisabled = [2, 3].includes(creditPaymentInfo?.creditPaymentStatus as number);

    const disabledText = (() => {
        if (creditPaymentInfo?.creditPaymentStatus === 2) {
            return t("您有账期逾期待结算订单，敬请及时处理");
        } else if (creditPaymentInfo?.creditPaymentStatus === 3) {
            return t("账期支付功能已关闭，详情请咨询平台方");
        } else {
            return "";
        }
    })();

    const handleCredit = (e: any) => {
        const next = !!e.detail.value;
        setIsCredit(next);
        onSendCreditStatus?.(next);
    };

    if (!creditPaymentInfo) return null;

    return (
        <View className="credit">
            <View className="credit-title">
                {t("账期")}
                {disabledText ? <View className="credit-text disabledText">{disabledText}</View> : (
                    <View className="credit-text">
                        {t("账期剩余额度")}：<Text className="special-text">{creditPaymentInfo.availableAmount}</Text>
                    </View>
                )}
            </View>
            <View className="credit-switch-wrap">
                <Switch className="credit-switch" checked={isCredit} color="var(--general)" onChange={handleCredit} />
                {isDisabled && <View className="switch-mask" />}
            </View>
        </View>
    );
});

export default CreditCard;

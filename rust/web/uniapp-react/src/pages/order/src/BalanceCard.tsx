import { forwardRef, useImperativeHandle, useState } from "react";
import { View, Text, Switch } from "@tarojs/components";
import Taro from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import { isOverseas } from "@/utils";
import { t } from "@/utils/i18n";

import "./BalanceCard.scss";

interface Props {
    balance?: number | string;
    /** 本单使用余额金额 */
    balanceAmount?: number;
    onSendBalanceStatus?: (status: boolean) => void;
}

/** 旧 defineExpose({ isBalance })：父级经 ref 置 isBalance=false（onShow / 账期互斥） */
export interface BalanceCardInstance {
    isBalance: boolean;
}

/**
 * 余额抵扣卡片组件（自旧 pages/order/src/balanceCard.vue 移植）
 * - 展示当前账户余额与本单余额支付金额
 * - 开关控制是否使用余额抵扣（与账期互斥，由结算页协调）
 */
const BalanceCard = forwardRef<BalanceCardInstance, Props>(({ balance, balanceAmount = 0, onSendBalanceStatus }, ref) => {
    const [isBalance, setIsBalance] = useState(false);

    // 旧 defineExpose({ isBalance }) → getter/setter 代理内部 state，
    // 父级 `ref.current.isBalance = false` 直写时同步开关 UI（与旧 Vue ref 行为一致）
    useImperativeHandle(ref, () => ({
        get isBalance() {
            return isBalance;
        },
        set isBalance(val: boolean) {
            setIsBalance(val);
        }
    }));

    const handleBalance = (e: any) => {
        const next = !!e.detail.value;
        setIsBalance(next);
        onSendBalanceStatus?.(next);
    };

    const handleToBalance = () => {
        Taro.navigateTo({
            url: "/pages/user/account/index"
        });
    };

    return (
        <View className="balance">
            <View className="balance-title" onClick={handleToBalance}>
                {t("余额")}
                {isOverseas() ? (
                    <View className="balance-text">
                        {t("当前账户余额")}：
                        <FormatPrice
                            isBottom={false}
                            fontStyle={{ fontSize: "22rpx" }}
                            currencyStyle={{ fontSize: "22rpx" }}
                            decimalsStyle={{ fontSize: "22rpx" }}
                            priceData={balance}
                        />
                    </View>
                ) : (
                    <View className="balance-text">
                        {t("当前账户余额")}：<Text className="special-text">{balance}</Text>
                    </View>
                )}
            </View>
            <View className="balance-switch-wrap">
                {isBalance && (
                    <View className="balance-use-text">
                        {t("支付")}
                        <FormatPrice
                            fontStyle={{ fontSize: "24.5rpx" }}
                            currencyStyle={{ fontSize: "24.5rpx" }}
                            decimalsStyle={{ fontSize: "24.5rpx" }}
                            priceData={balanceAmount}
                        />
                    </View>
                )}
                <Switch className="balance-switch" checked={isBalance} color="var(--general)" onChange={handleBalance} />
            </View>
        </View>
    );
});

export default BalanceCard;

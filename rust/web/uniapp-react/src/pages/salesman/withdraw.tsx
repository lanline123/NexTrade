import { useState } from "react";
import { View } from "@tarojs/components";
import Taro, { useDidShow } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import RaplyToCard from "@/pages/user/account/raplyToCard";
import { getUser } from "@/api/salesman/salesmanCenter";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./withdraw.scss";

/**
 * 分销佣金提现（D1107）：从佣金账户提现，复用收款账户与提现表单
 * 自旧 pages/salesman/withdraw.vue 逐行移植
 */
export default function SalesmanWithdraw() {
    usePageGuards();

    const [commissionBalance, setCommissionBalance] = useState<string | number>(0);

    const _getUser = async () => {
        try {
            const result = await getUser();
            setCommissionBalance((result as any)?.commissionBalance || 0);
        } catch (error: any) {
            setCommissionBalance(0);
        }
    };

    const onBack = () => {
        Taro.navigateBack();
    };

    // 旧 onShow
    useDidShow(() => {
        void _getUser();
    });

    return (
        <TigLayout title={t("佣金提现")}>
            <View className="withdraw-page">
                <RaplyToCard balance={commissionBalance} wallet="commission" onBackDetail={onBack} />
            </View>
        </TigLayout>
    );
}
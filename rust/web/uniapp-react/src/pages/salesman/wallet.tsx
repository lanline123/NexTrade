import { useState } from "react";
import { View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import RaplyToCard from "@/pages/user/account/raplyToCard";
import AccountDetail from "@/pages/user/account/detail";
import { getUser } from "@/api/user/user";
import type { UserItem } from "@/types/user/user";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./wallet.scss";

/**
 * @description 分销佣金钱包页（D1107）
 * - 展示分销佣金可提现金额（commissionBalance，与会员余额隔离）
 * - 佣金明细 + 佣金提现，提现走 applyCommission
 * 自旧 pages/salesman/wallet.vue 逐行移植
 */
export default function SalesmanWallet() {
    usePageGuards();

    const [formState, setFormState] = useState<UserItem>({} as UserItem);
    // 默认展示佣金明细（与 detail 的 commission 分页标识一致）
    const [activeTab, setActiveTab] = useState("commissionDetail");
    const [refreshKey, setRefreshKey] = useState(0);

    const __getUser = async () => {
        try {
            const result = await getUser();
            setFormState((prev) => ({ ...prev, ...result }));
        } catch (error: any) {
            console.error(error.message);
        }
    };

    const actionClick = (value: string) => {
        if (value === activeTab) return;
        setActiveTab(value);
    };

    const backDetail = (needRefresh = false) => {
        if (needRefresh) {
            void __getUser();
            setRefreshKey((key) => key + 1);
        }
        setActiveTab("commissionDetail");
    };

    // 旧 onShow
    useDidShow(() => {
        void __getUser();
    });

    return (
        <TigLayout title={t("我的佣金")}>
            <View className="top-card">
                <View className="balance-row">{t("可用佣金")}</View>
                <View className="amount-row">
                    <FormatPrice
                        base
                        showText={false}
                        priceData={formState.commissionBalance || 0}
                        decimalsStyle={{ fontSize: "40rpx", fontWeight: "bold" }}
                        currencyStyle={{ fontSize: "38rpx", fontWeight: "bold" }}
                    />
                </View>
                <View className="button-row">
                    <View
                        className={`round-button${activeTab === "commissionWithdraw" ? " active" : ""}`}
                        onClick={() => actionClick("commissionWithdraw")}
                    >
                        {t("提现")}
                    </View>
                </View>
            </View>

            {/* 旧 v-show="activeTab === 'commissionDetail'" */}
            <View style={{ display: activeTab === "commissionDetail" ? "block" : "none" }}>
                <AccountDetail activeTab={activeTab} wallet="commission" refreshKey={refreshKey} />
            </View>

            {activeTab === "commissionWithdraw" ? (
                <RaplyToCard balance={formState.commissionBalance || 0} wallet="commission" onBackDetail={backDetail} />
            ) : null}
        </TigLayout>
    );
}
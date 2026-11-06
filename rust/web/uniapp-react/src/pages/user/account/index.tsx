import { useEffect, useMemo, useState } from "react";
import { View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { getUser } from "@/api/user/user";
import { useConfigStore } from "@/store/config";
import { useI18nStore } from "@/store/i18n";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import Deposit from "./deposit";
import Detail from "./detail";
import Log from "./log";
import RaplyToCard from "./raplyToCard";

import "./index.scss";

/**
 * 资金管理页（自旧 pages/user/account/index.vue 移植）
 * - 展示用户可用余额
 * - 支持充值和提现操作
 * - 查看账户明细和申请记录
 */
export default function AccountIndex() {
    usePageGuards();

    const router = useRouter();
    const langCode = useI18nStore((s) => s.langCode);

    // 会员余额提现开关（D1107）：关闭时隐藏提现入口，不影响分销佣金提现
    const memberWithdrawalEnabled = useConfigStore((s) => s.memberWithdrawalEnabled);

    const [formState, setFormState] = useState<any>({});
    const [activeTab, setActiveTab] = useState("detail");
    const [refreshKey, setRefreshKey] = useState(0);

    const tabs = useMemo(
        () => [
            { title: t("账户明细"), action: "detail" },
            { title: t("申请记录"), action: "log" }
        ],
        [langCode]
    );

    const __getUser = async () => {
        try {
            const result = await getUser();
            setFormState((prev: any) => ({ ...prev, ...result }));
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
        setActiveTab("detail");
    };

    // 旧 onLoad
    useEffect(() => {
        const options = (router.params || {}) as Record<string, any>;
        if (options.activeTab === "deposit") setActiveTab("deposit");
        void __getUser();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <TigLayout title={t("我的钱包")}>
            <View className="top-card" data-panel-rev="emlmbTIyODI">
                <View className="balance-row"> {t("可用余额")} </View>
                <View className="amount-row">
                    <FormatPrice
                        base
                        showText={false}
                        priceData={formState.balance}
                        decimalsStyle={{
                            fontSize: "40rpx",
                            fontWeight: "bold"
                        }}
                        currencyStyle={{
                            fontSize: "38rpx",
                            fontWeight: "bold"
                        }}
                    />
                </View>
                <View className="button-row">
                    <View className={`round-button${activeTab === "deposit" ? " active" : ""}`} onClick={() => actionClick("deposit")}>
                        {t("充值")}
                    </View>
                    {memberWithdrawalEnabled === 1 && (
                        <View className={`round-button${activeTab === "raplytocard" ? " active" : ""}`} onClick={() => actionClick("raplytocard")}>
                            {t("提现")}
                        </View>
                    )}
                </View>
            </View>

            {activeTab === "detail" || activeTab === "log" ? (
                <View className="custom-tabs">
                    {tabs.map((tab, index) => (
                        <View key={index} className={`tab${activeTab === tab.action ? " active-tab" : ""}`} onClick={() => actionClick(tab.action)}>
                            <View>{tab.title}</View>
                        </View>
                    ))}
                </View>
            ) : null}

            {/* 旧 v-show：明细/记录保持挂载，避免切换后丢失已加载分页 */}
            <View style={{ display: activeTab === "detail" ? "block" : "none" }}>
                <Detail activeTab={activeTab} refreshKey={refreshKey} />
            </View>

            <View style={{ display: activeTab === "log" ? "block" : "none" }}>
                <Log activeTab={activeTab} refreshKey={refreshKey} />
            </View>

            {activeTab === "deposit" ? <Deposit onBackDetail={() => backDetail()} /> : null}

            {activeTab === "raplytocard" ? <RaplyToCard balance={formState.balance} onBackDetail={backDetail} /> : null}
        </TigLayout>
    );
}
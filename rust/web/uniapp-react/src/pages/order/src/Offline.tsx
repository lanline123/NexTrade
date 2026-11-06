import { useEffect, useMemo, useState } from "react";
import { RichText, View } from "@tarojs/components";

import { t } from "@/utils/i18n";
import type { OfflinePaymentList } from "@/types/order/pay";

import "./Offline.scss";

interface Props {
    offlinePaymentList: OfflinePaymentList;
}

/**
 * 线下支付信息组件（自旧 pages/order/src/offline.vue 移植）
 * - Tab 展示线下支付方式的收款账户信息（第三方支付转账/银行汇款/企业汇款/其他汇款方式）
 */
export default function Offline({ offlinePaymentList }: Props) {
    // 支付方式映射（key 保留原始中文，与旧 activeName 比较逻辑一致）
    const paymentTypeMap = [
        { key: "第三方支付转账", field: "thirdPartyPaymentTransfer" },
        { key: "银行汇款", field: "offlinePayBank" },
        { key: "企业汇款", field: "offlinePayCompany" },
        { key: "其他汇款方式", field: "otherPaymentRemittance" }
    ];

    const isEnabled = (field: keyof OfflinePaymentList) => {
        const value = (offlinePaymentList as any)?.[field];
        return typeof value === "string" && value.trim().length > 0;
    };

    // 获取第一个已启用的支付方式
    const getFirstEnabledPayment = () => {
        for (const item of paymentTypeMap) {
            const value = (offlinePaymentList as any)?.[item.field as keyof OfflinePaymentList];
            if (value && value.trim()) {
                return item.key;
            }
        }
        return "";
    };

    const enabledPaymentTypes = useMemo(
        () =>
            paymentTypeMap.filter((item) => {
                const value = (offlinePaymentList as any)?.[item.field as keyof OfflinePaymentList];
                return value && value.trim();
            }),
        [offlinePaymentList]
    );

    // 旧 watch immediate/deep：offlinePaymentList 变化时重置默认选中项
    const [activeName, setActiveName] = useState(() => getFirstEnabledPayment());
    useEffect(() => {
        setActiveName(getFirstEnabledPayment());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [offlinePaymentList]);

    const handleTabsActive = (str: string) => {
        setActiveName(str);
    };

    const activeField = paymentTypeMap.find((item) => item.key === activeName)?.field as keyof OfflinePaymentList | undefined;
    const activeContent = activeField ? ((offlinePaymentList as any)?.[activeField] ?? "") : "";

    return (
        <View className="offline-warp">
            <View className={`offline-menu ${enabledPaymentTypes.length > 1 ? "" : "single-menu"}`}>
                {paymentTypeMap.map((item) =>
                    isEnabled(item.field as keyof OfflinePaymentList) ? (
                        <View key={item.field} className={`offline-menu-item ${activeName === item.key ? "active" : ""}`} onClick={() => handleTabsActive(item.key)}>
                            {t(item.key)}
                        </View>
                    ) : null
                )}
            </View>
            {/* 旧"第三方支付转账"用 up-parse 渲染 HTML，其余用 rich-text；统一 RichText 渲染。TODO(MIGRATION)：up-parse 富文本解析差异 */}
            <View className="offline-content">
                <RichText nodes={activeContent} />
            </View>
        </View>
    );
}

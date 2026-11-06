import { Text, View } from "@tarojs/components";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { staticResource } from "@/utils";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./settlementDetail.scss";

const stepList = [
    { title: t("卖家付款"), time: "2023-01-01 12:00:00" },
    { title: t("商家发货"), time: "2023-01-01 12:00:00" },
    { title: t("交易完成"), time: "2023-01-01 12:00:00" },
    { title: t("佣金结算"), time: "2023-01-01 12:00:00" }
];

/**
 * 结算详情页（自旧 pages/salesman/settlementDetail.vue 逐行移植）
 * - 展示佣金结算流程和状态
 * - 显示结算金额和时间节点
 * - 旧 up-steps → 基础组件自绘（uview 无等价 NutUI 视觉）
 */
export default function SalesmanSettlementDetail() {
    usePageGuards();

    const current = 0;
    const settleDetaiBg = `url(${staticResource("salesman/settlementDetailBack.png")})`;

    return (
        <TigLayout title={t("结算详情")}>
            <View className="settle-detai" style={{ backgroundImage: settleDetaiBg }}>
                <View className="settle-detai-header">{t("已结算")}</View>
                <View className="settle-detai-step">
                    <View className="settle-steps">
                        {stepList.map((item, index) => (
                            <View className={`settle-step${index <= current ? " active" : ""}`} key={index}>
                                <View className="settle-step__circle">{index + 1}</View>
                                <View className="settle-step__title">{item.title}</View>
                            </View>
                        ))}
                    </View>
                </View>
                <View className="settle-detai-desc">
                    <View className="desc-title">{t("交易完成结算")}</View>
                    <View className="desc-item">
                        <Text>1.</Text>
                        <Text>{t("商家发货，如果买家不主动确认收货，也不发起售后维权，7 天后系统自动确认收货，交易完成，佣金自动结算。")}</Text>
                    </View>
                    <View className="desc-item">
                        <Text>2.</Text>
                        <Text>{t("商家发货后，买家如果在7天内发起售后维权，结算时间会延长至维权结束且交易完成。")}</Text>
                    </View>
                    <View className="desc-item">
                        <Text>3.</Text>
                        <Text>{t("结算方式以交易完成时商家配置的方式为准。")}</Text>
                    </View>
                </View>
            </View>
        </TigLayout>
    );
}
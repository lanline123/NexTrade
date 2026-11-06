import { useState } from "react";
import { Text, View } from "@tarojs/components";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { t } from "@/utils/i18n";

import "./withdrawHelp.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 提现帮助页（自旧 pages/salesman/withdrawHelp.vue 逐行移植）
 * - 展示提现相关的帮助说明
 * - 常见问题解答
 */
export default function SalesmanWithdrawHelp() {
    usePageGuards();
    const [sections] = useState([
        {
            title: t("提现申请提交成功后，多久能入账？"),
            content: [<Text key="0">{t("预计在1-3个工作日到账，请注意查收")}</Text>]
        },
        {
            title: t("提现失败的主要原因是什么？"),
            content: [
                <Text key="0">
                    {t(
                        "1.银行卡：提现银行卡信息有误或者发卡行不支持此类交易，请检查信息或者更换银行卡后重新申请提现"
                    )}
                </Text>,
                <View key="1" className="help-section__break" />,
                <Text key="2">
                    {t(
                        "2.微信钱包：请确认您的微信账户是否正常，若已注销需要解除原微信授权，重新添加新的微信授权。请确认您的微信钱包是否实名认证，若未实名认证需要您进行认证"
                    )}
                </Text>
            ]
        },
        {
            title: t("提现金额的限制是多少？"),
            content: [<Text key="0">{t("目前最低提现金额为1元")}</Text>]
        }
    ]);

    return (
        <TigLayout title={t("提现帮助")}>
            {sections.map((section, index) => (
                <View className="help-section" key={index}>
                    <View className="help-section__header">
                        <View className="help-section__icon" />
                        <View className="help-section__title">{section.title}</View>
                    </View>
                    <View className="help-section__content">{section.content}</View>
                </View>
            ))}
        </TigLayout>
    );
}
import { useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";
import { Popup } from "@nutui/nutui-react-taro";

import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { t } from "@/utils/i18n";
import { navigateBack } from "@/utils/navigation";
import { usePageGuards } from "@/utils/pageMixin";

import TimeFilter from "./src/timeFilter";

import "./performanceStat.scss";

/**
 * 业绩统计页（自旧 pages/salesman/performanceStat.vue 逐行移植）
 * - 展示分销业绩数据统计
 * - 支持按时间筛选查看
 * - 显示佣金、订单、客户等统计
 * - 旧 up-action-sheet → NutUI Popup + 自绘标题；旧 up-toast → Taro.showToast
 */
export default function SalesmanPerformanceStat() {
    usePageGuards();

    const [showActionSheet, setShowActionSheet] = useState(false);

    const showTipClick = () => {
        // 旧 uToastRef.show({ type: "default", message: ..., position: "top" })
        Taro.showToast({
            title: "累计收益 = 商品佣金 + 邀请奖励",
            icon: "none"
        });
    };

    const performanceDescList = [
        { perid: "1", name: "销售额", desc: t("销售额仅包含推广订单的销售总额") },
        { perid: "2", name: "客户", desc: t("和分销员绑定了客户关系的买家或分销员") },
        { perid: "3", name: "邀请", desc: t("分销员成功邀请的下级分销员") },
        { perid: "4", name: t("商品佣金"), desc: t("分销员推荐客户购买后，分销员商品获得的佣金") },
        { perid: "5", name: t("邀请奖励"), desc: t("下级分销员推广商品后，上级获得的奖励") }
    ];

    return (
        <TigLayout>
            <TimeFilter showBack onBack={navigateBack} />
            <View className="salesman-performance-statistics">
                <View className="profit">
                    <View className="profit-all van-hairline--bottom">
                        <View className="profit-all__commision">0.00元</View>
                        <View className="desc">
                            <Text>{t("累计收益")}</Text>
                            <View className="asset-icon" onClick={showTipClick}>
                                <Text className="iconfont-h5 icon-wenhao-xianxingyuankuang" />
                            </View>
                        </View>
                        <View className="wait">
                            <Text>{t("含待结算:")}</Text>
                            <Text>0.00元</Text>
                        </View>
                    </View>
                    <View className="profit-kind">
                        <View className="profit-kind__commision van-hairline--right">
                            <View className="main">0.00元</View>
                            <View className="desc">{t("商品佣金")}</View>
                            <View className="wait">
                                <Text>{t("含待结算:")}</Text>
                                <Text>0.00元</Text>
                            </View>
                        </View>
                        <View className="profit-kind__invite">
                            <View className="main">0.00元</View>
                            <View className="desc">{t("邀请奖励")}</View>
                            <View className="wait">
                                <Text>{t("含待结算:")}</Text>
                                <Text>0.00元</Text>
                            </View>
                        </View>
                    </View>
                </View>
                <View className="customer">
                    <View className="customer-cus van-hairline--right">
                        <View className="main">0.00</View>
                        <View className="desc">累计销售额(元)</View>
                    </View>
                    <View className="customer-cus van-hairline--right">
                        <View className="main">0</View>
                        <View className="desc">累计订单(笔)</View>
                    </View>
                    <View className="customer-cus van-hairline--right">
                        <View className="main">0</View>
                        <View className="desc">累计客户(人)</View>
                    </View>
                </View>
                <View className="index-noun" onClick={() => setShowActionSheet(true)}>
                    {t("查看业绩指标说明")}
                </View>
            </View>
            <Popup
                visible={showActionSheet}
                position="bottom"
                zIndex={999}
                round
                closeable={false}
                style={{ backgroundColor: "#fff" }}
                onClose={() => setShowActionSheet(false)}
            >
                <View className="action-sheet">
                    <View className="action-sheet__header">{t("业绩指标说明")}</View>
                    <View className="explaination">
                        {performanceDescList.map((perItem) => (
                            <View className="explaination__item van-cell" key={perItem.perid}>
                                <View className="van-cell__title">
                                    <View>
                                        <View className="explaination__item-title">{perItem.name}</View>
                                        <View className="explaination__item-desc">{perItem.desc}</View>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </View>
                    <View className="btn-box">
                        <TigButton2
                            className="salesman-btn"
                            style={{
                                width: "100%",
                                background: "linear-gradient(45deg, rgb(255, 170, 30), rgb(255, 114, 13))",
                                borderColor: "#fff",
                                color: "#fff"
                            }}
                            onClick={() => setShowActionSheet(false)}
                        >
                            {t("知道了")}
                        </TigButton2>
                    </View>
                </View>
            </Popup>
        </TigLayout>
    );
}

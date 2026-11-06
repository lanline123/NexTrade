import { Text, View } from "@tarojs/components";
import Taro from "@tarojs/taro";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigButton2 from "@/components/tig/tig-button2/TigButton2";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import { t } from "@/utils/i18n";
import { usePageGuards } from "@/utils/pageMixin";

import "./assetsCenter.scss";

/**
 * 资产中心页（自旧 pages/salesman/assetsCenter.vue 逐行移植）
 * - 展示分销员资产统计
 * - 提供佣金明细、提现等入口
 */
export default function SalesmanAssetsCenter() {
    usePageGuards();

    const goPages = (url: string) => {
        Taro.navigateTo({
            url
        });
    };

    return (
        <TigLayout title={t("资产中心")}>
            <View className="assets-block">
                <View className="head-info">
                    <View className="rmb_logo" />
                    <View className="useful-money">{t("可提现金额")}</View>
                    <View className="profit-sum">
                        <FormatPrice
                            base
                            fontStyle={{ fontSize: "48rpx", lineHeight: "1" }}
                            currencyStyle={{ selfAlign: "end", fontSize: "24rpx" } as any}
                            priceData={3265.35}
                        />
                    </View>
                </View>
                <View className="btn-block">
                    <TigButton2
                        className="apply"
                        style={{ width: "100%", fontSize: "30rpx", backgroundColor: "#07c160", borderColor: "#07c160", color: "#fff" }}
                        onClick={() => goPages("/pages/salesman/withdraw")}
                    >
                        {t("提现")}
                    </TigButton2>
                </View>
                <View className="van-cell-group van-hairline--top-bottom">
                    <View className="van-cell van-cell--clickable" role="button" onClick={() => goPages("/pages/salesman/inOutRecordList")}>
                        <View className="van-cell__title">
                            <Text>{t("收支明细")}</Text>
                        </View>
                        <Text className="iconfont-h5 icon-xiangyou cell-arrow" />
                    </View>
                    <View className="van-cell van-cell--clickable" role="button" onClick={() => goPages("/pages/salesman/withdrawRecordList")}>
                        <View className="van-cell__title">
                            <Text>{t("提现记录")}</Text>
                        </View>
                        <Text className="iconfont-h5 icon-xiangyou cell-arrow" />
                    </View>
                </View>
            </View>
        </TigLayout>
    );
}

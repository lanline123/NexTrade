import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import { View } from "@tarojs/components";

import FormatPrice from "@/components/format-price/FormatPrice";
import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import { useConfigStore } from "@/store/config";
import { useThemeStore } from "@/store/theme";
import Animation from "@/pages/order/src/Animation";
// 旧 components/recommend 共享组件（含 Masonry 瀑布流与 titleBg prop）
import Recommend from "@/components/recommend";
import type { PayLogData } from "@/types/order/payStatus";
import { redirect } from "@/utils";
import { t } from "@/utils/i18n";

import "./payStatus.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 礼品卡兑换/充值成功页（自旧 pages/giftCard/order/payStatus.vue 移植）
 * - 旧版取数逻辑整段注释（onLoad/getPayLogData 停用），页面恒为静态成功态
 * - 展示实付金额 + 查看充值/继续逛逛 + 商品推荐
 */
export default function GiftCardPayStatus() {
    usePageGuards();
    const isGuestLikeGoods = useConfigStore((s) => s.isGuestLikeGoods);
    const themeStyle = useThemeStore((s) => s.themeStyle);
    const hexToRgba = useThemeStore((s) => s.hexToRgba);

    const [isLoading] = useState(false);
    const [info] = useState<PayLogData>({} as PayLogData);

    // 是否是礼品卡兑换订单（旧计算属性保留，模板未消费）
    const isGiftCardExchangeOrder = info?.orderType === 12;
    void isGiftCardExchangeOrder;

    // 旧 v-bind(primaryBg) → 根节点 CSS 变量（primary 按钮 active 态背景）
    const primaryBg = useMemo(() => {
        return hexToRgba(themeStyle["--general"], 0.1);
    }, [themeStyle, hexToRgba]);

    return (
        <TigLayout>
            {!isLoading ? (
                <View className="pay-status" style={{ "--primary-bg": primaryBg } as CSSProperties}>
                    <View className="pay-status-content">
                        <View className="status-content">
                            <Animation />
                            <View className="status-text">{t("充值成功")}</View>
                        </View>
                        <View className="money">
                            <View className="money-text">{t("实付")}</View>
                            <View className="money-value">
                                <FormatPrice
                                    fontStyle={{ fontSize: "38rpx" }}
                                    currencyStyle={{
                                        fontSize: "30rpx"
                                    }}
                                    decimalsStyle={{
                                        fontSize: "26rpx",
                                        fontWeight: "400"
                                    }}
                                    isBottom={true}
                                    priceData={info.orderAmount}
                                />
                            </View>
                        </View>
                        <View className="status-btns">
                            <View className="btn-item" onClick={() => redirect({ url: "/pages/user/account/index" })}>
                                {t("查看充值")}
                            </View>
                            <View className="btn-item primary" onClick={() => redirect({ url: "/pages/index/index" })}>
                                {t("继续逛逛")}
                            </View>
                        </View>
                    </View>

                    {isGuestLikeGoods ? (
                        <View className="recommend">
                            <View className="recommend-mask" />
                            <View className="recommend-content">
                                {/* 旧 <recommend title-bg="#fff" />（已收敛到共享组件） */}
                                <Recommend titleBg="#fff" />
                            </View>
                        </View>
                    ) : null}
                </View>
            ) : null}

            <TigLoadingPage modelValue={isLoading} />
        </TigLayout>
    );
}
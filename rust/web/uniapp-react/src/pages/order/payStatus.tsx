import { useEffect, useMemo, useRef, useState } from "react";
import { Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import FormatPrice from "@/components/format-price/FormatPrice";
import { useThemeStore } from "@/store/theme";
import { useConfigStore } from "@/store/config";
import { checkPayStatus, getPayLog } from "@/api/order/pay";
import Animation from "./src/Animation";
// 旧 components/recommend 共享组件（含 Masonry 瀑布流与 titleBg prop）
import Recommend from "@/components/recommend";
import { redirect } from "@/utils";
import type { PayLogData } from "@/types/order/payStatus";
import { resolvePayResult, type PayResultState } from "./src/payResult";
import { t } from "@/utils/i18n";

import "./payStatus.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 支付结果页（自旧 pages/order/payStatus.vue 移植，B3 交易链路第四批）
 * - 显示支付成功/预约成功状态
 * - 预约订单显示预约时间和服务信息
 * - 提供查看订单、继续逛逛入口
 * - 底部展示商品推荐
 */
export default function PayStatus() {
    usePageGuards();
    const router = useRouter();
    const configStoreIsGuestLikeGoods = useConfigStore((s) => s.isGuestLikeGoods);
    const themeStyle = useThemeStore((s) => s.themeStyle);
    const hexToRgba = useThemeStore((s) => s.hexToRgba);

    const [isLoading, setIsLoading] = useState(true);
    const [resultState, setResultState] = useState<PayResultState>("loading");
    const currentOrderIdRef = useRef<number | null>(null);
    const [info, setInfo] = useState<PayLogData>({} as PayLogData);

    const getPayLogData = async (id: number) => {
        setIsLoading(true);
        setResultState("loading");

        try {
            const result = await resolvePayResult({
                orderId: id,
                loadPayLog: getPayLog,
                loadOrderPayStatus: checkPayStatus
            });

            if (result.state === "success") {
                setInfo(result.info);
                setResultState("success");
            } else {
                if (result.error) {
                    console.error("获取支付结果失败:", result.error);
                }
                setResultState("error");
            }
        } finally {
            setIsLoading(false);
        }
    };

    const retryPayResult = () => {
        if (currentOrderIdRef.current !== null) {
            getPayLogData(currentOrderIdRef.current);
        }
    };

    // ===================== 旧 onLoad =====================
    useEffect(() => {
        // 旧 #ifdef H5：清除直选支付进行中标记
        if (process.env.TARO_ENV === "h5") {
            Taro.removeStorageSync("directPayPending");
        }
        const orderId = Number(router.params?.id);
        if (!Number.isInteger(orderId) || orderId <= 0) {
            redirect({ url: "/pages/index/index" });
            return;
        }

        currentOrderIdRef.current = orderId;
        getPayLogData(orderId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 v-bind(primaryBg) 转内联 style（active 态背景）
    const primaryBg = useMemo(() => {
        return hexToRgba(themeStyle["--general"], 0.1);
    }, [themeStyle, hexToRgba]);

    const btnActiveStyle = { backgroundColor: primaryBg } as any;

    return (
        <TigLayout>
            {!isLoading && (
                <View className="pay-status">
                    {resultState === "success" && (
                        <View className="pay-status-content">
                            <View className="status-content">
                                <Animation />
                                <View className="status-text">{t(info.orderReservation ? "预约成功" : "支付成功")}</View>
                            </View>
                            {!info.orderReservation ? (
                                <View className="money">
                                    <View className="money-text">{t("实付")}</View>
                                    <View className="money-value">
                                        {/* 旧注释保留：原展示 orderAmount，后改 payAmount */}
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
                                            priceData={info.payAmount}
                                        />
                                    </View>
                                </View>
                            ) : (
                                <View className="reserv-box">
                                    {info.orderType === 9 && (
                                        <Text>
                                            {`${t("请在")} ${info.orderReservation.reservationDate} ${info.orderReservation.startTime}~${info.orderReservation.endTime} ${t("准时到店消费")}`}
                                        </Text>
                                    )}
                                    {info.orderType === 10 && (
                                        <>
                                            <Text>{`${t("您的服务预约在")} ${info.orderReservation.reservationDate} ${info.orderReservation.startTime}~${info.orderReservation.endTime}`}</Text>
                                            <Text>{t("如需更上门服务改时间请提前联系商家进行沟通")}</Text>
                                        </>
                                    )}
                                </View>
                            )}

                            <View className="status-btns">
                                <View className="btn-item" onClick={() => redirect({ url: "/pages/user/order/list" })}>
                                    {t("查看订单")}
                                </View>
                                <View className="btn-item primary" onClick={() => redirect({ url: "/pages/index/index" })}>
                                    {t("继续逛逛")}
                                </View>
                            </View>
                        </View>
                    )}
                    {resultState === "success" && !!Number(configStoreIsGuestLikeGoods) && (
                        <View className="recommend">
                            <View className="recommend-mask" />
                            <View className="recommend-content">
                                {/* 旧 <recommend title-bg="#fff" />（已收敛到共享组件） */}
                                <Recommend titleBg="#fff" />
                            </View>
                        </View>
                    )}
                    {resultState === "error" && (
                        <View className="pay-result-error">
                            <View className="error-mark">!</View>
                            <View className="error-title">{t("支付结果暂未确认")}</View>
                            <View className="error-desc">{t("请重新加载，或前往订单列表查看最新状态")}</View>
                            <View className="error-btns">
                                <View className="error-btn primary" style={btnActiveStyle} onClick={retryPayResult}>
                                    {t("重新加载")}
                                </View>
                                <View className="error-btn" onClick={() => redirect({ url: "/pages/user/order/list" })}>
                                    {t("查看订单")}
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            )}

            <TigLoadingPage modelValue={isLoading} />
        </TigLayout>
    );
}

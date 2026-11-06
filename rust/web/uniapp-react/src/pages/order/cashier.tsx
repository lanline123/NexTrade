import { useEffect, useMemo, useRef, useState } from "react";
import { Image, Text, View } from "@tarojs/components";
import Taro, { useRouter } from "@tarojs/taro";

import TigLayout from "@/components/tig/tig-layout/TigLayout";
import TigLoadingPage from "@/components/tig/tig-loadingpage";
import FormatPrice from "@/components/format-price/FormatPrice";
import { orderPayInfo, rechargeOrderPay } from "@/api/order/pay";
import type { Order } from "@/types/order/pay";
import { usePayment, PAYMENT_TEXT_MAP } from "@/hooks/usePayment";
import { isOverseas, staticResource, redirect } from "@/utils";
import { t } from "@/utils/i18n";

import AbandonPayDialog from "./src/AbandonPayDialog";

import "./cashier.scss";
import { usePageGuards } from "@/utils/pageMixin";

/**
 * 收银台落地页（自旧 pages/order/cashier.vue 移植，B3 交易链路第四批）
 * - 结算页直选在线支付发起后的落地/返回页：展示应付金额、付款倒计时、支付方式，支持重新支付
 * - 返回时弹出放弃支付挽留：放弃/关闭弹窗跳待付款订单，立即支付重新发起
 * - 订单已支付时直接跳支付结果页，避免重复支付
 * - 支付执行统一委托 usePayment（@/hooks/usePayment，B3-2a 占位已由本批次替换为完整移植版）
 */
/** 外部支付返回会重新加载收银台，用订单维度的短期缓存恢复用户选择 */
const PAYMENT_SELECTION_CACHE_KEY = "cashierPaymentSelection";
const PAYMENT_SELECTION_CACHE_TTL = 30 * 60 * 1000;

interface PaymentSelectionCache {
    orderId: number;
    paymentType: string;
    ts: number;
    entryFrom?: string;
}

export default function Cashier() {
    usePageGuards();
    const router = useRouter();
    const { startPay, stopPolling } = usePayment();

    const [loading, setLoading] = useState(false);
    const [order, setOrder] = useState<Order>();
    const [paymentList, setPaymentList] = useState<string[]>([]);
    const [paymentType, setPaymentType] = useState("");
    const [paymentDisabled, setPaymentDisabled] = useState(false);
    const [presaleInfo, setPresaleInfo] = useState<any>(null);
    const orderIdRef = useRef<number | null>(null);
    /** 进入收银台前已选择的支付渠道，渠道仍可用时优先恢复 */
    const initialPaymentTypeRef = useRef("");
    /** 充值支付：type=recharge */
    const isRechargeRef = useRef(false);
    /**
     * 进入来源：settle=结算页直选支付（放弃后去待付款列表）；
     * 其余（订单详情/列表/充值）通过 navigateTo 进入，放弃后返回上一页
     */
    const entryFromRef = useRef("");

    // 跨境支付渠道仅在跨境运行环境展示，避免普通版误显示或选择。
    const displayPaymentList = useMemo(
        () =>
            (paymentList || []).filter((channel) => {
                if (channel === "stripe" || channel === "antom" || channel === "xendit") return isOverseas();
                return true;
            }),
        [paymentList]
    );

    const getCachedPaymentType = (id: number): string => {
        const cache = Taro.getStorageSync(PAYMENT_SELECTION_CACHE_KEY) as PaymentSelectionCache | undefined;
        if (cache && Number(cache.orderId) === id && cache.paymentType && Date.now() - Number(cache.ts) < PAYMENT_SELECTION_CACHE_TTL) {
            if (!entryFromRef.current && cache.entryFrom) entryFromRef.current = cache.entryFrom;
            return cache.paymentType;
        }
        if (cache) Taro.removeStorageSync(PAYMENT_SELECTION_CACHE_KEY);
        return "";
    };

    const cachePaymentType = () => {
        if (!orderIdRef.current || !paymentType) return;
        Taro.setStorageSync(PAYMENT_SELECTION_CACHE_KEY, {
            orderId: orderIdRef.current,
            paymentType: paymentType,
            ts: Date.now(),
            entryFrom: entryFromRef.current
        });
    };

    const clearCachedPaymentType = () => {
        const cache = Taro.getStorageSync(PAYMENT_SELECTION_CACHE_KEY) as PaymentSelectionCache | undefined;
        if (!cache || Number(cache.orderId) === orderIdRef.current) {
            Taro.removeStorageSync(PAYMENT_SELECTION_CACHE_KEY);
        }
    };

    const resolvePaymentType = (id: number) => {
        // 缓存可能是用户进入收银台后重新选择的渠道，应优先于入口 URL 中的初始渠道
        const preferredPaymentType = getCachedPaymentType(id) || initialPaymentTypeRef.current;
        const next = displayPaymentList.includes(preferredPaymentType) ? preferredPaymentType : displayPaymentList[0] || "";
        setPaymentType(next);
        cachePaymentTypeWith(next);
    };

    /** cachePaymentType 的带参变体：resolvePaymentType 内 setState 未生效前先按目标值写入缓存 */
    const cachePaymentTypeWith = (value: string) => {
        if (!orderIdRef.current || !value) return;
        Taro.setStorageSync(PAYMENT_SELECTION_CACHE_KEY, {
            orderId: orderIdRef.current,
            paymentType: value,
            ts: Date.now(),
            entryFrom: entryFromRef.current
        });
    };

    const [showAbandon, setShowAbandon] = useState(false);
    /** 立即支付 / 更换方式关闭弹窗时，跳过「放弃」跳转 */
    const skipAbandonRedirectRef = useRef(false);
    /** 本单赠送积分（挽留弹窗） */
    const [willSendPoints, setWillSendPoints] = useState<number | string>(0);
    /** 会员优惠立减金额（挽留弹窗） */
    const [memberDiscountAmount, setMemberDiscountAmount] = useState<number | string>(0);

    /** 应付金额：充值单取 amount，普通订单取 unpaidAmount */
    const payAmount = useMemo<string | number>(() => {
        if (!order) return "";
        if (isRechargeRef.current) return order.amount ?? order.unpaidAmount ?? "";
        return order.unpaidAmount ?? "";
    }, [order]);

    // ----- 付款倒计时 -----
    const [remainSeconds, setRemainSeconds] = useState(0);
    const [payExpired, setPayExpired] = useState(false);
    const countdownTimerRef = useRef<any>(null);
    const countdownEndRef = useRef(0);

    const countdownText = useMemo(() => {
        if (remainSeconds <= 0) return "";
        const h = Math.floor(remainSeconds / 3600);
        const m = Math.floor((remainSeconds % 3600) / 60);
        const s = remainSeconds % 60;
        const pad = (n: number) => (n < 10 ? "0" + n : String(n));
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }, [remainSeconds]);

    /** 服务端时间转时间戳（兼容秒/毫秒时间戳与 iOS 的 yyyy-MM-dd HH:mm:ss） */
    const parseTime = (value?: string | number): number => {
        if (value === undefined || value === null || value === "") return 0;
        if (typeof value === "number") return value < 1e12 ? value * 1000 : value;
        const str = String(value);
        if (/^\d+$/.test(str)) {
            const timestamp = Number(str);
            return timestamp < 1e12 ? timestamp * 1000 : timestamp;
        }
        const [datePart, timePart = "00:00:00"] = str.split(" ");
        const [y, mo, d] = datePart.split("-").map(Number);
        const [h, mi, se] = timePart.split(":").map(Number);
        return new Date(y, (mo || 1) - 1, d || 1, h || 0, mi || 0, se || 0).getTime();
    };

    const tickCountdown = () => {
        const diff = Math.floor((countdownEndRef.current - Date.now()) / 1000);
        setRemainSeconds(diff > 0 ? diff : 0);
        if (diff <= 0) {
            setPayExpired(true);
            stopCountdown();
        }
    };

    const startCountdown = () => {
        stopCountdown();
        setRemainSeconds(0);
        setPayExpired(false);

        // 充值订单后端没有截止时间，不在前端伪造 30 分钟有效期。
        const endTsFromServer = parseTime(order?.payEndTime);
        if (!endTsFromServer) return;
        const serverNow = parseTime(order?.serverTime);
        const endTs = serverNow ? Date.now() + Math.max(0, endTsFromServer - serverNow) : endTsFromServer;
        countdownEndRef.current = endTs;
        tickCountdown();
        countdownTimerRef.current = setInterval(tickCountdown, 1000);
    };

    const stopCountdown = () => {
        if (countdownTimerRef.current) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
        }
    };

    // ===================== 旧 onLoad =====================
    useEffect(() => {
        const options: any = router.params;
        if (!options || !options.orderId) {
            redirect({ url: "/pages/user/order/list", mode: "redirectTo" });
            return;
        }
        entryFromRef.current = options.from || "";
        initialPaymentTypeRef.current = options.paymentType || "";
        if (options.type === "recharge") {
            isRechargeRef.current = true;
            loadRechargeOrderPay(Number(options.orderId));
        } else {
            loadOrderPayInfo(Number(options.orderId));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // 旧 onUnmounted
    useEffect(() => {
        return () => {
            stopCountdown();
            stopPolling();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /**
     * @description 加载订单支付信息，初始化金额、渠道、倒计时
     * @param id 订单ID
     */
    const loadOrderPayInfo = async (id: number) => {
        setLoading(true);
        try {
            const result = await orderPayInfo(id);
            setOrder(result.order);
            setPaymentList(result.paymentList || []);
            orderIdRef.current = result.order.orderId;
            setPresaleInfo(result.order.presaleInfo ?? null);
            resolvePaymentType(result.order.orderId);
            setWillSendPoints((result as any).willSendPoints ?? result.order?.willSendPoints ?? 0);
            setMemberDiscountAmount((result as any).memberDiscountAmount ?? result.order?.memberDiscountAmount ?? 0);

            // 拼团订单跳拼团详情（与支付页一致）
            if ((result as any)?.grouponPromotionRecordId) {
                redirect({
                    url: `/pages/product/groupBuying?grouponPromotionRecordId=${(result as any).grouponPromotionRecordId}`,
                    mode: "redirectTo"
                });
                return;
            }

            // 订单已支付：直接跳支付结果页，避免重复支付
            if (result.order.payStatus === 2) {
                clearCachedPaymentType();
                redirect({ url: `/pages/order/payStatus?id=${id}`, mode: "redirectTo" });
                return;
            }

            startCountdown();
        } catch (error: any) {
            Taro.showToast({ title: error.message, duration: 1500, icon: "none" });
            setTimeout(() => {
                redirect({ url: "/pages/user/order/list", mode: "redirectTo" });
            }, 1500);
        } finally {
            setLoading(false);
        }
    };

    /**
     * @description 加载充值订单支付信息
     * @param id 充值订单ID
     */
    const loadRechargeOrderPay = async (id: number) => {
        setLoading(true);
        try {
            const result = await rechargeOrderPay({ orderId: id });
            setOrder(result.order);
            setPaymentList(result.paymentList || []);
            orderIdRef.current = result.order.orderId;
            resolvePaymentType(result.order.orderId);
            startCountdown();
        } catch (error: any) {
            Taro.showToast({ title: error.message, duration: 1500, icon: "none" });
            setTimeout(() => {
                redirect({ url: "/pages/user/account/index", mode: "redirectTo" });
            }, 1500);
        } finally {
            setLoading(false);
        }
    };

    const selectChannel = (channel: string) => {
        if (paymentDisabled) return;
        setPaymentType(channel);
        cachePaymentType();
    };

    /**
     * @description 发起支付（重新支付 / 自动发起共用）
     * 各端各渠道的收银台拉起 / 表单跳转统一由 usePayment 处理
     */
    const handlePay = async () => {
        if (paymentDisabled) return;
        if (payExpired) {
            Taro.showToast({ title: t("订单支付已过期"), duration: 1500, icon: "none" });
            return;
        }
        if (!orderIdRef.current || !paymentType) {
            Taro.showToast({ title: t("请选择支付方式"), duration: 1500, icon: "none" });
            return;
        }
        cachePaymentType();
        setPaymentDisabled(true);
        try {
            const saleModeQuery = presaleInfo?.saleMode === 2 ? "&saleMode=1" : "";
            const started = await startPay({
                orderId: orderIdRef.current,
                paymentType: paymentType,
                presaleInfo: presaleInfo,
                isRecharge: isRechargeRef.current,
                // H5 微信用当前页跳转，返回落回收银台页
                h5WechatMode: "href",
                onSuccess: () => {
                    clearCachedPaymentType();
                    if (isRechargeRef.current) {
                        redirect({ url: "/pages/user/account/index", mode: "redirectTo" });
                    } else {
                        redirect({ url: `/pages/order/payStatus?id=${orderIdRef.current}${saleModeQuery}`, mode: "redirectTo" });
                    }
                },
                onFail: () => {
                    // 取消/失败：留在收银台，可重新支付
                    setPaymentDisabled(false);
                },
                onTimeout: () => {
                    setPaymentDisabled(false);
                }
            });
            if (!started) setPaymentDisabled(false);
        } catch (error: any) {
            Taro.showToast({ title: error.message, duration: 1500, icon: "none" });
            setPaymentDisabled(false);
        }
    };

    /** 点击返回：弹出放弃支付挽留 */
    const onClickBack = () => {
        if (isRechargeRef.current) {
            confirmAbandon();
            return;
        }
        setShowAbandon(true);
    };

    // TODO(MIGRATION)：旧 onBackPress 拦截系统/硬件返回改弹挽留；Taro React 无对应
    // 跨端 hook（H5 无法拦截浏览器返回，小程序需原生容器支持），随平台能力批次补充。
    // const onBackPress = (e: any) => { ... }

    /** 放弃支付 / 关闭挽留弹窗 */
    const confirmAbandon = () => {
        setShowAbandon(false);
        if (skipAbandonRedirectRef.current) {
            skipAbandonRedirectRef.current = false;
            return;
        }
        clearCachedPaymentType();
        // 结算页进入：无上一页可回，去待付款列表 / 充值兜底账户页
        if (entryFromRef.current === "settle") {
            if (isRechargeRef.current) {
                redirect({ url: "/pages/user/account/index", mode: "redirectTo" });
            } else {
                redirect({ url: "/pages/user/order/list?type=awaitPay", mode: "redirectTo" });
            }
            return;
        }
        // 订单详情 / 列表 / 充值：有历史栈则返回上一页
        const pages = Taro.getCurrentPages();
        if (pages.length > 1) {
            Taro.navigateBack();
            return;
        }
        // 无历史栈兜底
        if (isRechargeRef.current) {
            redirect({ url: "/pages/user/account/index", mode: "redirectTo" });
        } else {
            redirect({ url: "/pages/user/order/list?type=awaitPay", mode: "redirectTo" });
        }
    };

    /** 立即支付：关闭挽留并重新发起 */
    const continuePay = () => {
        skipAbandonRedirectRef.current = true;
        setShowAbandon(false);
        handlePay();
    };

    /** 更换方式：关闭挽留，回到收银台自行切换支付渠道 */
    const onChangePay = () => {
        skipAbandonRedirectRef.current = true;
        setShowAbandon(false);
    };

    return (
        <TigLayout title={t("收银台")} customBack onBack={onClickBack}>
            {order && (
                <View className="cashier">
                    {/* 金额与倒计时 */}
                    <View className="cashier-head">
                        <View className="cashier-amount">
                            <FormatPrice
                                isBottom={false}
                                priceData={payAmount as string}
                                currencyStyle={{ fontWeight: "500", fontSize: "34rpx" }}
                                fontStyle={{ fontWeight: "500", fontSize: "64rpx", lineHeight: "1" }}
                                decimalsStyle={{ fontWeight: "500", fontSize: "40rpx" }}
                            />
                        </View>
                        {countdownText ? (
                            <View className="cashier-countdown">
                                {t("请在")}
                                <Text className="countdown-time">{countdownText}</Text>
                                {t("内付款")}
                            </View>
                        ) : payExpired ? (
                            <View className="cashier-countdown cashier-expired">{t("支付已过期")}</View>
                        ) : null}
                    </View>

                    {/* 支付方式 */}
                    <View className="cashier-panel">
                        <View className="panel-title">{t("支付方式")}</View>
                        <View className="channel-list">
                            {displayPaymentList.map((channel: string) => (
                                <View className="channel-item" key={channel} onClick={() => selectChannel(channel)}>
                                    <View className="channel-info">
                                        <Image lazyLoad className="channel-icon" src={staticResource("payment/pay_" + channel + ".png")} />
                                        <View className="channel-text">
                                            <View className="channel-name">{t(PAYMENT_TEXT_MAP[channel] || channel)}</View>
                                        </View>
                                    </View>
                                    <View className={`radio-circle ${paymentType === channel ? "checked" : ""}`} />
                                </View>
                            ))}
                        </View>
                    </View>

                    {/* 底部重新支付：旧 tig-fixed-placeholder + tig-button → 固定底栏 View */}
                    <View className="cashier-footer pay-fixed-footer">
                        <View
                            className={`pay-btn pay-submit-btn ${paymentDisabled || payExpired || !paymentType ? "is-disabled" : ""}`}
                            onClick={handlePay}
                        >
                            <View className="pay-btn-inner">
                                <Text>{t(isRechargeRef.current ? "立即支付" : "重新支付")}</Text>
                                <FormatPrice
                                    isBottom={false}
                                    priceData={payAmount as string}
                                    currencyStyle={{ color: "#fff", fontSize: "26rpx", fontWeight: "bold" }}
                                    fontStyle={{ color: "#fff", fontSize: "30rpx", fontWeight: "bold" }}
                                    decimalsStyle={{ color: "#fff", fontSize: "26rpx", fontWeight: "bold" }}
                                />
                            </View>
                        </View>
                    </View>
                </View>
            )}

            {/* 放弃支付挽留弹窗 */}
            <AbandonPayDialog
                show={showAbandon}
                onShowChange={(v) => {
                    // 旧 v-model:show + @close：弹窗自身关闭（右上角/遮罩）时走放弃分支
                    if (!v) return;
                    setShowAbandon(v);
                }}
                amount={payAmount}
                paymentType={paymentType}
                rewardPoints={willSendPoints}
                discountAmount={memberDiscountAmount}
                onAbandon={confirmAbandon}
                onConfirm={continuePay}
                onChange={onChangePay}
            />

            <TigLoadingPage modelValue={loading} />
        </TigLayout>
    );
}
